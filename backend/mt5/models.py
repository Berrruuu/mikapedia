from django.conf import settings
from django.db import models

from common.models import BaseModel, SoftDeleteModel, TimestampedModel


class MT5Account(SoftDeleteModel, TimestampedModel):
    STATUS_CHOICES = (
        ('connected', 'Connected'),
        ('disconnected', 'Disconnected'),
        ('error', 'Error'),
        ('pending', 'Pending'),
    )

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='mt5_account')
    trader_profile = models.OneToOneField(
        'users.TraderProfile',
        on_delete=models.CASCADE,
        related_name='mt5_account',
        null=True,
        blank=True,
    )

    login = models.BigIntegerField(help_text='MT5 account login number')
    password_encrypted = models.CharField(max_length=512, help_text='Encrypted MT5 password')
    server = models.CharField(max_length=100, help_text='Broker server name e.g. ICMarkets-Live01')
    broker = models.CharField(max_length=100, blank=True)
    account_number = models.CharField(max_length=50, blank=True, help_text='Display account number')

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    error_message = models.TextField(blank=True)
    last_sync = models.DateTimeField(null=True, blank=True)
    last_error_at = models.DateTimeField(null=True, blank=True)
    is_demo = models.BooleanField(default=False)

    balance = models.FloatField(default=0)
    equity = models.FloatField(default=0)
    floating_pnl = models.FloatField(default=0)
    margin = models.FloatField(default=0)
    free_margin = models.FloatField(default=0)
    margin_level = models.FloatField(default=0)
    margin_call_level = models.FloatField(default=0)
    drawdown = models.FloatField(default=0)
    open_positions = models.IntegerField(default=0)
    pending_orders = models.IntegerField(default=0)
    currency = models.CharField(max_length=10, default='USD')
    leverage = models.IntegerField(default=100)
    company = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = 'mt5_accounts'
        indexes = [
            models.Index(fields=['status', 'is_demo']),
            models.Index(fields=['broker', 'server']),
        ]
        constraints = [
            models.UniqueConstraint(fields=['login', 'broker'], name='uniq_mt5_account_login_broker'),
        ]

    def __str__(self):
        return f"MT5:{self.login} ({self.user.email}) [{self.status}]"


class MT5Position(models.Model):
    """Open position snapshot from MT5"""
    TYPE_CHOICES = (('BUY', 'Buy'), ('SELL', 'Sell'))

    account = models.ForeignKey(MT5Account, on_delete=models.CASCADE, related_name='positions')
    ticket = models.BigIntegerField()
    symbol = models.CharField(max_length=20)
    type = models.CharField(max_length=4, choices=TYPE_CHOICES)
    volume = models.FloatField(help_text='Lot size')
    price_open = models.FloatField()
    price_current = models.FloatField(default=0)
    sl = models.FloatField(null=True, blank=True)
    tp = models.FloatField(null=True, blank=True)
    profit = models.FloatField(default=0)
    swap = models.FloatField(default=0)
    comment = models.CharField(max_length=255, blank=True)
    magic = models.BigIntegerField(default=0)
    time_open = models.DateTimeField(null=True, blank=True)
    synced_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'mt5_positions'
        unique_together = ('account', 'ticket')


class MT5Order(models.Model):
    """Pending order snapshot from MT5"""
    TYPE_MAP = {
        0: 'BUY', 1: 'SELL', 2: 'BUY LIMIT', 3: 'SELL LIMIT',
        4: 'BUY STOP', 5: 'SELL STOP',
    }

    account = models.ForeignKey(MT5Account, on_delete=models.CASCADE, related_name='orders')
    ticket = models.BigIntegerField()
    symbol = models.CharField(max_length=20)
    type = models.CharField(max_length=20)
    volume = models.FloatField()
    price_open = models.FloatField()
    sl = models.FloatField(null=True, blank=True)
    tp = models.FloatField(null=True, blank=True)
    comment = models.CharField(max_length=255, blank=True)
    magic = models.BigIntegerField(default=0)
    time_setup = models.DateTimeField(null=True, blank=True)
    synced_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'mt5_orders'
        unique_together = ('account', 'ticket')


class MT5Deal(models.Model):
    """Closed deal from MT5 history"""
    ENTRY_CHOICES = (('IN', 'In'), ('OUT', 'Out'), ('INOUT', 'In/Out'), ('OUT_BY', 'Out By'))

    account = models.ForeignKey(MT5Account, on_delete=models.CASCADE, related_name='deals')
    ticket = models.BigIntegerField()
    order = models.BigIntegerField(default=0)
    symbol = models.CharField(max_length=20)
    type = models.CharField(max_length=4)
    entry = models.CharField(max_length=10, choices=ENTRY_CHOICES, default='IN')
    volume = models.FloatField()
    price = models.FloatField()
    profit = models.FloatField(default=0)
    swap = models.FloatField(default=0)
    commission = models.FloatField(default=0)
    comment = models.CharField(max_length=255, blank=True)
    magic = models.BigIntegerField(default=0)
    time = models.DateTimeField(null=True, blank=True)
    synced_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'mt5_deals'
        unique_together = ('account', 'ticket')
        ordering = ['-time']


class Trade(BaseModel):
    STATUS_CHOICES = (
        ('open', 'Open'),           # limit order tersentuh, posisi aktif
        ('closed', 'Closed'),       # posisi sudah ditutup (TP/SL/manual)
        ('pending', 'Pending'),     # limit order belum tersentuh
        ('cancelled', 'Cancelled'), # order dibatalkan sebelum tersentuh
    )
    ORDER_TYPE_CHOICES = (
        ('market',     'Market Order'),
        ('buy_limit',  'Buy Limit'),
        ('sell_limit', 'Sell Limit'),
        ('buy_stop',   'Buy Stop'),
        ('sell_stop',  'Sell Stop'),
    )

    account = models.ForeignKey(MT5Account, on_delete=models.CASCADE, related_name='trades')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='trades')
    trader_profile = models.ForeignKey(
        'users.TraderProfile',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='trades',
    )
    signal = models.ForeignKey('signals.Signal', on_delete=models.SET_NULL, null=True, blank=True, related_name='trades')
    compliance_result = models.ForeignKey(
        'compliance.ComplianceResult',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='trade_links',
    )
    ticket = models.BigIntegerField()
    symbol = models.CharField(max_length=20)
    direction = models.CharField(max_length=4)
    order_type = models.CharField(
        max_length=15, choices=ORDER_TYPE_CHOICES, default='market',
        help_text='SOP: harus buy_limit atau sell_limit'
    )
    volume = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    entry_price = models.DecimalField(max_digits=12, decimal_places=5, default=0)
    exit_price = models.DecimalField(max_digits=12, decimal_places=5, null=True, blank=True)
    stop_loss = models.DecimalField(max_digits=12, decimal_places=5, null=True, blank=True,
                                    help_text='SL price at time of entry')
    take_profit = models.DecimalField(max_digits=12, decimal_places=5, null=True, blank=True,
                                      help_text='TP price at time of entry')
    open_time = models.DateTimeField(null=True, blank=True)
    close_time = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True,
                                        help_text='Kapan order dibatalkan (untuk pending yang tidak tersentuh)')
    pnl = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')

    class Meta:
        db_table = 'trades'
        indexes = [
            models.Index(fields=['account', 'status']),
            models.Index(fields=['symbol', 'open_time']),
        ]
        constraints = [
            models.UniqueConstraint(fields=['account', 'ticket'], name='uniq_trade_account_ticket'),
        ]

    def __str__(self):
        return f"{self.symbol} {self.direction} #{self.ticket}"
