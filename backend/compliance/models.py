from django.conf import settings
from django.db import models

from common.models import SoftDeleteModel, TimestampedModel


class ComplianceResult(SoftDeleteModel, TimestampedModel):
    STATUS_CHOICES = (
        ('Compliant', 'Compliant'),
        ('Partial', 'Partial'),
        ('Late Entry', 'Late Entry'),
        ('Wrong Direction', 'Wrong Direction'),
        ('Missed', 'Missed'),
        ('Pending', 'Pending'),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='compliance_results')
    trader_profile = models.ForeignKey('users.TraderProfile', on_delete=models.SET_NULL, null=True, blank=True, related_name='compliance_results')
    signal = models.ForeignKey('signals.Signal', on_delete=models.CASCADE, related_name='compliance_results')

    # Primary trade (first entry / any entry for backward compat)
    trade = models.OneToOneField('mt5.Trade', on_delete=models.SET_NULL, null=True, blank=True, related_name='linked_compliance_result')

    # 3-position SOP tracking
    # Each field stores the ticket of the trade at that fib level (null = not opened)
    entry1_ticket = models.BigIntegerField(null=True, blank=True, help_text='Trade ticket at Fib 0.236')
    entry2_ticket = models.BigIntegerField(null=True, blank=True, help_text='Trade ticket at Fib 0.500')
    entry3_ticket = models.BigIntegerField(null=True, blank=True, help_text='Trade ticket at Fib 0.618')
    entry_count   = models.IntegerField(default=0, help_text='How many of the 3 required entries were opened')

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    score = models.IntegerField(default=0, help_text='0-100 compliance score')
    actual_direction = models.CharField(max_length=4, null=True, blank=True)
    actual_entry = models.FloatField(null=True, blank=True)
    actual_entry_time = models.TimeField(null=True, blank=True)
    coaching_note = models.TextField(blank=True)
    violations = models.JSONField(default=list, blank=True, help_text='List of violation codes detected')

    class Meta:
        db_table = 'compliance_records'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'signal']),
            models.Index(fields=['status', 'score']),
        ]
        constraints = [
            models.UniqueConstraint(fields=['user', 'signal'], name='uniq_compliance_result_user_signal'),
        ]

    @property
    def missing_entries(self) -> int:
        """How many of the 3 required entries are missing."""
        return max(0, 3 - self.entry_count)

    def __str__(self):
        return f"{self.user.email} - Signal {self.signal_id} - {self.status} ({self.entry_count}/3 entries)"


class ComplianceRecord(ComplianceResult):
    class Meta:
        proxy = True


class SOPWarning(TimestampedModel):
    """
    Formal SOP warning issued to a trader.
    Accumulates over time — at thresholds, escalation actions are triggered.
    """
    SEVERITY_CHOICES = (
        ('warning', 'Warning'),   # 1st–2nd violation
        ('danger',  'Danger'),    # 3rd+ violation
    )
    VIOLATION_TYPE_CHOICES = (
        ('missed_signal',      'Signal Dilewati'),
        ('incomplete_entries', 'Entry Kurang dari 3'),
        ('wrong_order_type',   'Pakai Market Order (harus Limit)'),
        ('wrong_direction',    'Arah Salah'),
        ('late_entry',         'Entry Terlambat'),
        ('no_stop_loss',       'Tidak Ada SL'),
        ('no_take_profit',     'Tidak Ada TP'),
        ('wrong_stop_loss',    'SL Tidak Sesuai Level'),
        ('wrong_lot_size',     'Lot Size Salah'),
        ('entry_out_of_zone',  'Entry di Luar Zona'),
        ('multiple',           'Beberapa Pelanggaran'),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sop_warnings')
    compliance_result = models.ForeignKey(
        ComplianceResult, on_delete=models.CASCADE, related_name='warnings', null=True, blank=True
    )
    violation_type = models.CharField(max_length=30, choices=VIOLATION_TYPE_CHOICES)
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='warning')
    message = models.TextField()
    acknowledged = models.BooleanField(default=False)
    acknowledged_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'sop_warnings'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'acknowledged']),
            models.Index(fields=['violation_type', 'severity']),
        ]

    def __str__(self):
        return f"[{self.severity}] {self.user.email} — {self.violation_type}"
