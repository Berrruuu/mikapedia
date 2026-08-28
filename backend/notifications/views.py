from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from .serializers import NotificationSerializer
from .services import NotificationService
from common.api import StandardizedModelViewSet
from common.response import success_response


class NotificationViewSet(StandardizedModelViewSet):
    service = NotificationService()
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['read', 'type', 'level']
    search_fields = ['title', 'message']
    ordering_fields = ['created_at', 'read']

    def get_queryset(self):
        return self.service.get_queryset_for_user(self.request.user)

    @action(detail=True, methods=['patch'])
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        self.service.mark_read(notif)
        return success_response({'status': 'marked as read'})

    @action(detail=False, methods=['patch'])
    def mark_all_read(self, request):
        self.service.mark_all_read(request.user)
        return success_response({'status': 'all marked as read'})
