from django.db.models import QuerySet

from compliance.services import ComplianceService
from .models import MT5Account, MT5Deal, MT5Position, MT5Order


class MT5Repository:
    def get_queryset(self) -> QuerySet:
        return MT5Account.objects.select_related('user').prefetch_related('positions', 'orders')

    def get_queryset_for_user(self, user) -> QuerySet:
        qs = self.get_queryset()
        if getattr(user, 'role', None) in ['owner', 'admin']:
            return qs
        return qs.filter(user=user)

    def get_account_for_user(self, user) -> MT5Account | None:
        return self.get_queryset().filter(user=user).first()

    def get_by_id(self, pk) -> MT5Account | None:
        return self.get_queryset().filter(pk=pk).first()

    def get_deals_for_account(self, account, limit: int = 100) -> QuerySet:
        return MT5Deal.objects.filter(account=account).order_by('-time')[:limit]

    def create_or_update_account(self, user, **defaults) -> tuple[MT5Account, bool]:
        account = self.get_queryset().filter(user=user).first()
        if account is not None:
            for field, value in defaults.items():
                setattr(account, field, value)
            account.save()
            return account, False

        return MT5Account.objects.create(user=user, **defaults), True

    def sync_positions(self, account, payload):
        for pos_data in payload:
            from datetime import datetime
            time_open = None
            if pos_data.get('time_open'):
                try:
                    time_open = datetime.fromisoformat(pos_data['time_open'])
                except Exception:
                    pass
            MT5Position.objects.update_or_create(
                account=account,
                ticket=pos_data['ticket'],
                defaults={
                    'symbol': pos_data['symbol'],
                    'type': pos_data['type'],
                    'volume': pos_data['volume'],
                    'price_open': pos_data['price_open'],
                    'price_current': pos_data['price_current'],
                    'sl': pos_data.get('sl'),
                    'tp': pos_data.get('tp'),
                    'profit': pos_data['profit'],
                    'swap': pos_data.get('swap', 0),
                    'comment': pos_data.get('comment', ''),
                    'magic': pos_data.get('magic', 0),
                    'time_open': time_open,
                },
            )

    def prune_positions(self, account, keep_tickets: set):
        MT5Position.objects.filter(account=account).exclude(ticket__in=keep_tickets).delete()

    def sync_orders(self, account, payload):
        for od in payload:
            from datetime import datetime
            time_setup = None
            if od.get('time_setup'):
                try:
                    time_setup = datetime.fromisoformat(od['time_setup'])
                except Exception:
                    pass
            MT5Order.objects.update_or_create(
                account=account,
                ticket=od['ticket'],
                defaults={
                    'symbol': od['symbol'],
                    'type': od['type'],
                    'volume': od['volume'],
                    'price_open': od['price_open'],
                    'sl': od.get('sl'),
                    'tp': od.get('tp'),
                    'comment': od.get('comment', ''),
                    'magic': od.get('magic', 0),
                    'time_setup': time_setup,
                },
            )

    def prune_orders(self, account, keep_tickets: set):
        MT5Order.objects.filter(account=account).exclude(ticket__in=keep_tickets).delete()

    def sync_deals(self, account, payload):
        for dd in payload:
            from datetime import datetime
            deal_time = None
            if dd.get('time'):
                try:
                    deal_time = datetime.fromisoformat(dd['time'])
                except Exception:
                    pass
            deal, created = MT5Deal.objects.get_or_create(
                account=account,
                ticket=dd['ticket'],
                defaults={
                    'order': dd.get('order', 0),
                    'symbol': dd['symbol'],
                    'type': dd['type'],
                    'entry': dd.get('entry', 'IN'),
                    'volume': dd['volume'],
                    'price': dd['price'],
                    'profit': dd.get('profit', 0),
                    'swap': dd.get('swap', 0),
                    'commission': dd.get('commission', 0),
                    'comment': dd.get('comment', ''),
                    'magic': dd.get('magic', 0),
                    'time': deal_time,
                },
            )

            if created:
                self._sync_trade_from_deal(account, deal)

    def _sync_trade_from_deal(self, account, deal):
        from mt5.models import Trade
        from signals.models import Signal

        signal = Signal.objects.filter(pair=deal.symbol).order_by('-created_at').first()
        if not signal:
            return

        trade, created = Trade.objects.get_or_create(
            account=account,
            ticket=deal.ticket,
            defaults={
                'user': account.user,
                'trader_profile': account.trader_profile,
                'signal': signal,
                'symbol': deal.symbol,
                'direction': deal.type,
                'volume': deal.volume,
                'entry_price': deal.price,
                'open_time': deal.time,
                'status': 'open',
            },
        )

        if not created:
            trade.signal = signal
            trade.symbol = deal.symbol
            trade.direction = deal.type
            trade.volume = deal.volume
            trade.entry_price = deal.price
            trade.open_time = deal.time
            trade.status = 'open'
            trade.save(update_fields=['signal', 'symbol', 'direction', 'volume', 'entry_price', 'open_time', 'status'])

        ComplianceService().sync_trade_to_compliance(trade)
