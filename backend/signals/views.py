import hmac
import hashlib
from datetime import timedelta, datetime
from django.utils import timezone
from django.conf import settings as django_settings
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import JSONParser
from .parsers import PlainTextJSONParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .models import Signal
from .serializers import SignalSerializer, WebhookSignalSerializer
from .services import SignalService
from .webhook_utils import verify_signature, is_duplicate_signal
import logging
logger = logging.getLogger('signals.webhook')
from common.api import StandardizedModelViewSet, StandardizedReadOnlyModelViewSet
from common.response import success_response, error_response
from audit_logs.utils import create_audit


class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'


# ─── Webhook endpoint ─────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
@parser_classes([JSONParser, PlainTextJSONParser])
def tradingview_webhook(request):
    """
    POST /api/signals/webhook/
    Receives Pine Script alert from TradingView.
    No JWT required — secured by shared secret in payload.
    """
    # Read raw body early so we can verify HMAC and accept non-JSON content-types
    import json
    try:
        raw = request.body or b''
    except Exception:
        raw = b''

    # Verify signature if present; falls back to payload secret when not configured.
    sig_ok, sig_reason = verify_signature(request)

    # Try to parse JSON from the raw body first (TradingView often sends text/plain)
    data = None
    if raw:
        try:
            data = json.loads(raw.decode('utf-8'))
        except Exception:
            data = None

    # Fall back to DRF-parsed data if JSON parsing from raw body failed
    if data is None:
        data = request.data

    serializer = WebhookSignalSerializer(data=data)
    if not serializer.is_valid():
        # Log validation errors and raw payload to help diagnose TradingView issues
        try:
            logger.warning('Webhook payload validation failed: %s', serializer.errors)
            logger.debug('Raw webhook body: %s', raw)
        except Exception:
            pass
        return error_response('Invalid payload', status=status.HTTP_400_BAD_REQUEST, code='validation_error', details=serializer.errors)

    data = serializer.validated_data
    if not sig_ok and sig_reason != 'no_secret_configured' and sig_reason != 'no_signature':
        return error_response('Webhook signature validation failed.', status=status.HTTP_403_FORBIDDEN, code=sig_reason)

    # Prevent duplicate signals
    try:
        if is_duplicate_signal(data, within_minutes=data.get('max_entry_minutes', 10)):
            return error_response('Duplicate signal detected within recent window.', status=status.HTTP_200_OK, code='duplicate')
    except Exception:
        # If duplicate check fails for any reason, log and continue to avoid dropping valid signals
        import logging
        logging.getLogger('signals.webhook').exception('Duplicate check failed')

    service = SignalService()

    # If signature validated, ensure service records webhook as valid by populating 'secret'
    if sig_ok:
        # mirror service secret resolution
        from app_settings.models import SystemSettings
        app_settings = SystemSettings.get()
        webhook_secret = getattr(django_settings, 'TRADINGVIEW_WEBHOOK_SECRET', app_settings.telegram_bot_token)
        data['secret'] = webhook_secret or data.get('secret', '')

    try:
        signal = service.create_from_webhook(data, request)
    except PermissionError:
        return error_response('Invalid webhook secret.', status=status.HTTP_403_FORBIDDEN, code='forbidden')

    # Audit webhook reception
    try:
        create_audit(action='signal.webhook_received', category='signal', severity='info', request=request, metadata={'pair': data.get('pair'), 'symbol': data.get('symbol')})
    except Exception:
        pass

    return success_response(
        {
            'detail': 'Signal received.',
            'signal_id': signal.id,
            'pair': signal.pair,
            'direction': signal.direction,
            'status': signal.status,
        },
        status=status.HTTP_201_CREATED,
    )


# ─── Test webhook (dev only) ──────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAdminRole])
def test_webhook(request):
    """
    POST /api/signals/test-webhook/
    Simulate a TradingView alert from the admin panel.
    Only available in DEBUG mode.
    """
    if not django_settings.DEBUG:
        return Response({'detail': 'Only available in DEBUG mode.'}, status=status.HTTP_403_FORBIDDEN)

    # Build test payload
    payload = {
        'symbol': request.data.get('symbol', 'OANDA:XAUUSD'),
        'pair':   request.data.get('pair',   'XAUUSD'),
        'direction': request.data.get('direction', 'BUY'),
        'timeframe': request.data.get('timeframe', '15'),
        'strategy': request.data.get('strategy', 'Fibonacci Strategy v6'),
        'fib_entry': request.data.get('fib_entry', 0.5),
        'take_profit': request.data.get('take_profit', 2412.4),
        'stop_loss': request.data.get('stop_loss', 2394.2),
        'fib_0236': request.data.get('fib_0236', 2394.2),
        'fib_0500': request.data.get('fib_0500', 2402.7),
        'fib_0618': request.data.get('fib_0618', 2408.4),
        'fib_tp':   request.data.get('fib_tp', 2412.4),
        'max_entry_minutes': 10,
        'expiry_minutes': 60,
    }

    # Call webhook view internally
    from django.test import RequestFactory
    factory = RequestFactory()
    import json
    fake_request = factory.post(
        '/api/signals/webhook/',
        data=json.dumps(payload),
        content_type='application/json',
    )
    fake_request.META['REMOTE_ADDR'] = '127.0.0.1 (test)'

    result = tradingview_webhook(fake_request)
    return result


# ─── Signal ViewSet (read + admin CRUD) ───────────────────────────────────────

class SignalViewSet(StandardizedModelViewSet):
    serializer_class = SignalSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['pair', 'direction', 'status', 'session_date', 'timeframe']
    search_fields = ['pair', 'symbol', 'strategy_name']
    ordering_fields = ['session_date', 'created_at', 'fib_entry']

    def get_queryset(self):
        if self.action in ('retrieve', 'update', 'partial_update', 'destroy'):
            return Signal.objects.all()
        return SignalService().get_queryset_for_request(self.request)

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAdminRole()]
        return [permissions.IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        """Admin manually creates a signal"""
        serializer = WebhookSignalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        signal = SignalService().create_manual_signal(serializer.validated_data, request)
        try:
            create_audit(actor=request.user, action='signal.created_manual', category='signal', severity='info', target=signal, metadata={'pair': signal.pair, 'symbol': signal.symbol})
        except Exception:
            pass
        return success_response(SignalSerializer(signal).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        """Admin updates signal status"""
        signal = self.get_object()
        updated_signal = SignalService().update_status(signal, request.data.get('status'))
        try:
            create_audit(actor=request.user, action='signal.status_update', category='signal', severity='info', target=updated_signal, metadata={'new_status': updated_signal.status})
        except Exception:
            pass
        return success_response(SignalSerializer(updated_signal).data)
