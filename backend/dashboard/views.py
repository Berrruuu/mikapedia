from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from users.models import User
from signals.models import Signal
from attendance.models import AttendanceRecord, AttendanceScheduleEntry, AttendanceSchedule
from attendance.services import AttendanceService
from common.response import success_response
from mt5.models import MT5Account


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_dashboard(request):
    """
    GET /api/dashboard/admin/
    Returns KPI summary for admin dashboard
    """
    today = timezone.localdate()
    traders = User.objects.filter(role='trader')
    signals = Signal.objects.filter(session_date=today)
    attendance = AttendanceRecord.objects.filter(date=today)

    total = signals.count() or 1
    executed = signals.filter(status='Executed').count()
    mt5_accounts = MT5Account.objects.all()
    connected_accounts = mt5_accounts.filter(status='connected').count()
    total_accounts = mt5_accounts.count()

    return success_response({
        'totalTraders': traders.count(),
        'todaySignals': signals.count(),
        'executionRate': round((executed / total) * 100),
        'mt5Bridge': {
            'connected': connected_accounts,
            'total': total_accounts,
        },
        'attendance': {
            'present': attendance.filter(status='Present').count(),
            'late': attendance.filter(status='Late').count(),
            'absent': attendance.filter(status='Absent').count(),
        },
        'signalBreakdown': {
            'executed': executed,
            'missed': signals.filter(status='Missed').count(),
            'late': signals.filter(status='Late').count(),
            'wrongDirection': signals.filter(status='Wrong Direction').count(),
            'waiting': signals.filter(status='Waiting').count(),
            'pending': signals.filter(status='Pending').count(),
        },
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def trader_dashboard(request):
    """
    GET /api/dashboard/trader/
    Returns KPI summary for trader dashboard
    """
    user = request.user
    today = timezone.localdate()
    signals = Signal.objects.filter(session_date=today, assigned_to=user)
    total = signals.count() or 1
    executed = signals.filter(status='Executed').count()

    attendance = AttendanceRecord.objects.filter(user=user, date=today).first()

    mt5 = None
    try:
        mt5_account = user.mt5_account
        mt5 = {
            'accountNumber': mt5_account.account_number,
            'status': mt5_account.status,
            'balance': mt5_account.balance,
            'equity': mt5_account.equity,
            'floating': mt5_account.floating_pnl,
            'marginLevel': mt5_account.margin_level,
            'drawdown': mt5_account.drawdown,
            'openPositions': mt5_account.open_positions,
        }
    except Exception:
        pass

    schedule = None
    base_schedule = None
    try:
        service = AttendanceService()
        schedule_obj = service.get_schedule_for_user(user, today)
        if schedule_obj:
            shift = getattr(schedule_obj, 'shift', None)
            schedule = {
                'id': schedule_obj.id,
                'shift': None,
                'assignmentType': getattr(schedule_obj, 'assignment_type', 'regular'),
                'date': getattr(schedule_obj, 'date', None).strftime('%Y-%m-%d') if getattr(schedule_obj, 'date', None) else None,
                'startDate': getattr(schedule_obj, 'start_date', None).strftime('%Y-%m-%d') if getattr(schedule_obj, 'start_date', None) else None,
                'endDate': getattr(schedule_obj, 'end_date', None).strftime('%Y-%m-%d') if getattr(schedule_obj, 'end_date', None) else None,
                'isActive': getattr(schedule_obj, 'is_active', True),
                'notes': getattr(schedule_obj, 'notes', ''),
                'coverFor': None,
            }
            if shift:
                schedule['shift'] = {
                    'id': shift.id,
                    'name': shift.name,
                    'startTime': shift.start_time.strftime('%H:%M'),
                    'endTime': shift.end_time.strftime('%H:%M'),
                    'graceMinutes': shift.grace_minutes,
                    'isActive': shift.is_active,
                    'description': shift.description,
                }
            if isinstance(schedule_obj, AttendanceScheduleEntry):
                if schedule_obj.assignment_type == schedule_obj.ASSIGNMENT_TYPE_COVER and schedule_obj.cover_for:
                    schedule['coverFor'] = {
                        'id': schedule_obj.cover_for.id,
                        'name': schedule_obj.cover_for.get_full_name() or schedule_obj.cover_for.email,
                        'email': schedule_obj.cover_for.email,
                    }
                base_obj = AttendanceSchedule.objects.select_related('shift').filter(
                    user=user,
                    is_active=True,
                    shift__is_active=True,
                    start_date__lte=today,
                    end_date__gte=today,
                ).first()
                if base_obj:
                    base_schedule = {
                        'id': base_obj.id,
                        'shift': None,
                        'startDate': base_obj.start_date.strftime('%Y-%m-%d') if base_obj.start_date else None,
                        'endDate': base_obj.end_date.strftime('%Y-%m-%d') if base_obj.end_date else None,
                        'isActive': base_obj.is_active,
                        'notes': base_obj.notes or '',
                    }
                    if base_obj.shift:
                        base_schedule['shift'] = {
                            'id': base_obj.shift.id,
                            'name': base_obj.shift.name,
                            'startTime': base_obj.shift.start_time.strftime('%H:%M'),
                            'endTime': base_obj.shift.end_time.strftime('%H:%M'),
                            'graceMinutes': base_obj.shift.grace_minutes,
                            'isActive': base_obj.shift.is_active,
                            'description': base_obj.shift.description,
                        }
    except Exception:
        pass

    return success_response({
        'attendance': attendance.status if attendance else 'Absent',
        'todaySignals': signals.count(),
        'executionRate': round((executed / total) * 100),
        'pendingSignals': signals.filter(status__in=['Pending', 'Waiting']).count(),
        'mt5': mt5,
        'schedule': schedule,
        'baseSchedule': base_schedule,
    })
