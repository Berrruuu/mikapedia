from rest_framework import viewsets, permissions, status, parsers
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import User
from .serializers import UserSerializer, UserCreateSerializer, UserUpdateSerializer
from .services import UserService
from common.api import StandardizedModelViewSet
from common.response import success_response, error_response
from common.permissions import IsOwnerOrAdmin


class IsAdminOrSelf(permissions.BasePermission):
    """Owner/Admin can do anything; traders can only read/update themselves"""
    def has_object_permission(self, request, view, obj):
        if request.user.role in ['owner', 'admin']:
            return True
        # Traders can only GET/PATCH their own profile
        return obj == request.user and request.method in ('GET', 'PATCH')


class UserViewSet(StandardizedModelViewSet):
    service = UserService()
    """
    GET    /api/users/          — list all (admin only)
    POST   /api/users/          — create user (admin only)
    GET    /api/users/{id}/     — retrieve user
    PATCH  /api/users/{id}/     — update user
    DELETE /api/users/{id}/     — delete user (admin only)
    POST   /api/users/{id}/avatar/  — upload avatar
    POST   /api/users/{id}/suspend/ — suspend/activate
    """
    queryset = User.objects.all()
    parser_classes = [parsers.MultiPartParser, parsers.JSONParser]
    filterset_fields = ['role', 'status']
    search_fields = ['email', 'first_name', 'last_name', 'username']
    ordering_fields = ['date_joined', 'created_at', 'email']

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        if self.action in ('update', 'partial_update'):
            return UserUpdateSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [IsOwnerOrAdmin()]
        if self.action == 'destroy':
            return [IsOwnerOrAdmin()]
        if self.action == 'list':
            return [IsOwnerOrAdmin()]
        return [permissions.IsAuthenticated(), IsAdminOrSelf()]

    def get_queryset(self):
        return self.service.get_queryset_for_user(self.request.user)

    # ── Avatar upload ──────────────────────────────────────────────────────────
    @action(detail=True, methods=['post'], parser_classes=[parsers.MultiPartParser])
    def avatar(self, request, pk=None):
        user = self.get_object()
        if 'avatar' not in request.FILES:
            return error_response('No avatar file provided.', status=status.HTTP_400_BAD_REQUEST, code='validation_error')
        updated_user = self.service.upload_avatar(user, request.FILES['avatar'])
        return success_response(UserSerializer(updated_user).data)

    # ── Suspend / activate ────────────────────────────────────────────────────
    @action(detail=True, methods=['post'], permission_classes=[IsOwnerOrAdmin])
    def suspend(self, request, pk=None):
        user = self.get_object()
        new_status = request.data.get('status', 'suspended')
        try:
            updated_user = self.service.update_status(user, new_status)
        except Exception as exc:
            return error_response(str(exc), status=status.HTTP_400_BAD_REQUEST, code='validation_error')
        return success_response({'id': str(updated_user.id), 'status': updated_user.status})

    # ── Reset password by admin ───────────────────────────────────────────────
    @action(detail=True, methods=['post'], permission_classes=[IsOwnerOrAdmin], url_path='reset-password')
    def reset_password(self, request, pk=None):
        user = self.get_object()
        new_password = request.data.get('new_password', '')
        try:
            self.service.reset_password(user, new_password)
        except Exception as exc:
            return error_response(str(exc), status=status.HTTP_400_BAD_REQUEST, code='validation_error')
        return success_response({'detail': f'Password for {user.email} reset successfully.'})
