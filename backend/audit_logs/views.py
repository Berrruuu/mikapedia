from rest_framework import viewsets, permissions
from .models import AuditLog
from .serializers import AuditLogSerializer
from django_filters import rest_framework as filters
from common.api import StandardizedReadOnlyModelViewSet
from common.permissions import IsOwnerOrAdmin


class AuditLogFilter(filters.FilterSet):
    severity = filters.CharFilter(field_name='severity')
    category = filters.CharFilter(field_name='category')
    search = filters.CharFilter(method='filter_search')

    def filter_search(self, queryset, name, value):
        return queryset.filter(action__icontains=value) | queryset.filter(actor_label__icontains=value)

    class Meta:
        model = AuditLog
        fields = ['severity', 'category']


class AuditLogViewSet(StandardizedReadOnlyModelViewSet):
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsOwnerOrAdmin]
    filterset_class = AuditLogFilter
    search_fields = ['action', 'actor_label', 'details']
    ordering_fields = ['created_at', 'severity']
