import hashlib
import hmac
from datetime import timedelta

from django.conf import settings as django_settings
from django.utils import timezone

from notifications.models import Notification
from .models import Signal
from .repositories import SignalRepository
from .rules.engine import ComplianceEngine
from .rules.direction import DirectionRule
from .rules.fib_entry import FibEntryRule
from .rules.take_profit import TakeProfitRule
from .rules.stop_loss import StopLossRule
from .rules.lot_size import LotSizeRule
from .rules.timing import TimingRule


class SignalService:
    def __init__(self, repository: SignalRepository | None = None):
        self.repository = repository or SignalRepository()

    def get_queryset_for_request(self, request):
        return self.repository.get_queryset_for_request(request)

    def create_from_webhook(self, data: dict, request) -> Signal:
        # Use the secret already resolved by Django settings (loaded from .env)
        webhook_secret = getattr(django_settings, 'TRADINGVIEW_WEBHOOK_SECRET', '') or ''
        provided_secret = data.get('secret', '')
        secret_valid = self._validate_secret(provided_secret, webhook_secret)

        if webhook_secret and not secret_valid:
            raise PermissionError('Invalid webhook secret.')

        now = timezone.localtime()

        # ── issued_at: use bar_time from TradingView if provided ─────────────
        # bar_time = candle close time sent by Pine Script (e.g. "2026-07-24 20:45")
        # This is the ACTUAL signal time, not the webhook arrival time.
        bar_time_str = data.get('bar_time', '')
        issued_time = None
        if bar_time_str:
            from datetime import datetime as _dt
            import re
            # Try several common formats, prefer exact 'YYYY-MM-DD HH:MM'
            tried = False
            for fmt in ('%Y-%m-%d %H:%M', '%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%dT%H:%M:%S%z'):
                try:
                    parsed = _dt.strptime(bar_time_str.strip(), fmt)
                    tried = True
                    break
                except Exception:
                    parsed = None
            # If parsing failed, try to extract a YYYY-MM-DD HH:MM substring
            if not parsed:
                m = re.search(r"(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2})", bar_time_str)
                if m:
                    try:
                        parsed = _dt.strptime(m.group(1), '%Y-%m-%d %H:%M')
                        tried = True
                    except Exception:
                        parsed = None

            if parsed:
                try:
                    # Make timezone-aware in Django's configured timezone
                    import pytz
                    local_tz = pytz.timezone(django_settings.TIME_ZONE)
                    issued_dt = local_tz.localize(parsed)
                    issued_time = issued_dt.time().replace(second=0, microsecond=0)
                    # Override 'now' to be based on the candle close time for accurate window calc
                    now = issued_dt
                except Exception:
                    issued_time = None

        if issued_time is None:
            issued_time = now.time().replace(second=0, microsecond=0)

        max_entry_minutes = data.get('max_entry_minutes', 5)  # default 5 menit
        max_entry_dt = now + timedelta(minutes=max_entry_minutes)
        max_entry_time = max_entry_dt.time().replace(second=0, microsecond=0)

        # expires_at = candle close + 15 menit (= candle berikutnya close)
        # Trader yang tidak entry sampai 15 menit setelah signal = Missed
        missed_after_minutes = 15
        expires_at = now + timedelta(minutes=missed_after_minutes)

        # Resolve entry prices — fib_0236/0500/0618 are the 3 entry points
        fib_0236 = data.get('fib_0236')
        fib_0500 = data.get('fib_0500')
        fib_0618 = data.get('fib_0618')
        take_profit = data.get('take_profit') or data.get('fib_tp') or 0.0
        stop_loss = data.get('stop_loss') or 0.0
        # fib_tp mirrors take_profit (the -0.27 extension level)
        fib_tp = data.get('fib_tp') or take_profit
        # fib_entry is informational — use 0.5 as the mid-entry label
        fib_entry = data.get('fib_entry', 0.5)

        # Create a lightweight object for rule evaluation
        class _Tmp:
            pass

        tmp = _Tmp()
        tmp.symbol = data.get('symbol')
        tmp.pair = data.get('pair')
        tmp.direction = data.get('direction')
        tmp.timeframe = data.get('timeframe', '15')
        tmp.strategy_name = data.get('strategy', 'Fibonacci Strategy')
        tmp.fib_entry = fib_entry
        tmp.take_profit = take_profit
        tmp.stop_loss = stop_loss
        tmp.fib_0236 = fib_0236
        tmp.fib_0500 = fib_0500
        tmp.fib_0618 = fib_0618
        tmp.fib_tp = fib_tp
        tmp.issued_at = issued_time
        tmp.max_entry_time = max_entry_time

        # Run modular compliance engine
        engine = ComplianceEngine(rules=[
            DirectionRule(), FibEntryRule(), TakeProfitRule(), StopLossRule(), LotSizeRule(), TimingRule()
        ])
        compliance_result = engine.evaluate(tmp)

        # attach compliance evaluation to webhook payload for later processing
        payload = dict(request.data)
        payload['compliance_checks'] = compliance_result

        signal = self.repository.create(
            symbol=data['symbol'],
            pair=data['pair'],
            direction=data['direction'],
            timeframe=data.get('timeframe', '15'),
            strategy_name=data.get('strategy', 'Fibonacci Strategy'),
            fib_entry=fib_entry,
            take_profit=take_profit,
            stop_loss=stop_loss,
            fib_0236=fib_0236,
            fib_0500=fib_0500,
            fib_0618=fib_0618,
            fib_tp=fib_tp,
            issued_at=issued_time,
            session_date=now.date(),
            max_entry_time=max_entry_time,
            expires_at=expires_at,
            status='Pending',
            webhook_payload=request.data,
            webhook_secret_valid=secret_valid,
            source_ip=self._get_client_ip(request),
        )
        self._notify_signal_created(signal)
        try:
            create_meta = {'webhook_secret_valid': secret_valid, 'compliance': compliance_result}
            # request may be an HttpRequest; actor is None for anonymous webhooks
            from audit_logs.utils import create_audit
            create_audit(action='signal.created', category='signal', severity='info', request=request, target=signal, metadata=create_meta)
        except Exception:
            pass
        return signal

    def create_manual_signal(self, data: dict, request) -> Signal:
        now = timezone.localtime()
        max_entry_minutes = data.get('max_entry_minutes', 5)  # default 5 menit
        max_entry_dt = now + timedelta(minutes=max_entry_minutes)
        expires_at = now + timedelta(minutes=15)  # 15 menit = candle berikutnya
        return self.repository.create(
            symbol=data['symbol'],
            pair=data['pair'],
            direction=data['direction'],
            timeframe=data.get('timeframe', '15'),
            strategy_name=data.get('strategy', 'Fibonacci Strategy'),
            fib_entry=data['fib_entry'],
            take_profit=data['take_profit'],
            stop_loss=data['stop_loss'],
            fib_0236=data.get('fib_0236'),
            fib_0500=data.get('fib_0500'),
            fib_0618=data.get('fib_0618'),
            fib_tp=data.get('fib_tp'),
            issued_at=now.time().replace(second=0, microsecond=0),
            session_date=now.date(),
            max_entry_time=max_entry_dt.time().replace(second=0, microsecond=0),
            expires_at=expires_at,
            status='Pending',
            webhook_payload={},
            webhook_secret_valid=True,
            source_ip=self._get_client_ip(request),
        )
        # Note: callers of create_manual_signal should log the action (they have request/user context)

    def update_status(self, signal: Signal, new_status: str) -> Signal:
        if new_status and new_status in dict(Signal.STATUS_CHOICES):
            return self.repository.update_status(signal, new_status)
        return signal

    def _notify_signal_created(self, signal: Signal):
        try:
            # Create notification record then offload broadcasting to Celery
            notif = Notification.objects.create(
                type='signal',
                title=f"New signal: {signal.pair} {signal.direction} @ Fib {signal.fib_entry}",
                level='info',
            )
            # Import task here to avoid top-level Celery dependency during imports
            try:
                from signals.tasks import handle_new_signal
                handle_new_signal.delay(signal.id, notif.id)
            except Exception:
                # Fallback to synchronous broadcast if Celery not available
                from config.ws_broadcast import broadcast_signal, broadcast_notification
                from notifications.serializers import NotificationSerializer
                from signals.serializers import SignalSerializer
                broadcast_signal(SignalSerializer(signal).data)
                broadcast_notification(NotificationSerializer(notif).data)
        except Exception:
            pass

    def _get_client_ip(self, request) -> str:
        x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded:
            return x_forwarded.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', '')

    def _validate_secret(self, provided: str, expected: str) -> bool:
        if not expected:
            return True
        return hmac.compare_digest(provided.encode(), expected.encode())
