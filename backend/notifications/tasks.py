from celery import shared_task


@shared_task(bind=True)
def deliver_notification(self, notification_id: int):
    try:
        from notifications.models import Notification
        from notifications.serializers import NotificationSerializer
        from config.ws_broadcast import broadcast_notification
        notif = Notification.objects.get(id=notification_id)
        broadcast_notification(NotificationSerializer(notif).data)
    except Exception:
        raise
