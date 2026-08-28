"""
Signal Status Scheduler
=======================
Uses APScheduler (no Redis required) to auto-update signal statuses
every minute directly inside the Django process.

Started automatically via signals/apps.py ready() hook.
"""
import logging
import threading

logger = logging.getLogger('signals.scheduler')

_scheduler = None
_lock = threading.Lock()


def start():
    """Start the APScheduler background thread. Safe to call multiple times."""
    global _scheduler

    with _lock:
        if _scheduler is not None and _scheduler.running:
            return  # already running

        try:
            from apscheduler.schedulers.background import BackgroundScheduler
            from apscheduler.triggers.interval import IntervalTrigger
            from django.conf import settings

            _scheduler = BackgroundScheduler(timezone=settings.TIME_ZONE)

            # ── Job 1: Auto-update signal statuses every 60 seconds ──────────
            _scheduler.add_job(
                _job_update_signal_statuses,
                trigger=IntervalTrigger(seconds=60),
                id='auto_update_signal_statuses',
                replace_existing=True,
                max_instances=1,
                misfire_grace_time=30,
            )

            # ── Job 2: Sweep expired signals for compliance every 5 minutes ──
            _scheduler.add_job(
                _job_sweep_expired_signals,
                trigger=IntervalTrigger(minutes=5),
                id='sweep_expired_signals',
                replace_existing=True,
                max_instances=1,
                misfire_grace_time=60,
            )

            _scheduler.start()
            logger.info('Signal scheduler started (APScheduler, no Redis required)')

        except Exception:
            logger.exception('Failed to start signal scheduler')


def stop():
    """Gracefully stop the scheduler."""
    global _scheduler
    with _lock:
        if _scheduler and _scheduler.running:
            _scheduler.shutdown(wait=False)
            logger.info('Signal scheduler stopped')


def _job_update_signal_statuses():
    """Auto-update Pending/Waiting signals based on timing windows."""
    try:
        from django.utils import timezone
        from signals.models import Signal
        from mt5.models import Trade

        now       = timezone.localtime()
        today     = now.date()
        now_time  = now.time()

        active = Signal.objects.filter(
            session_date=today,
            status__in=['Pending', 'Waiting'],
        )

        updated = 0
        for signal in active:
            try:
                tf_minutes = int(signal.timeframe)
            except (ValueError, TypeError):
                tf_minutes = 15

            if not signal.max_entry_time:
                continue

            new_status = None

            if now_time > signal.max_entry_time:
                # Past max entry — check if anyone executed
                executed = Trade.objects.filter(
                    signal=signal,
                    status__in=['open', 'closed'],
                ).exists()

                if executed:
                    new_status = 'Executed'
                elif signal.expires_at and now > signal.expires_at:
                    new_status = 'Missed'
                # else stays Waiting

            if new_status and new_status != signal.status:
                old = signal.status
                signal.status = new_status
                signal.save(update_fields=['status'])
                updated += 1

                # Broadcast live update via WebSocket
                try:
                    from config.ws_broadcast import broadcast_signal
                    from signals.serializers import SignalSerializer
                    broadcast_signal(SignalSerializer(signal).data)
                except Exception:
                    pass

                # Trigger compliance sweep when signal is Missed
                if new_status == 'Missed':
                    try:
                        _sweep_signal_compliance(signal)
                    except Exception:
                        pass

                logger.info('Signal #%d %s: %s → %s', signal.id, signal.pair, old, new_status)

        if updated:
            logger.info('auto_update_signal_statuses: %d signal(s) updated', updated)

    except Exception:
        logger.exception('_job_update_signal_statuses failed')


def _job_sweep_expired_signals():
    """Sweep all expired signals and create Missed compliance records."""
    try:
        from django.utils import timezone
        from signals.models import Signal
        from compliance.services import ComplianceService

        now       = timezone.localtime()
        today     = now.date()
        now_time  = now.time()

        expired = Signal.objects.filter(
            session_date=today,
            status__in=['Pending', 'Waiting'],
            max_entry_time__lt=now_time,
        )

        svc = ComplianceService()
        total = 0
        for signal in expired:
            if signal.expires_at and now < signal.expires_at:
                continue  # still in late window — not fully expired yet
            count = svc.process_expired_signal(signal)
            total += count

        if total:
            logger.info('sweep_expired_signals: %d compliance records created', total)

    except Exception:
        logger.exception('_job_sweep_expired_signals failed')


def _sweep_signal_compliance(signal):
    """Trigger compliance processing for a single just-expired signal."""
    from compliance.services import ComplianceService
    ComplianceService().process_expired_signal(signal)
