import hmac
import hashlib
import logging
from datetime import datetime, timedelta

from django.core.cache import cache
from django.utils import timezone
from django.conf import settings as django_settings

logger = logging.getLogger('signals.webhook')


def _get_secret_from_settings():
    # Keep logic small here; service will also validate if needed.
    secret = getattr(django_settings, 'TRADINGVIEW_WEBHOOK_SECRET', '')
    return secret


def verify_signature(request, allowed_skew_seconds=600):
    """Verify HMAC-SHA256 signature if headers are present.

    Expected headers (optional):
    - X-Signature: hex HMAC-SHA256 of the raw body using the shared secret
    - X-Timestamp: unix epoch seconds when the signature was created

    Returns: (ok: bool, reason: str)
    """
    secret = _get_secret_from_settings()
    if not secret:
        # No secret configured — fall back to payload 'secret' field.
        return (False, 'no_secret_configured')

    sig = request.META.get('HTTP_X_SIGNATURE') or request.META.get('HTTP_X_TV_SIGNATURE')
    ts = request.META.get('HTTP_X_TIMESTAMP') or request.META.get('HTTP_X_TV_TIMESTAMP')

    if not sig:
        return (False, 'no_signature')

    try:
        raw = request.body or b''
        computed = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    except Exception as e:
        logger.exception('Failed computing HMAC for webhook: %s', e)
        return (False, 'hmac_error')

    if not hmac.compare_digest(computed, sig):
        return (False, 'invalid_signature')

    # Timestamp check — only log, never reject.
    # TradingView does not guarantee accurate timestamps.
    if ts:
        try:
            ts_int = int(ts)
            now_ts = int(datetime.utcnow().timestamp())
            skew = abs(now_ts - ts_int)
            if skew > allowed_skew_seconds:
                logger.warning('Webhook timestamp skew %ds (allowed %ds) — accepting anyway', skew, allowed_skew_seconds)
        except Exception:
            pass

    # Replay prevention — only when timestamp present
    if ts:
        cache_key = f"tv_webhook_sig:{sig}"
        if cache.get(cache_key):
            return (False, 'replay_detected')
        cache.set(cache_key, True, timeout=allowed_skew_seconds)

    return (True, 'ok')


def is_duplicate_signal(data, within_minutes=10):
    """Duplicate detection based on actual entry prices + pair/direction/timeframe.

    Two signals are duplicates if they have the same pair, direction, timeframe,
    AND the same entry prices (fib_0236/0500/0618) within the time window.
    This prevents re-processing the same TradingView alert fired multiple times,
    while still allowing new signals on the same pair after price moves.
    """
    from .models import Signal
    now = timezone.localtime()
    window = now - timedelta(minutes=within_minutes)

    filters = dict(
        pair=data.get('pair'),
        timeframe=data.get('timeframe', '15'),
        direction=data.get('direction'),
        created_at__gte=window,
    )

    # Only include entry price filters when values are present and non-zero
    fib_0236 = data.get('fib_0236')
    fib_0500 = data.get('fib_0500')
    fib_0618 = data.get('fib_0618')

    if fib_0236:
        filters['fib_0236'] = fib_0236
    if fib_0500:
        filters['fib_0500'] = fib_0500
    if fib_0618:
        filters['fib_0618'] = fib_0618

    # If no entry prices available, fall back to stop_loss + take_profit combo
    if not any([fib_0236, fib_0500, fib_0618]):
        sl = data.get('stop_loss')
        tp = data.get('take_profit')
        if sl:
            filters['stop_loss'] = sl
        if tp:
            filters['take_profit'] = tp

    return Signal.objects.filter(**filters).exists()
