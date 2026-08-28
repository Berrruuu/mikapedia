"""
Reports Service Layer
Generates data for all report types.
"""

from datetime import date, timedelta
from django.db.models import Avg, Count, Q
from django.utils import timezone
from users.models import User
from signals.models import Signal
from attendance.models import AttendanceRecord, AttendanceScheduleEntry


def _date_range(period: str, ref_date: date = None) -> tuple[date, date]:
    """Returns (start, end) date range for a given period"""
    ref = ref_date or timezone.localdate()
    if period == 'daily':
        return ref, ref
    if period == 'weekly':
        start = ref - timedelta(days=ref.weekday())
        return start, start + timedelta(days=6)
    if period == 'monthly':
        return ref.replace(day=1), ref.replace(day=1) + timedelta(days=32) - timedelta(days=1)
    # fallback
    return ref, ref


# ─── Leaderboard ─────────────────────────────────────────────────────────────

def get_leaderboard(period: str = 'daily', ref_date: date = None) -> list[dict]:
    """
    Rank traders by SOP compliance metrics only.
    Does NOT rank by profit.
    Metrics: execution_rate, compliance, entry_accuracy, timing_accuracy
    """
    start, end = _date_range(period, ref_date)
    traders = User.objects.filter(role='trader')

    rows = []
    for t in traders:
        # Attendance rate for period
        total_days = (end - start).days + 1
        present_days = AttendanceRecord.objects.filter(
            user=t, date__range=(start, end), status__in=['Present', 'Late']
        ).count()

        rows.append({
            'id': str(t.id),
            'name': t.full_name,
            'email': t.email,
            'accountNumber': t.mt5_account_number or '',
            'employeeId': t.employee_id or '',
            'department': t.department,
            'position': t.position,
            # SOP metrics from user profile (synced by compliance engine)
            'executionRate': t.executionRate if hasattr(t, 'executionRate') else 0,
            'complianceScore': t.complianceScore if hasattr(t, 'complianceScore') else 0,
            'entryAccuracy': t.entryAccuracy if hasattr(t, 'entryAccuracy') else 0,
            'timingAccuracy': t.timingAccuracy if hasattr(t, 'timingAccuracy') else 0,
            'lateEntries': t.lateEntries if hasattr(t, 'lateEntries') else 0,
            'attendanceRate': round((present_days / total_days) * 100, 1) if total_days > 0 else 0,
            'period': period,
            'periodStart': str(start),
            'periodEnd': str(end),
        })

    # Sort by composite SOP score (no profit)
    for r in rows:
        r['sopScore'] = round((
            r['executionRate'] * 0.35 +
            r['complianceScore'] * 0.30 +
            r['entryAccuracy'] * 0.20 +
            r['timingAccuracy'] * 0.15
        ), 2)

    rows.sort(key=lambda x: x['sopScore'], reverse=True)
    for i, r in enumerate(rows):
        r['rank'] = i + 1

    return rows


# ─── Signal / Execution Report ────────────────────────────────────────────────

def get_execution_report(period: str = 'daily', ref_date: date = None) -> dict:
    start, end = _date_range(period, ref_date)
    signals = Signal.objects.filter(session_date__range=(start, end))

    total = signals.count()
    executed = signals.filter(status='Executed').count()
    missed = signals.filter(status='Missed').count()
    late = signals.filter(status='Late').count()
    wrong = signals.filter(status='Wrong Direction').count()
    waiting = signals.filter(status__in=['Waiting', 'Pending']).count()

    by_pair = {}
    for s in signals:
        if s.pair not in by_pair:
            by_pair[s.pair] = {'total': 0, 'executed': 0, 'missed': 0, 'late': 0, 'wrong': 0}
        by_pair[s.pair]['total'] += 1
        key = s.status.lower().replace(' ', '_')
        if key in by_pair[s.pair]:
            by_pair[s.pair][key] += 1

    return {
        'period': period,
        'start': str(start),
        'end': str(end),
        'totalSignals': total,
        'executed': executed,
        'missed': missed,
        'late': late,
        'wrongDirection': wrong,
        'waiting': waiting,
        'executionRate': round((executed / total) * 100, 1) if total > 0 else 0,
        'byPair': by_pair,
        'signals': list(signals.values(
            'id', 'pair', 'direction', 'fib_entry', 'take_profit', 'stop_loss',
            'issued_at', 'session_date', 'status', 'execution_rate', 'strategy_name', 'timeframe'
        )),
    }


# ─── Attendance Report ────────────────────────────────────────────────────────

def get_attendance_report(period: str = 'daily', ref_date: date = None) -> dict:
    start, end = _date_range(period, ref_date)
    records_qs = AttendanceRecord.objects.filter(
        date__range=(start, end)
    ).select_related('user', 'validated_by', 'shift').order_by('date', 'user__first_name')

    # Load schedule entries for the same date range to determine whether a record
    # is the user's original assignment or a cover assignment.
    schedule_entries = AttendanceScheduleEntry.objects.filter(
        date__range=(start, end)
    ).select_related('user', 'cover_for', 'shift')

    # Map schedule entries by (user_id, date, shift_id) for quick lookup
    entry_map: dict[tuple[int, str, int], AttendanceScheduleEntry] = {}
    for e in schedule_entries:
        key = (e.user_id, str(e.date), e.shift_id if e.shift_id is not None else 0)
        entry_map[key] = e

    traders = User.objects.filter(role='trader').count()
    total_days = (end - start).days + 1
    expected = traders * total_days

    present = records_qs.filter(status='Present').count()
    late = records_qs.filter(status='Late').count()
    absent = max(expected - present - late, 0)

    # Build annotated records with session_type (original|cover|off) and covers info
    annotated = []
    for r in records_qs:
        key = (r.user_id, str(r.date), r.shift_id if r.shift_id is not None else 0)
        entry = entry_map.get(key)
        session_type = 'original'
        covers = None
        if entry:
            if entry.assignment_type == entry.ASSIGNMENT_TYPE_COVER:
                session_type = 'cover'
                if entry.cover_for:
                    covers = {
                        'id': str(entry.cover_for_id),
                        'name': f"{entry.cover_for.first_name} {entry.cover_for.last_name}",
                        'email': entry.cover_for.email,
                    }
            elif entry.assignment_type == entry.ASSIGNMENT_TYPE_OFF:
                session_type = 'off'

        annotated.append({
            'id': r.id,
            'user__first_name': r.user.first_name,
            'user__last_name': r.user.last_name,
            'user__email': r.user.email,
            'date': str(r.date),
            'status': r.status,
            'shift': r.shift.name if r.shift else None,
            'check_in_time': str(r.check_in_time) if r.check_in_time is not None else None,
            'gps_valid': r.gps_valid,
            'gps_distance_m': r.gps_distance_m,
            'ip_address': r.ip_address,
            'device_info': r.device_info,
            'is_validated': r.is_validated,
            'admin_note': r.admin_note,
            'session_type': session_type,
            'covers': covers,
        })

    return {
        'period': period,
        'start': str(start),
        'end': str(end),
        'totalTraders': traders,
        'totalDays': total_days,
        'expected': expected,
        'present': present,
        'late': late,
        'absent': absent,
        'attendanceRate': round(((present + late) / expected) * 100, 1) if expected > 0 else 0,
        'records': annotated,
    }


# ─── Compliance Report ────────────────────────────────────────────────────────

def get_compliance_report(period: str = 'daily', ref_date: date = None) -> dict:
    start, end = _date_range(period, ref_date)
    traders = User.objects.filter(role='trader')

    rows = []
    for t in traders:
        rows.append({
            'id': str(t.id),
            'name': t.full_name,
            'email': t.email,
            'accountNumber': t.mt5_account_number or '',
            'executionRate': getattr(t, 'executionRate', 0),
            'complianceScore': getattr(t, 'complianceScore', 0),
            'entryAccuracy': getattr(t, 'entryAccuracy', 0),
            'timingAccuracy': getattr(t, 'timingAccuracy', 0),
            'lateEntries': getattr(t, 'lateEntries', 0),
        })

    return {
        'period': period,
        'start': str(start),
        'end': str(end),
        'traders': rows,
        'avgExecutionRate': round(sum(r['executionRate'] for r in rows) / len(rows), 1) if rows else 0,
        'avgComplianceScore': round(sum(r['complianceScore'] for r in rows) / len(rows), 1) if rows else 0,
    }


# ─── End-of-Session Report ────────────────────────────────────────────────────

def get_session_report(session_date: date = None) -> dict:
    ref = session_date or timezone.localdate()
    exec_report = get_execution_report('daily', ref)
    att_report = get_attendance_report('daily', ref)
    leaderboard = get_leaderboard('daily', ref)

    return {
        'sessionDate': str(ref),
        'execution': exec_report,
        'attendance': att_report,
        'leaderboard': leaderboard[:5],  # Top 5 for session report
    }
