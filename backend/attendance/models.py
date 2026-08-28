import math
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from common.models import SoftDeleteModel, TimestampedModel


class AttendanceShift(SoftDeleteModel, TimestampedModel):
    name = models.CharField(max_length=100)
    start_time = models.TimeField()
    end_time = models.TimeField()
    grace_minutes = models.IntegerField(default=15)
    is_active = models.BooleanField(default=True)
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = 'attendance_shifts'
        ordering = ['start_time']
        indexes = [models.Index(fields=['is_active', 'start_time', 'end_time'])]

    def __str__(self):
        return f"{self.name} ({self.start_time} - {self.end_time})"


class AttendanceSchedule(SoftDeleteModel, TimestampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='attendance_schedules',
    )
    shift = models.ForeignKey(
        AttendanceShift,
        on_delete=models.PROTECT,
        related_name='schedules',
    )
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=True)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = 'attendance_schedules'
        ordering = ['user', 'start_date']
        indexes = [models.Index(fields=['is_active']), models.Index(fields=['start_date', 'end_date'])]

    def clean(self):
        if self.end_date < self.start_date:
            raise ValidationError({'end_date': 'End date must be on or after start date.'})

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.email} → {self.shift.name}"


class AttendanceScheduleEntry(SoftDeleteModel, TimestampedModel):
    ASSIGNMENT_TYPE_REGULAR = 'regular'
    ASSIGNMENT_TYPE_COVER = 'cover'
    ASSIGNMENT_TYPE_OFF = 'off'

    ASSIGNMENT_TYPE_CHOICES = (
        (ASSIGNMENT_TYPE_REGULAR, 'Regular'),
        (ASSIGNMENT_TYPE_COVER, 'Cover'),
        (ASSIGNMENT_TYPE_OFF, 'Off'),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='attendance_schedule_entries',
    )
    date = models.DateField()
    shift = models.ForeignKey(
        AttendanceShift,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='schedule_entries',
    )
    assignment_type = models.CharField(max_length=20, choices=ASSIGNMENT_TYPE_CHOICES, default=ASSIGNMENT_TYPE_REGULAR)
    cover_for = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='covered_schedule_entries',
    )
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = 'attendance_schedule_entries'
        ordering = ['user', 'date']
        indexes = [models.Index(fields=['date']), models.Index(fields=['assignment_type'])]
        constraints = [
            models.UniqueConstraint(fields=['user', 'date', 'shift'], name='uniq_attendance_schedule_entry_user_date_shift'),
            models.UniqueConstraint(
                fields=['user', 'date'],
                condition=models.Q(shift__isnull=True),
                name='uniq_attendance_schedule_entry_user_date_off',
            ),
        ]

    def clean(self):
        if self.assignment_type == self.ASSIGNMENT_TYPE_OFF:
            if self.shift is not None:
                raise ValidationError({'shift': 'Off days must not include a shift.'})
            if self.cover_for is not None:
                raise ValidationError({'cover_for': 'Off days cannot cover another trader.'})
            if AttendanceScheduleEntry.objects.filter(user=self.user, date=self.date).exclude(pk=self.pk).exists():
                raise ValidationError({'date': 'A schedule entry already exists for this date.'})
        else:
            if self.shift is None:
                raise ValidationError({'shift': 'Shift is required for regular or cover assignments.'})
            if AttendanceScheduleEntry.objects.filter(user=self.user, date=self.date, shift=self.shift).exclude(pk=self.pk).exists():
                raise ValidationError({'shift': 'A schedule entry for this shift already exists on this date.'})
            if AttendanceScheduleEntry.objects.filter(user=self.user, date=self.date, assignment_type=self.ASSIGNMENT_TYPE_OFF).exclude(pk=self.pk).exists():
                raise ValidationError({'date': 'An off assignment already exists for this date.'})
            if self.assignment_type == self.ASSIGNMENT_TYPE_COVER:
                if self.cover_for is None:
                    raise ValidationError({'cover_for': 'Cover assignments must reference another trader.'})
                if self.cover_for == self.user:
                    raise ValidationError({'cover_for': 'Cannot cover yourself.'})
            elif self.cover_for is not None:
                raise ValidationError({'cover_for': 'Regular assignments must not reference another trader.'})

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        if self.assignment_type == self.ASSIGNMENT_TYPE_OFF:
            return f"{self.user.email} · {self.date} off"
        if self.assignment_type == self.ASSIGNMENT_TYPE_COVER and self.cover_for:
            return f"{self.user.email} covers {self.cover_for.email} on {self.date}"
        return f"{self.user.email} · {self.date} · {self.shift.name if self.shift else 'No Shift'}"


class AttendanceRecord(SoftDeleteModel, TimestampedModel):
    STATUS_CHOICES = (
        ('Present', 'Present'),
        ('Late', 'Late'),
        ('Absent', 'Absent'),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='attendance_records',
    )
    date = models.DateField()
    shift = models.ForeignKey(
        'AttendanceShift',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='attendance_records',
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='Absent')
    check_in_time = models.TimeField(null=True, blank=True)

    selfie = models.ImageField(upload_to='attendance/selfies/', null=True, blank=True)
    gps_lat = models.FloatField(null=True, blank=True)
    gps_lng = models.FloatField(null=True, blank=True)
    gps_distance_m = models.FloatField(null=True, blank=True)
    gps_valid = models.BooleanField(default=False)
    gps_accuracy_m = models.FloatField(null=True, blank=True)

    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    device_info = models.CharField(max_length=255, blank=True)
    browser = models.CharField(max_length=100, blank=True)
    os = models.CharField(max_length=100, blank=True)

    validated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='validated_attendances',
    )
    validated_at = models.DateTimeField(null=True, blank=True)
    admin_note = models.TextField(blank=True)
    is_validated = models.BooleanField(default=False)

    class Meta:
        db_table = 'attendance_records'
        ordering = ['-date', '-created_at']
        indexes = [
            models.Index(fields=['date', 'status']),
            models.Index(fields=['is_validated', 'date']),
        ]
        constraints = [
            models.UniqueConstraint(fields=['user', 'date', 'shift'], name='uniq_attendance_record_user_date_shift'),
        ]

    def __str__(self):
        return f"{self.user.email} · {self.date} · {self.status}"

    @staticmethod
    def calc_distance_m(lat1, lng1, lat2, lng2):
        """Haversine formula — returns distance in meters"""
        R = 6_371_000
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlam = math.radians(lng2 - lng1)
        a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
