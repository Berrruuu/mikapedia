from django.core.exceptions import ValidationError

from .repositories import UserRepository
from audit_logs.utils import create_audit


class UserService:
    def __init__(self, repository: UserRepository | None = None):
        self.repository = repository or UserRepository()

    def get_queryset_for_user(self, user):
        return self.repository.get_queryset_for_user(user)

    def get_user_for_request(self, user, pk):
        obj = self.repository.get_by_id(pk)
        if obj is None:
            raise ValidationError('User not found.')
        if user.role not in ['owner', 'admin'] and obj != user:
            raise PermissionError('Forbidden')
        return obj

    def create_user(self, serializer_data: dict):
        user = self.repository.create(**serializer_data)
        try:
            create_audit(actor=None, action='user.created', category='system', severity='info', target=user, after=user)
        except Exception:
            pass
        return user

    def update_user(self, user, serializer_data: dict):
        before = None
        try:
            from django.forms.models import model_to_dict
            before = model_to_dict(user)
        except Exception:
            before = None
        updated = self.repository.update_fields(user, **serializer_data)
        try:
            create_audit(actor=None, action='user.updated', category='system', severity='info', target=updated, before=before, after=updated)
        except Exception:
            pass
        return updated

    def delete_user(self, user):
        try:
            create_audit(actor=None, action='user.deleted', category='system', severity='warning', target=user, before=user)
        except Exception:
            pass
        user.delete()
        return user

    def upload_avatar(self, user, avatar):
        before = None
        try:
            from django.forms.models import model_to_dict
            before = model_to_dict(user)
        except Exception:
            before = None
        updated = self.repository.set_avatar(user, avatar)
        try:
            create_audit(actor=None, action='user.avatar_uploaded', category='system', severity='info', target=updated, before=before, after=updated)
        except Exception:
            pass
        return updated

    def update_status(self, user, new_status: str):
        if new_status not in ('active', 'suspended', 'inactive'):
            raise ValidationError('Invalid status.')
        before = None
        try:
            from django.forms.models import model_to_dict
            before = model_to_dict(user)
        except Exception:
            before = None
        updated = self.repository.set_status(user, new_status)
        try:
            create_audit(actor=None, action='user.status_changed', category='system', severity='info', target=updated, before=before, after=updated)
        except Exception:
            pass
        return updated

    def reset_password(self, user, new_password: str):
        if len(new_password) < 8:
            raise ValidationError('Password must be at least 8 characters.')
        updated = self.repository.set_password(user, new_password)
        try:
            create_audit(actor=None, action='user.password_reset_by_admin', category='auth', severity='info', target=user)
        except Exception:
            pass
        return updated
