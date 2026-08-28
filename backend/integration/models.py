from django.db import models
from django.conf import settings
from django.utils import timezone

try:
    # Django 3.1+: use models.JSONField
    JSON = models.JSONField
except Exception:
    try:
        from django.contrib.postgres.fields import JSONField as JSON
    except Exception:
        # fallback
        JSON = models.TextField


class IntegrationReceipt(models.Model):
    """Record received external integration events to ensure idempotency."""
    source = models.CharField(max_length=100, help_text='Source identifier, e.g. ea')
    event_id = models.CharField(max_length=200, blank=True, null=True, db_index=True)
    payload = JSON(blank=True, null=True)
    received_at = models.DateTimeField(default=timezone.now)
    processed = models.BooleanField(default=False)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'integration_receipts'
        indexes = [models.Index(fields=['source', 'event_id'])]
        unique_together = (('source', 'event_id'),)

    def __str__(self):
        return f"{self.source}:{self.event_id or self.pk}"
