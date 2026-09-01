from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .models import SystemSettings
from .serializers import SystemSettingsSerializer
from common.response import success_response, error_response
from audit_logs.utils import create_audit
from common.permissions import IsOwnerOrAdmin


@api_view(['GET', 'PATCH'])
@permission_classes([IsOwnerOrAdmin])
def settings_view(request):
    """
    GET  /api/settings/  — retrieve current settings
    PATCH /api/settings/ — update settings
    """
    instance = SystemSettings.get()

    if request.method == 'GET':
        serializer = SystemSettingsSerializer(instance)
        return success_response(serializer.data)

    serializer = SystemSettingsSerializer(instance, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        try:
            create_audit(actor=request.user, action='settings.updated', category='settings', severity='info', target=instance, after=instance, metadata={'changes': serializer.validated_data})
        except Exception:
            pass
        return success_response(serializer.data)
    return error_response('Validation failed.', status=status.HTTP_400_BAD_REQUEST, code='validation_error', details=serializer.errors)
