from rest_framework import serializers
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    actorLabel = serializers.CharField(source='actor_label')
    ipAddress = serializers.IPAddressField(source='ip_address', allow_null=True)
    time = serializers.DateTimeField(source='created_at', format='%H:%M:%S')

    class Meta:
        model = AuditLog
        fields = ['id', 'time', 'actorLabel', 'action', 'category', 'severity', 'ipAddress', 'created_at']
