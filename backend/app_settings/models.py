from django.db import models

from common.models import TimestampedModel


class SystemSettings(TimestampedModel):
    company_name = models.CharField(max_length=100, default='MIKAPEDIA Capital')
    timezone = models.CharField(max_length=50, default='Asia/Jakarta')
    logo_url = models.URLField(blank=True)
    tv_webhook_url = models.URLField(blank=True)
    mt5_bridge_host = models.CharField(max_length=255, blank=True)
    telegram_bot_token = models.CharField(max_length=255, blank=True)
    smtp_host = models.CharField(max_length=255, blank=True)
    session_open_utc = models.TimeField(default='07:00')
    session_close_utc = models.TimeField(default='21:00')
    attendance_cutoff = models.TimeField(default='09:15')
    office_gps_radius_m = models.IntegerField(default=120)
    fib_entry_a = models.FloatField(default=0.236)
    fib_entry_b = models.FloatField(default=0.500)
    fib_entry_c = models.FloatField(default=0.618)
    take_profit_fib = models.FloatField(default=-0.27)
    max_entry_delay_minutes = models.IntegerField(default=5)
    max_lot_per_trade = models.FloatField(default=0.50)
    auto_reject_wrong_direction = models.BooleanField(default=True)
    notify_on_missed_signal = models.BooleanField(default=True)

    class Meta:
        db_table = 'system_settings'
        verbose_name = 'System Settings'
        verbose_name_plural = 'System Settings'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
