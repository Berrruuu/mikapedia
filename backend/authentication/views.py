import secrets
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth import authenticate
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from users.models import User
from users.serializers import UserSerializer, ChangePasswordSerializer
from common.response import success_response, error_response
from audit_logs.utils import create_audit


def _token_pair(user):
    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token), str(refresh)


# ─── Login ────────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """
    POST /api/auth/login/
    Body: { email, password, remember }
    Returns: { user, access, refresh }
    """
    email = request.data.get('email', '').strip().lower()
    password = request.data.get('password', '')

    if not email or not password:
        return error_response('Email and password are required.', status=status.HTTP_400_BAD_REQUEST, code='validation_error')

    try:
        user_obj = User.objects.get(email=email)
    except User.DoesNotExist:
        return error_response('Invalid email or password.', status=status.HTTP_401_UNAUTHORIZED, code='authentication_failed')

    if user_obj.status != 'active':
        return error_response('Account is suspended or inactive.', status=status.HTTP_403_FORBIDDEN, code='forbidden')

    user = authenticate(request, username=user_obj.username, password=password)
    if user is None:
        return error_response('Invalid email or password.', status=status.HTTP_401_UNAUTHORIZED, code='authentication_failed')

    access, refresh = _token_pair(user)
    # Audit: successful login
    create_audit(request=request, action='auth.login', category='auth', severity='info', actor=user)
    return success_response({
        'user': UserSerializer(user).data,
        'access': access,
        'refresh': refresh,
    })


# ─── Logout ───────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """
    POST /api/auth/logout/
    Body: { refresh }  — blacklists the refresh token
    """
    refresh_token = request.data.get('refresh')
    if refresh_token:
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            pass  # already invalid — fine
    create_audit(request=request, action='auth.logout', category='auth', severity='info', actor=request.user)
    return success_response({'detail': 'Logged out successfully.'})


# ─── Me ───────────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    """GET /api/auth/me/"""
    return success_response(UserSerializer(request.user).data)


# ─── Refresh token ────────────────────────────────────────────────────────────
# Handled by rest_framework_simplejwt.views.TokenRefreshView (in urls.py)


# ─── Forgot password ──────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def forgot_password_view(request):
    """
    POST /api/auth/forgot-password/
    Body: { email }
    Generates a reset token (in production, send via email).
    """
    email = request.data.get('email', '').strip().lower()
    if not email:
        return Response({'detail': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

    # Always return 200 to prevent email enumeration
    try:
        user = User.objects.get(email=email)
        token = secrets.token_urlsafe(32)
        user.password_reset_token = token
        user.password_reset_expires = timezone.now() + timedelta(hours=1)
        user.save(update_fields=['password_reset_token', 'password_reset_expires'])

        # TODO: send email — for now return token in dev mode
        from django.conf import settings
        response_data = {'detail': 'If that email exists, a reset link has been sent.'}
        if settings.DEBUG:
            response_data['reset_token'] = token  # only visible in DEBUG
    except User.DoesNotExist:
        response_data = {'detail': 'If that email exists, a reset link has been sent.'}

        create_audit(request=request, action='auth.forgot_password', category='auth', severity='info', actor=user)
    return success_response(response_data)


# ─── Reset password ───────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def reset_password_view(request):
    """
    POST /api/auth/reset-password/
    Body: { token, new_password }
    """
    token = request.data.get('token', '').strip()
    new_password = request.data.get('new_password', '')

    if not token or not new_password:
        return error_response('Token and new_password are required.', status=status.HTTP_400_BAD_REQUEST, code='validation_error')

    if len(new_password) < 8:
        return error_response('Password must be at least 8 characters.', status=status.HTTP_400_BAD_REQUEST, code='validation_error')

    try:
        user = User.objects.get(password_reset_token=token)
    except User.DoesNotExist:
        return error_response('Invalid or expired reset token.', status=status.HTTP_400_BAD_REQUEST, code='validation_error')

    if user.password_reset_expires and timezone.now() > user.password_reset_expires:
        return error_response('Reset token has expired.', status=status.HTTP_400_BAD_REQUEST, code='validation_error')

    user.set_password(new_password)
    user.password_reset_token = None
    user.password_reset_expires = None
    user.save(update_fields=['password', 'password_reset_token', 'password_reset_expires'])

    create_audit(request=request, action='auth.reset_password', category='auth', severity='info', actor=user)

    return success_response({'detail': 'Password reset successfully. You can now log in.'})


# ─── Change password ──────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password_view(request):
    """
    POST /api/auth/change-password/
    Body: { old_password, new_password }
    """
    serializer = ChangePasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = request.user
    if not user.check_password(serializer.validated_data['old_password']):
        return error_response('Current password is incorrect.', status=status.HTTP_400_BAD_REQUEST, code='validation_error')

    user.set_password(serializer.validated_data['new_password'])
    user.save(update_fields=['password'])

    # Re-issue tokens so user stays logged in
    access, refresh = _token_pair(user)
    create_audit(request=request, action='auth.change_password', category='auth', severity='info', actor=user)
    return success_response({
        'detail': 'Password changed successfully.',
        'access': access,
        'refresh': refresh,
    })
