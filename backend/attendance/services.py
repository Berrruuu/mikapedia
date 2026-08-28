from datetime import datetime, timedelta
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.utils import timezone

from app_settings.models import SystemSettings
from users.models import User
from .models import AttendanceRecord, AttendanceShift, AttendanceSchedule, AttendanceScheduleEntry
from .repositories import AttendanceRepository
from audit_logs.utils import create_audit


class AttendanceService:
    def __init__(self, repository: AttendanceRepository | None = None):
        self.repository = repository or AttendanceRepository()

    def get_queryset_for_user(self, user):
        return self.repository.get_queryset_for_user(user)

    def get_today_records(self, user):
        return self.repository.get_all_for_user_on_date(user, timezone.localdate())

    def get_schedule_for_user(self, user, day=None):
        if day is None:
            day = timezone.localdate()

        entry = AttendanceScheduleEntry.objects.select_related('shift').filter(
            user=user,
            date=day,
        ).order_by('created_at').first()

        if entry:
            return entry

        return AttendanceSchedule.objects.select_related('shift').filter(
            user=user,
            is_active=True,
            shift__is_active=True,
            start_date__lte=day,
            end_date__gte=day,
        ).order_by('start_date').first()

    def _has_cover_assignment_today(self, user, day):
        return AttendanceScheduleEntry.objects.filter(
            user=user,
            date=day,
            assignment_type=AttendanceScheduleEntry.ASSIGNMENT_TYPE_COVER,
        ).exists()

    def _get_base_schedule_shift(self, user, day):
        base_schedule = AttendanceSchedule.objects.select_related('shift').filter(
            user=user,
            is_active=True,
            shift__is_active=True,
            start_date__lte=day,
            end_date__gte=day,
        ).order_by('start_date').first()
        return base_schedule.shift if base_schedule and base_schedule.shift else None

    def get_schedule_shifts_for_user(self, user, day=None):
        if day is None:
            day = timezone.localdate()

        entries = list(AttendanceScheduleEntry.objects.select_related('shift').filter(
            user=user,
            date=day,
        ))

        if entries:
            if any(entry.assignment_type == AttendanceScheduleEntry.ASSIGNMENT_TYPE_OFF for entry in entries):
                return []

            shifts = []
            for entry in entries:
                if entry.shift is not None and entry.assignment_type != AttendanceScheduleEntry.ASSIGNMENT_TYPE_OFF:
                    if entry.shift not in shifts:
                        shifts.append(entry.shift)

            if self._has_cover_assignment_today(user, day):
                base_shift = self._get_base_schedule_shift(user, day)
                if base_shift and base_shift not in shifts:
                    shifts.insert(0, base_shift)

            if len(shifts) > 1 and not self._has_cover_assignment_today(user, day):
                return [shifts[0]]

            return shifts

        schedules = AttendanceSchedule.objects.select_related('shift').filter(
            user=user,
            is_active=True,
            shift__is_active=True,
            start_date__lte=day,
            end_date__gte=day,
        ).order_by('start_date')

        return [schedule.shift for schedule in schedules if schedule.shift]

    def _resolve_check_in_shift(self, user, data: dict, day):
        shift_id = data.get('shift_id')
        available_shifts = self.get_schedule_shifts_for_user(user, day)

        if shift_id is not None and shift_id != '':
            try:
                shift_id = int(shift_id)
            except (TypeError, ValueError):
                raise ValidationError('Invalid shift_id.')
            shift = AttendanceShift.objects.filter(pk=shift_id, is_active=True).first()
            if not shift:
                raise ValidationError('Selected shift does not exist or is inactive.')
            if available_shifts and shift not in available_shifts:
                raise ValidationError('Selected shift is not scheduled for today.')
            return shift

        if len(available_shifts) == 1:
            return available_shifts[0]
        if len(available_shifts) > 1:
            if not self._has_cover_assignment_today(user, day):
                raise ValidationError('Multiple sessions are only allowed when you are covering another trader today.')
            now_time = timezone.localtime().time()
            for shift in available_shifts:
                if shift.start_time <= now_time <= shift.end_time:
                    return shift
            raise ValidationError('Multiple sessions are available today; please specify shift_id.')

        return None

    def check_in(self, user, data: dict, files: dict | None = None, meta: dict | None = None):
        today = timezone.localdate()
        shift = self._resolve_check_in_shift(user, data, today)

        existing = None
        if shift is not None:
            existing = self.repository.get_for_user_on_date_and_shift(user, today, shift)
        else:
            existing = self.repository.get_for_user_on_date(user, today)

        if existing:
            return {'existing': True, 'record': existing}

        settings_obj = SystemSettings.get()
        gps_lat = data.get('gps_lat')
        gps_lng = data.get('gps_lng')
        gps_accuracy = data.get('gps_accuracy_m')
        gps_valid = False
        gps_distance_m = None

        if gps_lat and gps_lng:
            try:
                gps_lat = float(gps_lat)
                gps_lng = float(gps_lng)
                gps_distance_m = AttendanceRecord.calc_distance_m(gps_lat, gps_lng, -6.2088, 106.8456)
                gps_valid = True
            except (TypeError, ValueError):
                pass

        user_agent = (meta or {}).get('HTTP_USER_AGENT', '')
        ip = self._get_client_ip(meta or {})
        now_time = timezone.localtime().time()
        status = self._determine_status(now_time, settings_obj, shift)
        device = self._parse_device(user_agent)

        payload = {
            'user': user,
            'date': today,
            'shift': shift,
            'status': status,
            'check_in_time': now_time,
            'gps_lat': gps_lat,
            'gps_lng': gps_lng,
            'gps_distance_m': round(gps_distance_m, 1) if gps_distance_m else None,
            'gps_valid': gps_valid,
            'gps_accuracy_m': float(gps_accuracy) if gps_accuracy else None,
            'ip_address': ip or None,
            'user_agent': user_agent,
            'device_info': device['device_info'],
            'os': device['os'],
            'browser': device['browser'],
        }
        record = AttendanceRecord(**payload)
        if files and 'selfie' in files:
            record.selfie = files['selfie']
        try:
            record.save()
        except IntegrityError as exc:
            if 'attendance_records.user_id, attendance_records.date' in str(exc) or 'uniq_attendance_record_user_date' in str(exc):
                existing = self.repository.get_for_user_on_date_and_shift(user, today, shift)
                if existing:
                    return {'existing': True, 'record': existing}
                existing = self.repository.get_for_user_on_date(user, today)
                if existing:
                    return {'existing': True, 'record': existing}
            raise

        try:
            create_audit(actor=user, action='attendance.checkin', category='attendance', severity='info', target=record, after=record,
                         metadata={'ip_address': record.ip_address, 'device_info': record.device_info})
        except Exception:
            pass
        return {'existing': False, 'record': record}

    def validate_record(self, record, status: str, admin_note: str, validator: User):
        if status not in dict(AttendanceRecord.STATUS_CHOICES):
            raise ValidationError('Invalid status.')
        updated = self.repository.update_validation(record, status, admin_note, validator)
        try:
            create_audit(actor=validator, action='attendance.validate', category='attendance', severity='info', target=updated, before=None, after=updated, metadata={'admin_note': admin_note})
        except Exception:
            pass
        return updated

    def summary(self, day):
        records = self.repository.summary(day)
        total_traders = User.objects.filter(role='trader').count()
        present = records.filter(status='Present').count()
        late = records.filter(status='Late').count()
        return {
            'date': day,
            'totalTraders': total_traders,
            'present': present,
            'late': late,
            'absent': max(total_traders - present - late, 0),
            'records': records,
        }

    def _determine_status(self, check_in_time, settings_obj, shift: AttendanceShift | None = None) -> str:
        if shift:
            if check_in_time <= shift.start_time:
                return 'Present'

            shift_grace = (datetime.combine(timezone.localdate(), shift.start_time) + timedelta(minutes=shift.grace_minutes)).time()
            if check_in_time <= shift_grace:
                return 'Present'

            if check_in_time <= shift.end_time:
                return 'Late'

            return 'Absent'

        cutoff = settings_obj.attendance_cutoff
        if isinstance(cutoff, str):
            from datetime import time as dt_time
            h, m = cutoff.split(':')[:2]
            cutoff = dt_time(int(h), int(m))
        return 'Present' if check_in_time <= cutoff else 'Late'

    def _parse_device(self, user_agent: str) -> dict:
        ua = user_agent.lower()
        os_map = [
            ('windows', 'Windows'), ('android', 'Android'), ('iphone', 'iOS'),
            ('ipad', 'iOS'), ('mac os', 'macOS'), ('linux', 'Linux'),
        ]
        browser_map = [
            ('edg/', 'Edge'), ('opr/', 'Opera'), ('chrome/', 'Chrome'),
            ('firefox/', 'Firefox'), ('safari/', 'Safari'),
        ]
        detected_os = next((label for key, label in os_map if key in ua), 'Unknown OS')
        detected_browser = next((label for key, label in browser_map if key in ua), 'Unknown Browser')
        return {'os': detected_os, 'browser': detected_browser, 'device_info': f'{detected_os} · {detected_browser}'}

    def _get_client_ip(self, meta: dict) -> str:
        x_forwarded = meta.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded:
            return x_forwarded.split(',')[0].strip()
        return meta.get('REMOTE_ADDR', '')
