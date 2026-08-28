from django.db.models import QuerySet

from .models import Notification


class NotificationRepository:
    def get_queryset_for_user(self, user) -> QuerySet:
        return Notification.objects.filter(recipient=user) | Notification.objects.filter(recipient__isnull=True)

    def get_by_id(self, pk) -> Notification | None:
        return self.get_queryset_for_user(None).filter(pk=pk).first()

    def mark_read(self, notification: Notification) -> Notification:
        notification.read = True
        notification.save(update_fields=['read'])
        return notification

    def mark_all_read(self, user) -> int:
        return self.get_queryset_for_user(user).update(read=True)
