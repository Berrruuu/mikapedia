from rest_framework import serializers
from .models import AttendanceRecord, AttendanceSchedule, AttendanceScheduleEntry, AttendanceShift
from users.models import User
from users.serializers import UserSerializer


class AttendanceShiftSerializer(serializers.ModelSerializer):
    startTime = serializers.TimeField(source='start_time', format='%H:%M')
    endTime = serializers.TimeField(source='end_time', format='%H:%M')
    graceMinutes = serializers.IntegerField(source='grace_minutes')

    class Meta:
        model = AttendanceShift
        fields = ['id', 'name', 'startTime', 'endTime', 'graceMinutes', 'is_active', 'description']


class AttendanceScheduleSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    shift = AttendanceShiftSerializer(read_only=True)
    userId = serializers.PrimaryKeyRelatedField(source='user', queryset=User.objects.all(), write_only=True)
    shiftId = serializers.PrimaryKeyRelatedField(source='shift', queryset=AttendanceShift.objects.all(), write_only=True)
    startDate = serializers.DateField(source='start_date')
    endDate = serializers.DateField(source='end_date')

    class Meta:
        model = AttendanceSchedule
        fields = ['id', 'user', 'userId', 'shift', 'shiftId', 'startDate', 'endDate', 'is_active', 'notes']


class AttendanceScheduleEntrySerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    shift = AttendanceShiftSerializer(read_only=True)
    coverFor = UserSerializer(source='cover_for', read_only=True)
    userId = serializers.PrimaryKeyRelatedField(source='user', queryset=User.objects.all(), write_only=True)
    shiftId = serializers.PrimaryKeyRelatedField(source='shift', queryset=AttendanceShift.objects.all(), write_only=True, allow_null=True, required=False)
    coverForId = serializers.PrimaryKeyRelatedField(source='cover_for', queryset=User.objects.all(), write_only=True, allow_null=True, required=False)
    date = serializers.DateField()
    assignmentType = serializers.CharField(source='assignment_type')
    notes = serializers.CharField(allow_blank=True, required=False)

    class Meta:
        model = AttendanceScheduleEntry
        fields = [
            'id', 'user', 'userId', 'shift', 'shiftId', 'coverFor', 'coverForId',
            'date', 'assignmentType', 'notes',
        ]


class AttendanceSerializer(serializers.ModelSerializer):
    """Full attendance record — used by admin list"""
    user = UserSerializer(read_only=True)
    shift = AttendanceShiftSerializer(read_only=True)
    checkInTime = serializers.TimeField(source='check_in_time', format='%H:%M:%S', allow_null=True, read_only=True)
    gpsValid = serializers.BooleanField(source='gps_valid', read_only=True)
    gpsDistanceM = serializers.FloatField(source='gps_distance_m', allow_null=True, read_only=True)
    gpsAccuracyM = serializers.FloatField(source='gps_accuracy_m', allow_null=True, read_only=True)
    deviceInfo = serializers.CharField(source='device_info', read_only=True)
    ipAddress = serializers.IPAddressField(source='ip_address', allow_null=True, read_only=True)
    validatedBy = UserSerializer(source='validated_by', read_only=True, allow_null=True)
    validatedAt = serializers.DateTimeField(source='validated_at', allow_null=True, read_only=True)
    adminNote = serializers.CharField(source='admin_note', read_only=True)
    isValidated = serializers.BooleanField(source='is_validated', read_only=True)
    selfieUrl = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceRecord
        fields = [
            'id', 'user', 'date', 'shift', 'status', 'checkInTime',
            'selfieUrl', 'gpsValid', 'gpsDistanceM', 'gpsAccuracyM',
            'gps_lat', 'gps_lng', 'ipAddress', 'deviceInfo', 'browser', 'os',
            'isValidated', 'validatedBy', 'validatedAt', 'adminNote',
            'created_at',
        ]

    def get_selfieUrl(self, obj):
        if obj.selfie:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.selfie.url)
        return None


class AttendanceCheckInSerializer(serializers.Serializer):
    """Payload for POST /api/attendance/checkin/"""
    shift_id = serializers.IntegerField(required=False, allow_null=True)
    gps_lat = serializers.FloatField(required=False, allow_null=True)
    gps_lng = serializers.FloatField(required=False, allow_null=True)
    gps_accuracy_m = serializers.FloatField(required=False, allow_null=True)


class AdminValidateSerializer(serializers.Serializer):
    """Payload for PATCH /api/attendance/{id}/validate/"""
    status = serializers.ChoiceField(choices=['Present', 'Late', 'Absent'])
    admin_note = serializers.CharField(required=False, allow_blank=True)
