from rest_framework import serializers
from .models import ComplianceRecord, SOPWarning
from users.serializers import UserSerializer
from signals.serializers import SignalSerializer


class ComplianceRecordSerializer(serializers.ModelSerializer):
    user            = UserSerializer(read_only=True)
    signal          = SignalSerializer(read_only=True)
    actualDirection = serializers.CharField(source='actual_direction', allow_null=True)
    actualEntry     = serializers.FloatField(source='actual_entry', allow_null=True)
    actualEntryTime = serializers.TimeField(source='actual_entry_time', allow_null=True)
    coachingNote    = serializers.CharField(source='coaching_note')
    violations      = serializers.ListField(child=serializers.CharField(), default=list)
    # 3-position tracking fields
    entryCount      = serializers.IntegerField(source='entry_count', read_only=True)
    missingEntries  = serializers.IntegerField(source='missing_entries', read_only=True)
    entry1Ticket    = serializers.IntegerField(source='entry1_ticket', allow_null=True, read_only=True)
    entry2Ticket    = serializers.IntegerField(source='entry2_ticket', allow_null=True, read_only=True)
    entry3Ticket    = serializers.IntegerField(source='entry3_ticket', allow_null=True, read_only=True)

    class Meta:
        model = ComplianceRecord
        fields = [
            'id', 'user', 'signal', 'status', 'score',
            'actualDirection', 'actualEntry', 'actualEntryTime',
            'coachingNote', 'violations',
            'entryCount', 'missingEntries',
            'entry1Ticket', 'entry2Ticket', 'entry3Ticket',
            'created_at',
        ]


class SOPWarningSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = SOPWarning
        fields = [
            'id', 'user', 'violation_type', 'severity',
            'message', 'acknowledged', 'acknowledged_at', 'created_at',
        ]
        read_only_fields = ['id', 'user', 'violation_type', 'severity', 'message', 'created_at']
