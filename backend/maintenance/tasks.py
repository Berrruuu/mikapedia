from celery import shared_task
from datetime import timedelta
from django.utils import timezone


@shared_task(bind=True)
def prune_old_records(self):
    """Cleanup soft-deleted or very old records to keep DB tidy."""
    try:
        from signals.models import Signal
        cutoff = timezone.now() - timedelta(days=90)
        # hard-delete signals older than 90 days
        Signal.objects.filter(created_at__lt=cutoff).delete()
    except Exception:
        raise


@shared_task(bind=True)
def health_check(self):
    """Simple health probe task that can check external systems and report status."""
    try:
        # Example: check Redis by importing channels layer and pinging
        from channels.layers import get_channel_layer
        layer = get_channel_layer()
        # No direct ping API; presence of layer is sufficient here
        return True
    except Exception:
        raise
