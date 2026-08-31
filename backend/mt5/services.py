import logging

from django.utils import timezone
from rest_framework.exceptions import ValidationError

from . import service as mt5_service
from .models import MT5Account
from .repositories import MT5Repository
from .serializers import MT5AccountSerializer
from config.ws_broadcast import broadcast_mt5

logger = logging.getLogger(__name__)


class MT5Service:
    def __init__(self, repository: MT5Repository | None = None):
        self.repository = repository or MT5Repository()

    def get_queryset_for_user(self, user):
        return self.repository.get_queryset_for_user(user)

    def get_account_for_user(self, user):
        return self.repository.get_account_for_user(user)

    def get_account_for_request(self, request, pk=None):
        account = self.repository.get_by_id(pk)
        if request.user.role != 'admin' and account and account.user != request.user:
            raise PermissionError('Forbidden')
        return account

    def set_credentials(self, user, data: dict):
        """
        Set MT5 credentials for user.
        
        IMPORTANT: In production with EA, we don't sync immediately.
        Just create the account and wait for EA to push real data.
        """
        login = data['login']
        broker = data.get('broker', '')
        existing = MT5Account.objects.filter(login=login, broker=broker).exclude(user=user).first()
        if existing is not None:
            raise ValidationError('MT5 account login already linked to another user.')

        encrypted_pw = mt5_service.encrypt_password(data['password'])
        account, created = self.repository.create_or_update_account(
            user=user,
            login=login,
            password_encrypted=encrypted_pw,
            server=data['server'],
            broker=broker,
            account_number=str(login),
            status='pending',  # Will be 'connected' once EA pushes data
            error_message='Waiting for EA to push data...',
        )
        
        # Don't call sync_account() here - let EA push real data
        # If you need immediate sync for testing, uncomment:
        # return self.sync_account(account)
        
        return account

    def sync_account(self, account: MT5Account) -> MT5Account:
        """
        Sync MT5 account data.
        
        IMPORTANT: In production (Linux + MT5_USE_SIMULATION=True), 
        real data ONLY comes from EA via /api/v1/mt5/ea-report/ endpoint.
        
        This endpoint should NEVER generate simulation data that overwrites EA data.
        It only reads current state from database and broadcasts it.
        """
        from datetime import timedelta
        from decouple import config as env_config
        
        # If MT5_USE_SIMULATION=True (production/Linux), ALWAYS skip simulation
        # EA is the only source of truth for real data
        use_simulation = env_config('MT5_USE_SIMULATION', default=False, cast=bool)
        
        if use_simulation:
            # Production mode: EA pushes data, sync endpoint just reads from DB
            logger.info(
                'MT5_USE_SIMULATION=True: Account %s sync reads from database (EA is data source)',
                account.pk
            )
            account.refresh_from_db()
            
            # Broadcast current data from database
            try:
                broadcast_mt5(str(account.user.id), MT5AccountSerializer(account).data)
            except Exception:
                logger.exception('Failed to broadcast MT5 live update for account %s', account.pk)
            
            return account
        
        # Development/Windows mode: Can use real MT5 package or generate simulation
        # Check if account has recent EA data (synced within last 10 seconds)
        if account.last_sync:
            time_since_sync = timezone.now() - account.last_sync
            if time_since_sync < timedelta(seconds=10):
                # EA is actively pushing data, don't overwrite with simulation
                logger.info(
                    'Account %s has recent EA data (synced %s ago), skipping simulation',
                    account.pk,
                    time_since_sync
                )
                # Just refresh account from database and return
                account.refresh_from_db()
                
                # Broadcast current data
                try:
                    broadcast_mt5(str(account.user.id), MT5AccountSerializer(account).data)
                except Exception:
                    logger.exception('Failed to broadcast MT5 live update for account %s', account.pk)
                
                return account
        
        # No recent EA data, proceed with normal sync (real MT5 or simulation for dev)
        try:
            password = mt5_service.decrypt_password(account.password_encrypted)
            snapshot = mt5_service.get_account_snapshot(account.login, password, account.server)

            info = snapshot['account']
            account.status = 'connected'
            account.error_message = ''
            account.balance = info['balance']
            account.equity = info['equity']
            account.floating_pnl = info['floating_pnl']
            account.margin = info['margin']
            account.free_margin = info['free_margin']
            account.margin_level = info['margin_level']
            account.drawdown = info['drawdown']
            account.currency = info['currency']
            account.leverage = info['leverage']
            account.company = info['company']
            account.is_demo = info['is_demo']
            account.account_number = str(info['login'])
            account.last_sync = timezone.now()
            account.open_positions = len(snapshot['positions'])
            account.pending_orders = len(snapshot['orders'])
            account.save()

            position_tickets = set()
            for pos_data in snapshot['positions']:
                position_tickets.add(pos_data['ticket'])
            self.repository.sync_positions(account, snapshot['positions'])
            self.repository.prune_positions(account, position_tickets)

            order_tickets = set()
            for od in snapshot['orders']:
                order_tickets.add(od['ticket'])
            self.repository.sync_orders(account, snapshot['orders'])
            self.repository.prune_orders(account, order_tickets)

            self.repository.sync_deals(account, snapshot.get('deals', []))

            try:
                broadcast_mt5(str(account.user.id), MT5AccountSerializer(account).data)
            except Exception:
                logger.exception('Failed to broadcast MT5 live update for account %s', account.pk)

            # Auto-match positions/deals to active signals
            try:
                from .signal_matcher import match_account_to_signals
                matched = match_account_to_signals(account)
                if matched:
                    logger.info('Signal matcher: %d match(es) for account %s', matched, account.pk)
            except Exception:
                logger.exception('Signal matcher failed for account %s', account.pk)

            return account
        except mt5_service.MT5ConnectionError as e:
            account.status = 'error'
            account.error_message = str(e)
            account.last_error_at = timezone.now()
            account.save(update_fields=['status', 'error_message', 'last_error_at'])
            return account

    def get_summary(self):
        accounts = MT5Account.objects.all()
        connected = accounts.filter(status='connected').count()
        total_balance = sum(a.balance for a in accounts)
        total_equity = sum(a.equity for a in accounts)
        total_floating = sum(a.floating_pnl for a in accounts)
        return {
            'totalAccounts': accounts.count(),
            'connected': connected,
            'disconnected': accounts.count() - connected,
            'totalBalance': round(total_balance, 2),
            'totalEquity': round(total_equity, 2),
            'totalFloating': round(total_floating, 2),
        }

    def get_deals(self, account):
        return self.repository.get_deals_for_account(account)
