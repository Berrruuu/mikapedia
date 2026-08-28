from celery import shared_task
import logging

logger = logging.getLogger('compliance.tasks')


@shared_task(bind=True)
def process_compliance_for_signal(self, signal_id: int):
    """
    Evaluate all traders against a specific signal.
    Called when a signal is created or when its max_entry_time passes.
    """
    try:
        from signals.models import Signal
        from compliance.services import ComplianceService

        signal = Signal.objects.get(id=signal_id)
        svc = ComplianceService()
        processed = svc.process_expired_signal(signal)
        logger.info('process_compliance_for_signal: signal #%d → %d traders', signal_id, processed)
        return processed
    except Exception:
        logger.exception('process_compliance_for_signal failed for signal #%d', signal_id)
        raise


@shared_task(bind=True)
def sweep_expired_signals(self):
    """
    Periodic task: sweep all signals whose max_entry_time has passed today
    and haven't been fully evaluated yet.
    Run every 5 minutes via Celery Beat.
    """
    try:
        from django.utils import timezone
        from signals.models import Signal
        from compliance.services import ComplianceService

        now = timezone.localtime()
        current_time = now.time()
        today = now.date()

        # Find signals from today where max_entry_time has passed and still Pending/Waiting
        expired_signals = Signal.objects.filter(
            session_date=today,
            status__in=['Pending', 'Waiting'],
            max_entry_time__lt=current_time,
        )

        svc = ComplianceService()
        total = 0
        for signal in expired_signals:
            count = svc.process_expired_signal(signal)
            # Update signal status to Missed if no one executed it
            from compliance.models import ComplianceResult
            executed = ComplianceResult.objects.filter(
                signal=signal,
                status__in=['Compliant', 'Partial', 'Late Entry', 'Wrong Direction'],
            ).exists()
            if not executed:
                signal.status = 'Missed'
                signal.save(update_fields=['status'])
            total += count

        logger.info('sweep_expired_signals: %d expired signals processed, %d compliance records created',
                    expired_signals.count(), total)
    except Exception:
        logger.exception('sweep_expired_signals failed')
        raise
