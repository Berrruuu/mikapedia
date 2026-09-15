from datetime import date as date_type

from django.db.models import Q, QuerySet
from django.utils import timezone

from attendance.services import AttendanceService
from .models import Signal


def _time_matches_shift(signal_time, shift):
    if shift.start_time <= shift.end_time:
        return shift.start_time <= signal_time <= shift.end_time
    return signal_time >= shift.start_time or signal_time <= shift.end_time


def signal_visible_to_trader(signal, user):
    if getattr(user, 'role', None) in ('owner', 'admin'):
        return True

    profile = getattr(user, 'trader_profile', None)
    if profile is None or profile.allowed_timeframe != signal.timeframe:
        return False

    shifts = AttendanceService().get_schedule_shifts_for_user(user, signal.session_date)
    return any(_time_matches_shift(signal.issued_at, shift) for shift in shifts)


class SignalRepository:
    def get_queryset(self) -> QuerySet:
        return Signal.objects.all()

    def get_queryset_for_request(self, request) -> QuerySet:
        qs = self.get_queryset()
        date = request.query_params.get('date')
        if date:
            qs = qs.filter(session_date=date)
        elif not request.query_params.get('all'):
            date = timezone.localdate()
            qs = qs.filter(session_date=date)

        if getattr(request.user, 'role', None) == 'trader':
            profile = getattr(request.user, 'trader_profile', None)
            if profile is None:
                return qs.none()
            qs = qs.filter(timeframe=profile.allowed_timeframe)

            try:
                schedule_date = date if isinstance(date, date_type) else date_type.fromisoformat(date)
            except (TypeError, ValueError):
                schedule_date = timezone.localdate()
            shifts = AttendanceService().get_schedule_shifts_for_user(request.user, schedule_date)
            if not shifts:
                return qs.none()

            shift_filter = Q()
            for shift in shifts:
                if shift.start_time <= shift.end_time:
                    shift_filter |= Q(issued_at__gte=shift.start_time, issued_at__lte=shift.end_time)
                else:
                    shift_filter |= Q(issued_at__gte=shift.start_time) | Q(issued_at__lte=shift.end_time)
            qs = qs.filter(shift_filter)
        return qs

    def create(self, **kwargs) -> Signal:
        return Signal.objects.create(**kwargs)

    def update_status(self, signal: Signal, status: str) -> Signal:
        signal.status = status
        signal.save(update_fields=['status'])
        return signal
