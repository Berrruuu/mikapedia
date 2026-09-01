from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models

from common.models import BaseModel, SoftDeleteModel, TimestampedModel


class User(AbstractUser, SoftDeleteModel, TimestampedModel):
    ROLE_CHOICES = (
        ('owner', 'Owner'),
        ('admin', 'Administrator'),
        ('trader', 'Trader'),
    )
    STATUS_CHOICES = (
        ('active', 'Active'),
        ('suspended', 'Suspended'),
        ('inactive', 'Inactive'),
    )

    id = models.BigAutoField(primary_key=True, editable=False)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='trader')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')

    employee_id = models.CharField(max_length=50, unique=True, null=True, blank=True)
    department = models.CharField(max_length=100, blank=True)
    position = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)

    mt5_account_number = models.CharField(max_length=50, blank=True, null=True)
    mt5_broker_server = models.CharField(max_length=100, blank=True)
    mt5_broker_name = models.CharField(max_length=100, blank=True)

    executionRate = models.FloatField(default=0)
    complianceScore = models.FloatField(default=0)
    entryAccuracy = models.FloatField(default=0)
    timingAccuracy = models.FloatField(default=0)
    lateEntries = models.IntegerField(default=0)

    password_reset_token = models.CharField(max_length=64, blank=True, null=True)
    password_reset_expires = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'users'
        ordering = ['-date_joined']
        indexes = [
            models.Index(fields=['status', 'role']),
            models.Index(fields=['employee_id']),
        ]

    def __str__(self):
        return f"{self.full_name} <{self.email}>"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.username

    @property
    def account_number(self):
        return self.mt5_account_number


class TraderProfile(BaseModel):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='trader_profile')
    display_name = models.CharField(max_length=100, blank=True)
    risk_level = models.CharField(max_length=20, default='medium')
    max_daily_loss = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    max_position_size = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    default_leverage = models.PositiveIntegerField(default=100)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'trader_profiles'
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['risk_level']),
        ]

    def __str__(self):
        return self.display_name or self.user.get_full_name() or self.user.username
