from django.conf import settings
from django.db import models

from common.models import SoftDeleteModel, TimestampedModel


class Signal(SoftDeleteModel, TimestampedModel):
    DIRECTION_CHOICES = (('BUY', 'Buy'), ('SELL', 'Sell'))
    STATUS_CHOICES = (
        ('Pending', 'Pending'),
        ('Waiting', 'Waiting'),
        ('Executed', 'Executed'),
        ('Late', 'Late'),
        ('Wrong Direction', 'Wrong Direction'),
        ('Missed', 'Missed'),
    )

    symbol = models.CharField(max_length=30, default='', help_text='TradingView ticker e.g. OANDA:XAUUSD')
    pair = models.CharField(max_length=20, help_text='Short pair e.g. XAUUSD')
    direction = models.CharField(max_length=4, choices=DIRECTION_CHOICES)
    timeframe = models.CharField(max_length=10, default='15', help_text='e.g. 1, 5, 15, 60, 240, D')
    strategy_name = models.CharField(max_length=100, blank=True, default='Fibonacci Strategy')

    fib_entry = models.FloatField(
        null=True, blank=True,
        help_text='Primary entry Fib level label e.g. 0.236, 0.5, 0.618 (informational)'
    )
    take_profit = models.FloatField(help_text='TP price at Fib -0.27 extension')
    stop_loss = models.FloatField(help_text='SL price at Fib 0.786')

    fib_0236 = models.FloatField(null=True, blank=True, help_text='Entry 1 price at Fib 0.236')
    fib_0500 = models.FloatField(null=True, blank=True, help_text='Entry 2 price at Fib 0.500')
    fib_0618 = models.FloatField(null=True, blank=True, help_text='Entry 3 price at Fib 0.618')
    fib_tp = models.FloatField(null=True, blank=True, help_text='TP price at Fib -0.27 extension (alias of take_profit)')

    issued_at = models.TimeField(help_text='Signal time HH:MM')
    session_date = models.DateField(help_text='Trading date')
    max_entry_time = models.TimeField(help_text='Max time to enter')
    expires_at = models.DateTimeField(null=True, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    execution_rate = models.FloatField(default=0)

    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='assigned_signals')
    trader_profile = models.ForeignKey('users.TraderProfile', null=True, blank=True, on_delete=models.SET_NULL, related_name='signals')
    webhook_payload = models.JSONField(default=dict, blank=True, help_text='Raw TradingView payload')
    webhook_secret_valid = models.BooleanField(default=False)
    source_ip = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = 'signals'
        ordering = ['-session_date', '-created_at']
        indexes = [
            models.Index(fields=['session_date', 'status']),
            models.Index(fields=['pair', 'direction']),
        ]

    def __str__(self):
        entries = '/'.join(
            str(round(v, 2)) for v in [self.fib_0236, self.fib_0500, self.fib_0618] if v is not None
        ) or str(self.fib_entry)
        return f"{self.pair} {self.direction} entries={entries} TP={self.take_profit} SL={self.stop_loss} ({self.session_date})"


class TradingSignal(Signal):
    class Meta:
        proxy = True
