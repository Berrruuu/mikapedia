from .repositories import NotificationRepository


class NotificationService:
    def __init__(self, repository: NotificationRepository | None = None):
        self.repository = repository or NotificationRepository()

    def get_queryset_for_user(self, user):
        return self.repository.get_queryset_for_user(user)

    def mark_read(self, notification):
        return self.repository.mark_read(notification)

    def mark_all_read(self, user):
        return self.repository.mark_all_read(user)
