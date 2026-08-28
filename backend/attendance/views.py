import re
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework import viewsets, permissions, status, parsers
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import AttendanceRecord, AttendanceSchedule, AttendanceScheduleEntry, AttendanceShift
from .serializers import (
    AttendanceSerializer,
    AttendanceCheckInSerializer,
    AdminValidateSerializer,
    AttendanceShiftSerializer,
    AttendanceScheduleSerializer,
    AttendanceScheduleEntrySerializer,
)
from .services import AttendanceService
from common.api import StandardizedModelViewSet
from common.response import success_response, error_response



class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'


class AttendanceViewSet(StandardizedModelViewSet):
    service = AttendanceService()
    serializer_class = AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['date', 'status', 'is_validated']
    search_fields = ['user__email', 'status', 'device_info']
    ordering_fields = ['date', 'created_at', 'status']

    def get_queryset(self):
        return self.service.get_queryset_for_user(self.request.user)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    @action(detail=False, methods=['post'],
            parser_classes=[parsers.MultiPartParser, parsers.JSONParser],
            url_path='checkin')
    def checkin(self, request):
        try:
            result = self.service.check_in(
                request.user,
                request.data,
                getattr(request, 'FILES', {}),
                request.META,
            )
        except ValidationError as exc:
            return error_response(str(exc), status=status.HTTP_400_BAD_REQUEST)

        if result['existing']:
            return success_response({
                'detail': 'Already checked in today.',
                'record': AttendanceSerializer(result['record'], context={'request': request}).data,
            }, status=status.HTTP_200_OK)

        record = result['record']

        # Broadcast via WebSocket
        try:
            from config.ws_broadcast import broadcast_attendance, broadcast_dashboard_stats
            broadcast_attendance(AttendanceSerializer(record, context={'request': request}).data)
            # Also refresh dashboard stats
            from django.utils import timezone as tz
            from signals.models import Signal
            from users.models import User
            today = tz.localdate()
            sigs = Signal.objects.filter(session_date=today)
            total = sigs.count() or 1
            executed = sigs.filter(status='Executed').count()
            from attendance.models import AttendanceRecord as AR
            att = AR.objects.filter(date=today)
            traders = User.objects.filter(role='trader').count()
            broadcast_dashboard_stats({
                'todaySignals': sigs.count(),
                'executionRate': round((executed / total) * 100),
                'attendance': {
                    'present': att.filter(status='Present').count(),
                    'late': att.filter(status='Late').count(),
                    'absent': max(traders - att.filter(status__in=['Present','Late']).count(), 0),
                },
            })
        except Exception:
            pass

        return success_response(
            AttendanceSerializer(record, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['get'], url_path='today')
    def today(self, request):
        records = self.service.get_today_records(request.user)
        shifts = self.service.get_schedule_shifts_for_user(request.user)
        record_data = AttendanceSerializer(records, many=True, context={'request': request}).data
        return success_response({
            'checked_in': records.exists(),
            'records': record_data,
            'available_shifts': [AttendanceShiftSerializer(shift).data for shift in shifts],
        })

    @action(detail=True, methods=['patch'], permission_classes=[IsAdminRole], url_path='validate')
    def validate(self, request, pk=None):
        record = self.get_object()
        serializer = AdminValidateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        record = self.service.validate_record(
            record,
            serializer.validated_data['status'],
            serializer.validated_data.get('admin_note', ''),
            request.user,
        )

        # Broadcast validated record
        try:
            from config.ws_broadcast import broadcast_attendance
            broadcast_attendance(AttendanceSerializer(record, context={'request': request}).data)
        except Exception:
            pass

        return success_response(AttendanceSerializer(record, context={'request': request}).data)

    @action(detail=False, methods=['get'], permission_classes=[IsAdminRole], url_path='summary')
    def summary(self, request):
        date = request.query_params.get('date', str(timezone.localdate()))
        summary = self.service.summary(date)
        return success_response({
            'date': summary['date'],
            'totalTraders': summary['totalTraders'],
            'present': summary['present'],
            'late': summary['late'],
            'absent': summary['absent'],
            'records': AttendanceSerializer(summary['records'], many=True, context={'request': request}).data,
        })


class AttendanceShiftViewSet(StandardizedModelViewSet):
    queryset = AttendanceShift.objects.all()
    serializer_class = AttendanceShiftSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    filterset_fields = ['is_active', 'name']
    search_fields = ['name', 'description']
    ordering_fields = ['start_time', 'end_time', 'name']


class AttendanceScheduleViewSet(StandardizedModelViewSet):
    queryset = AttendanceSchedule.objects.select_related('user', 'shift').all()
    serializer_class = AttendanceScheduleSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    filterset_fields = ['user', 'shift', 'is_active']
    search_fields = ['user__email', 'user__first_name', 'user__last_name', 'shift__name']
    ordering_fields = ['user__email', 'shift__start_time', 'is_active']

    @action(detail=False, methods=['post'], url_path='swap')
    def swap(self, request):
        user_id_a = request.data.get('userIdA')
        user_id_b = request.data.get('userIdB')

        if not user_id_a or not user_id_b:
            return error_response('Both userIdA and userIdB are required.', status=status.HTTP_400_BAD_REQUEST)

        if user_id_a == user_id_b:
            return error_response('Cannot swap schedule with the same trader.', status=status.HTTP_400_BAD_REQUEST)

        from users.models import User

        try:
            user_a = User.objects.get(id=user_id_a, role='trader')
            user_b = User.objects.get(id=user_id_b, role='trader')
        except User.DoesNotExist:
            return error_response('Trader not found.', status=status.HTTP_404_NOT_FOUND)

        schedule_a = AttendanceSchedule.objects.filter(user=user_a).select_related('shift').first()
        schedule_b = AttendanceSchedule.objects.filter(user=user_b).select_related('shift').first()

        if not schedule_a or not schedule_b:
            return error_response('Both traders must have schedules to perform a swap.', status=status.HTTP_400_BAD_REQUEST)

        temp = {
            'shift': schedule_a.shift,
            'start_date': schedule_a.start_date,
            'end_date': schedule_a.end_date,
            'is_active': schedule_a.is_active,
            'notes': schedule_a.notes,
        }
        schedule_a.shift = schedule_b.shift
        schedule_a.start_date = schedule_b.start_date
        schedule_a.end_date = schedule_b.end_date
        schedule_a.is_active = schedule_b.is_active
        schedule_a.notes = schedule_b.notes

        schedule_b.shift = temp['shift']
        schedule_b.start_date = temp['start_date']
        schedule_b.end_date = temp['end_date']
        schedule_b.is_active = temp['is_active']
        schedule_b.notes = temp['notes']

        schedule_a.save()
        schedule_b.save()

        serializer_a = AttendanceScheduleSerializer(schedule_a, context={'request': request})
        serializer_b = AttendanceScheduleSerializer(schedule_b, context={'request': request})
        return success_response({'schedules': [serializer_a.data, serializer_b.data]})


class AttendanceScheduleEntryViewSet(StandardizedModelViewSet):
    queryset = AttendanceScheduleEntry.objects.select_related('user', 'shift', 'cover_for').all()
    serializer_class = AttendanceScheduleEntrySerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    filterset_fields = ['user', 'date', 'assignment_type', 'cover_for']
    search_fields = ['user__email', 'user__first_name', 'user__last_name', 'shift__name', 'cover_for__email']
    ordering_fields = ['date', 'user__email', 'assignment_type']
