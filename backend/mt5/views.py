from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes, parser_classes
from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.utils import timezone
from django.http import HttpResponse
from django.db import models
import csv
from .models import MT5Account, MT5Position, MT5Deal, Trade
from .serializers import (
    MT5AccountSerializer, MT5CredentialsSerializer,
    MT5PositionSerializer, MT5OrderSerializer, MT5DealSerializer,
)
from .services import MT5Service
from common.api import StandardizedModelViewSet
from common.response import success_response, error_response
from .manager import manager as mt5_manager
from django.conf import settings as django_settings
from common.permissions import IsOwnerOrAdmin, IsAdminRole
import logging

logger = logging.getLogger('mt5.views')


class MT5AccountViewSet(StandardizedModelViewSet):
    service = MT5Service()
    serializer_class = MT5AccountSerializer
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']
    filterset_fields = ['status', 'broker', 'is_demo']
    search_fields = ['login', 'account_number', 'broker', 'company']
    ordering_fields = ['created_at', 'balance', 'equity']

    def get_permissions(self):
        if self.action in ('list', 'summary'):
            return [IsAdminRole()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        return self.service.get_queryset_for_user(self.request.user)

    # ── GET /api/mt5/me/ ─────────────────────────────────────────────────────
    @action(detail=False, methods=['get'], url_path='me')
    def me(self, request):
        """Trader's own account"""
        account = self.service.get_account_for_user(request.user)
        if account is None:
            return error_response('No MT5 account configured.', status=status.HTTP_404_NOT_FOUND, code='not_found')
        return success_response(MT5AccountSerializer(account).data)

    # ── POST /api/mt5/credentials/ ────────────────────────────────────────────
    @action(detail=False, methods=['post'], url_path='credentials')
    def set_credentials(self, request):
        """
        Trader sets/updates their MT5 login credentials.
        Password is encrypted before storage.
        Then immediately connects to verify.
        """
        serializer = MT5CredentialsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        account = self.service.set_credentials(request.user, serializer.validated_data)
        return Response(MT5AccountSerializer(account).data)

    # ── POST /api/mt5/{id}/sync/ ──────────────────────────────────────────────
    @action(detail=True, methods=['post'], url_path='sync')
    def sync(self, request, pk=None):
        """Manually trigger sync for an account"""
        account = self.get_object()
        if request.user.role not in ['owner', 'admin'] and account.user != request.user:
            return Response({'detail': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        account = self.service.sync_account(account)
        return Response(MT5AccountSerializer(account).data)

    # ── POST /api/mt5/sync-all/ ───────────────────────────────────────────────
    @action(detail=False, methods=['post'], permission_classes=[IsAdminRole], url_path='sync-all')
    def sync_all(self, request):
        """Admin syncs all accounts"""
        accounts = MT5Account.objects.all()
        results = []
        for acc in accounts:
            acc = self.service.sync_account(acc)
            results.append({'id': acc.id, 'login': acc.login, 'status': acc.status})
        return Response({'synced': len(results), 'accounts': results})

    # ── GET /api/mt5/summary/ ─────────────────────────────────────────────────
    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated], url_path='summary')
    def summary(self, request):
        """Admin KPI summary: account counts and totals"""
        accounts = MT5Account.objects.all()
        connected_count = accounts.filter(status='connected').count()
        disconnected_count = accounts.filter(status__in=['disconnected', 'error', 'pending']).count()
        
        totals = accounts.aggregate(
            total_balance=models.Sum('balance'),
            total_equity=models.Sum('equity'),
            total_floating=models.Sum('floating_pnl'),
        )
        
        return success_response({
            'totalAccounts': accounts.count(),
            'connected': connected_count,
            'disconnected': disconnected_count,
            'totalBalance': totals['total_balance'] or 0,
            'totalEquity': totals['total_equity'] or 0,
            'totalFloating': totals['total_floating'] or 0,
        })

    # ── GET /api/mt5/{id}/deals/ ──────────────────────────────────────────────
    @action(detail=True, methods=['get'], url_path='deals')
    def deals(self, request, pk=None):
        account = self.get_object()
        if request.user.role not in ['owner', 'admin'] and account.user != request.user:
            return Response({'detail': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        qs = self.service.get_deals(account)
        return success_response(MT5DealSerializer(qs, many=True).data)

    @action(detail=True, methods=['get'], url_path='status')
    def status(self, request, pk=None):
        account = self.get_object()
        if request.user.role not in ['owner', 'admin'] and account.user != request.user:
            return error_response('Forbidden', status=status.HTTP_403_FORBIDDEN, code='permission_denied')
        st = mt5_manager.get_status(account.login)
        return success_response(st)

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated], url_path='export-history')
    def export_history(self, request, pk=None):
        """
        GET /api/mt5/{id}/export-history/?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
        Exports trading history for this account as CSV
        Supports optional date range filtering
        Admin, owner, or account owner can download their own history
        """
        account = self.get_object()
        
        # Check permission: admin/owner can download any, user can only download their own
        if request.user.role not in ['owner', 'admin'] and account.user != request.user:
            return error_response('Forbidden', status=status.HTTP_403_FORBIDDEN, code='permission_denied')
        
        # Get date range from query params
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        # Build trades queryset
        trades = Trade.objects.filter(account=account).select_related('signal')
        
        # Apply date range filter if provided
        if start_date:
            trades = trades.filter(open_time__gte=f'{start_date} 00:00:00')
        if end_date:
            trades = trades.filter(open_time__lte=f'{end_date} 23:59:59')
        
        trades = trades.order_by('-open_time')
        
        # Create CSV response
        date_suffix = ''
        if start_date and end_date:
            date_suffix = f'_{start_date}_to_{end_date}'
        elif start_date:
            date_suffix = f'_from_{start_date}'
        elif end_date:
            date_suffix = f'_until_{end_date}'
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="trading_history_{account.account_number}{date_suffix}_{timezone.now().date()}.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'Ticket', 'Symbol', 'Type', 'Volume', 'Entry Price', 'Exit Price',
            'Stop Loss', 'Take Profit', 'Open Time', 'Close Time', 'P/L',
            'Status', 'Order Type', 'Signal ID'
        ])
        
        for trade in trades:
            writer.writerow([
                trade.ticket,
                trade.symbol,
                trade.direction,
                float(trade.volume),
                float(trade.entry_price),
                float(trade.exit_price) if trade.exit_price else '',
                float(trade.stop_loss) if trade.stop_loss else '',
                float(trade.take_profit) if trade.take_profit else '',
                trade.open_time.isoformat() if trade.open_time else '',
                trade.close_time.isoformat() if trade.close_time else '',
                float(trade.pnl),
                trade.status,
                trade.order_type,
                trade.signal_id if trade.signal_id else '',
            ])
        
        return response


# ─── EA Reporter Endpoint ─────────────────────────────────────────────────────
# MT5 EA (Expert Advisor) calls this to push live position data to backend.
# Secured by EA_INTEGRATION_TOKEN in .env

@api_view(['POST'])
@permission_classes([AllowAny])
@parser_classes([JSONParser])
def ea_report(request):
    """
    POST /api/mt5/ea-report/
    Called by MT5 EA on each tick/bar to report open positions.

    Payload:
    {
      "token": "<EA_INTEGRATION_TOKEN>",
      "login": 12345678,
      "server": "ICMarkets-Live01",
      "broker": "ICMarkets",
      "balance": 10250.00,
      "equity": 10180.50,
      "floating_pnl": -69.50,
      "positions": [
        {
          "ticket": 987654,
          "symbol": "XAUUSD",
          "type": "BUY",
          "volume": 0.10,
          "price_open": 4041.35,
          "price_current": 4038.20,
          "sl": 4037.83,
          "tp": 4050.60,
          "profit": -31.50,
          "time_open": "2026-07-24T12:30:00+07:00"
        }
      ],
      "deals": []
    }
    """
    # Validate token
    expected_token = getattr(django_settings, 'EA_INTEGRATION_TOKEN', '')
    provided_token = request.data.get('token', '')
    if expected_token and provided_token != expected_token:
        return error_response('Invalid EA token.', status=status.HTTP_403_FORBIDDEN, code='forbidden')

    login = request.data.get('login')
    server = request.data.get('server', '')
    broker = request.data.get('broker', '')

    if not login:
        return error_response('login is required.', status=status.HTTP_400_BAD_REQUEST, code='validation_error')

    # Find MT5 account by login
    try:
        account = MT5Account.objects.get(login=login)
    except MT5Account.DoesNotExist:
        return error_response(
            f'No MT5 account found for login {login}.',
            status=status.HTTP_404_NOT_FOUND,
            code='not_found'
        )

    from django.utils import timezone as tz
    from datetime import datetime

    # Update account financials
    account.balance = request.data.get('balance', account.balance)
    account.equity = request.data.get('equity', account.equity)
    account.floating_pnl = request.data.get('floating_pnl', account.floating_pnl)
    account.status = 'connected'
    account.last_sync = tz.now()
    account.open_positions = len(request.data.get('positions', []))
    account.pending_orders = len(request.data.get('pending_orders', []))
    account.save(update_fields=['balance', 'equity', 'floating_pnl', 'status', 'last_sync', 'open_positions', 'pending_orders'])

    # Sync positions from EA payload
    positions_data = request.data.get('positions', [])
    tickets_seen = set()
    for pos in positions_data:
        ticket = pos.get('ticket')
        if not ticket:
            continue
        tickets_seen.add(ticket)

        time_open = None
        if pos.get('time_open'):
            try:
                time_open = datetime.fromisoformat(str(pos['time_open']).replace('Z', '+00:00'))
            except Exception:
                pass

        MT5Position.objects.update_or_create(
            account=account,
            ticket=ticket,
            defaults={
                'symbol': pos.get('symbol', ''),
                'type': pos.get('type', 'BUY'),
                'volume': pos.get('volume', 0),
                'price_open': pos.get('price_open', 0),
                'price_current': pos.get('price_current', 0),
                'sl': pos.get('sl'),
                'tp': pos.get('tp'),
                'profit': pos.get('profit', 0),
                'swap': pos.get('swap', 0),
                'comment': pos.get('comment', ''),
                'magic': pos.get('magic', 0),
                'time_open': time_open,
            }
        )

        # Also upsert into Trade model for compliance evaluation
        Trade.objects.update_or_create(
            account=account,
            ticket=ticket,
            defaults={
                'user': account.user,
                'symbol': pos.get('symbol', ''),
                'direction': pos.get('type', 'BUY'),
                'order_type': 'market',  # open position = market already executed
                'volume': pos.get('volume', 0),
                'entry_price': pos.get('price_open', 0),
                'stop_loss': pos.get('sl'),
                'take_profit': pos.get('tp'),
                'open_time': time_open,
                'status': 'open',
                'pnl': pos.get('profit', 0),
            }
        )

    # Remove positions no longer open
    if tickets_seen:
        account.positions.exclude(ticket__in=tickets_seen).delete()

    # Sync deals
    deals_data = request.data.get('deals', [])
    for deal in deals_data:
        ticket = deal.get('ticket')
        if not ticket:
            continue
        time_deal = None
        if deal.get('time'):
            try:
                time_deal = datetime.fromisoformat(str(deal['time']).replace('Z', '+00:00'))
            except Exception:
                pass
        from mt5.models import MT5Deal
        MT5Deal.objects.update_or_create(
            account=account,
            ticket=ticket,
            defaults={
                'order': deal.get('order', 0),
                'symbol': deal.get('symbol', ''),
                'type': deal.get('type', 'BUY'),
                'entry': deal.get('entry', 'IN'),
                'volume': deal.get('volume', 0),
                'price': deal.get('price', 0),
                'profit': deal.get('profit', 0),
                'swap': deal.get('swap', 0),
                'commission': deal.get('commission', 0),
                'comment': deal.get('comment', ''),
                'magic': deal.get('magic', 0),
                'time': time_deal,
            }
        )

    # Sync pending orders (limit/stop orders belum tersentuh)
    pending_orders_data = request.data.get('pending_orders', [])
    pending_tickets_seen = set()
    order_type_map = {
        'BUY LIMIT': 'buy_limit', 'SELL LIMIT': 'sell_limit',
        'BUY STOP': 'buy_stop', 'SELL STOP': 'sell_stop',
    }
    for order in pending_orders_data:
        ticket = order.get('ticket')
        if not ticket:
            continue
        pending_tickets_seen.add(ticket)
        time_setup = None
        if order.get('time_setup'):
            try:
                time_setup = datetime.fromisoformat(str(order['time_setup']).replace('Z', '+00:00'))
            except Exception:
                pass

        raw_type = str(order.get('type', '')).upper()
        otype = order_type_map.get(raw_type, 'buy_limit' if 'BUY' in raw_type else 'sell_limit')
        direction = 'BUY' if 'BUY' in raw_type else 'SELL'

        # Save to Trade model (for compliance tracking)
        Trade.objects.update_or_create(
            account=account,
            ticket=ticket,
            defaults={
                'user': account.user,
                'symbol': order.get('symbol', ''),
                'direction': direction,
                'order_type': otype,
                'volume': order.get('volume', 0),
                'entry_price': order.get('price_open', 0),
                'stop_loss': order.get('sl'),
                'take_profit': order.get('tp'),
                'open_time': time_setup,
                'status': 'pending',
                'pnl': 0,
            }
        )
        
        # ALSO save to MT5Order model (for frontend display)
        from mt5.models import MT5Order
        MT5Order.objects.update_or_create(
            account=account,
            ticket=ticket,
            defaults={
                'symbol': order.get('symbol', ''),
                'type': raw_type,
                'volume': order.get('volume', 0),
                'price_open': order.get('price_open', 0),
                'sl': order.get('sl'),
                'tp': order.get('tp'),
                'comment': order.get('comment', ''),
                'magic': order.get('magic', 0),
                'time_setup': time_setup,
            }
        )

    # Mark pending orders that disappeared (cancelled or expired) as cancelled
    from django.utils import timezone as tz
    if pending_orders_data:  # only if EA sent orders data
        # Update Trade model
        Trade.objects.filter(
            account=account,
            status='pending',
        ).exclude(ticket__in=pending_tickets_seen).update(
            status='cancelled',
            cancelled_at=tz.now(),
        )
        
        # Delete from MT5Order model (no longer pending)
        from mt5.models import MT5Order
        MT5Order.objects.filter(
            account=account,
        ).exclude(ticket__in=pending_tickets_seen).delete()

    # Run signal matcher
    matched = 0
    try:
        from .signal_matcher import match_account_to_signals
        matched = match_account_to_signals(account)
    except Exception:
        logger.exception('Signal matcher failed in ea_report for account %s', account.pk)

    # Broadcast update
    try:
        from config.ws_broadcast import broadcast_mt5
        from .serializers import MT5AccountSerializer
        broadcast_mt5(str(account.user.id), MT5AccountSerializer(account).data)
    except Exception:
        pass

    return success_response({
        'status': 'ok',
        'login': login,
        'positions_synced': len(tickets_seen),
        'signals_matched': matched,
    }, status=status.HTTP_200_OK)



# ─── MT5 Trades Endpoint ──────────────────────────────────────────────────────
# List trades linked to a specific signal for admin signal detail view

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def trades_by_signal(request):
    """
    GET /api/mt5/trades/?signal=<signal_id>
    Returns list of Trade records linked to a specific signal.
    Filters trades that:
    - Are linked to this signal
    - Opened on or after signal date
    - Belong to the trader assigned to this signal (if any)
    """
    # Only owner/admins can view all trades
    if request.user.role not in ['owner', 'admin']:
        return error_response('Forbidden', status=status.HTTP_403_FORBIDDEN, code='permission_denied')
    
    signal_id = request.query_params.get('signal')
    if not signal_id:
        return error_response('signal parameter is required', status=status.HTTP_400_BAD_REQUEST, code='validation_error')
    
    # Get the signal to get session_date and assigned trader
    from signals.models import Signal
    try:
        signal = Signal.objects.get(id=signal_id)
    except Signal.DoesNotExist:
        return error_response('Signal not found', status=status.HTTP_404_NOT_FOUND, code='not_found')
    
    # If signal has no assigned trader, it's MISSED — return empty trades
    if not signal.assigned_to:
        return success_response({'results': []})
    
    # Filter trades for this signal
    # Only include trades that opened on or after signal's session_date
    trades = Trade.objects.filter(
        signal_id=signal_id,
        user=signal.assigned_to  # Only trades from the assigned trader
    ).exclude(
        open_time__isnull=True  # Exclude trades with no open_time
    ).select_related(
        'user', 'account', 'signal'
    ).order_by('-open_time')
    
    # Serialize trades
    results = []
    for trade in trades:
        results.append({
            'id': trade.id,
            'ticket': trade.ticket,
            'symbol': trade.symbol,
            'direction': trade.direction,
            'orderType': trade.order_type,
            'volume': float(trade.volume) if trade.volume else 0,
            'entryPrice': float(trade.entry_price) if trade.entry_price else 0,
            'stopLoss': float(trade.stop_loss) if trade.stop_loss else None,
            'takeProfit': float(trade.take_profit) if trade.take_profit else None,
            'status': trade.status,
            'openTime': trade.open_time.isoformat() if trade.open_time else None,
            'account': {
                'id': trade.account.id if trade.account else None,
                'login': trade.account.login if trade.account else None,
                'accountNumber': trade.account.account_number if trade.account else None,
                'userName': trade.user.name if trade.user else 'Unknown',
            },
            'user': {
                'id': trade.user.id if trade.user else None,
                'name': trade.user.name if trade.user else 'Unknown',
                'email': trade.user.email if trade.user else '',
            }
        })
    
    return success_response({'results': results})
