from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from django.utils import timezone
from .models import ComplianceRecord, SOPWarning
from .serializers import ComplianceRecordSerializer, SOPWarningSerializer
from common.api import StandardizedReadOnlyModelViewSet
from common.response import success_response, error_response


class ComplianceViewSet(StandardizedReadOnlyModelViewSet):
    serializer_class = ComplianceRecordSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['status', 'signal', 'user']
    search_fields = ['status', 'user__email', 'signal__pair']
    ordering_fields = ['created_at', 'status']

    def get_queryset(self):
        user = self.request.user
        if user.role in ['owner', 'admin']:
            return ComplianceRecord.objects.select_related('user', 'signal').all()
        return ComplianceRecord.objects.filter(user=user).select_related('signal')


class SOPWarningViewSet(viewsets.ModelViewSet):
    serializer_class = SOPWarningSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'patch', 'head', 'options']
    filterset_fields  = ['severity', 'acknowledged', 'violation_type']
    ordering_fields   = ['created_at', 'severity']

    def get_queryset(self):
        user = self.request.user
        if user.role in ['owner', 'admin']:
            return SOPWarning.objects.select_related('user', 'compliance_result').all()
        return SOPWarning.objects.filter(user=user).select_related('compliance_result')

    def partial_update(self, request, *args, **kwargs):
        warning = self.get_object()
        # Only allow acknowledging own warnings (or owner/admin)
        if request.user.role not in ['owner', 'admin'] and warning.user != request.user:
            return error_response('Forbidden', status=status.HTTP_403_FORBIDDEN, code='forbidden')

        if request.data.get('acknowledged'):
            warning.acknowledged = True
            warning.acknowledged_at = timezone.now()
            warning.save(update_fields=['acknowledged', 'acknowledged_at'])

        return success_response(SOPWarningSerializer(warning).data)
