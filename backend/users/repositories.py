from django.db.models import QuerySet

from .models import User


class UserRepository:
    def get_queryset(self) -> QuerySet:
        return User.objects.all()

    def get_queryset_for_user(self, user: User) -> QuerySet:
        if getattr(user, 'role', None) in ['owner', 'admin']:
            return self.get_queryset().order_by('-date_joined')
        return self.get_queryset().filter(id=user.id)

    def get_by_id(self, pk) -> User | None:
        return self.get_queryset().filter(pk=pk).first()

    def create(self, **kwargs) -> User:
        return User.objects.create(**kwargs)

    def update_fields(self, user: User, **updates) -> User:
        for field_name, value in updates.items():
            setattr(user, field_name, value)
        user.save(update_fields=list(updates.keys()))
        return user

    def set_avatar(self, user: User, avatar) -> User:
        user.avatar = avatar
        user.save(update_fields=['avatar'])
        return user

    def set_status(self, user: User, status: str) -> User:
        return self.update_fields(user, status=status)

    def set_password(self, user: User, password: str) -> User:
        user.set_password(password)
        user.save(update_fields=['password'])
        return user
