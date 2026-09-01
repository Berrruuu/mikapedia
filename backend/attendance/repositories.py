from django.db.models import QuerySet
from django.utils import timezone

from .models import AttendanceRecord, AttendanceShift
from users.models import User


class AttendanceRepository:
    def get_queryset(self) -> QuerySet:
        return AttendanceRecord.objects.select_related('user', 'validated_by', 'shift')

    def get_queryset_for_user(self, user: User) -> QuerySet:
        qs = self.get_queryset()
        if getattr(user, 'role', None) in ['owner', 'admin']:
            return qs
        return qs.filter(user=user)

    def get_for_user_on_date(self, user: User, day) -> AttendanceRecord | None:
        return self.get_queryset().filter(user=user, date=day).first()

    def get_for_user_on_date_and_shift(self, user: User, day, shift: AttendanceShift | None) -> AttendanceRecord | None:
        return self.get_queryset().filter(user=user, date=day, shift=shift).first()

    def get_all_for_user_on_date(self, user: User, day):
        return self.get_queryset().filter(user=user, date=day)

    def create(self, **kwargs) -> AttendanceRecord:
        return AttendanceRecord.objects.create(**kwargs)

    def get_by_id(self, pk) -> AttendanceRecord | None:
        return self.get_queryset().filter(pk=pk).first()

    def update_validation(self, record: AttendanceRecord, status: str, admin_note: str, validator: User) -> AttendanceRecord:
        record.status = status
        record.admin_note = admin_note
        record.validated_by = validator
        record.validated_at = timezone.now()
        record.is_validated = True
        record.save(update_fields=['status', 'admin_note', 'validated_by', 'validated_at', 'is_validated'])
        return record

    def summary(self, day):
        return self.get_queryset().filter(date=day).select_related('user')
