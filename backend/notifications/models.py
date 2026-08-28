from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey, GenericRelation
from django.contrib.contenttypes.models import ContentType
from django.db import models

from common.models import SoftDeleteModel, TimestampedModel


class Notification(SoftDeleteModel, TimestampedModel):
    TYPE_CHOICES = (
        ('signal', 'Signal'),
        ('compliance', 'Compliance'),
        ('attendance', 'Attendance'),
        ('system', 'System'),
    )
    LEVEL_CHOICES = (
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('danger', 'Danger'),
        ('success', 'Success'),
    )

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        null=True,
        blank=True,
        help_text='Null means broadcast to all admins',
    )
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    title = models.CharField(max_length=255)
    level = models.CharField(max_length=10, choices=LEVEL_CHOICES, default='info')
    read = models.BooleanField(default=False)
    body = models.TextField(blank=True)
    related_content_type = models.ForeignKey(ContentType, on_delete=models.SET_NULL, null=True, blank=True)
    related_object_id = models.UUIDField(null=True, blank=True)
    related_object = GenericForeignKey('related_content_type', 'related_object_id')

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'read']),
            models.Index(fields=['type', 'level']),
        ]

    def __str__(self):
        return f"[{self.level}] {self.title}"
