from django.conf import settings
from django.db import models

from common.models import BaseModel, SoftDeleteModel, TimestampedModel


class Report(BaseModel):
    REPORT_TYPES = (
        ('daily', 'Daily Summary'),
        ('weekly', 'Weekly Report'),
        ('compliance', 'Compliance Report'),
        ('attendance', 'Attendance Report'),
    )
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('generated', 'Generated'),
        ('shared', 'Shared'),
    )

    title = models.CharField(max_length=255)
    report_type = models.CharField(max_length=20, choices=REPORT_TYPES, default='daily')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    generated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='generated_reports')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='reports')
    signal = models.ForeignKey('signals.Signal', on_delete=models.SET_NULL, null=True, blank=True, related_name='reports')
    compliance_result = models.ForeignKey('compliance.ComplianceResult', on_delete=models.SET_NULL, null=True, blank=True, related_name='reports')
    file_url = models.URLField(blank=True)
    summary = models.TextField(blank=True)

    class Meta:
        db_table = 'reports'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['report_type', 'status']),
            models.Index(fields=['generated_by', 'created_at']),
        ]

    def __str__(self):
        return self.title
