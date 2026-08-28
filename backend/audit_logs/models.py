from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models


class AuditLog(models.Model):
    SEVERITY_CHOICES = (
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('high', 'High'),
        ('critical', 'Critical'),
    )
    CATEGORY_CHOICES = (
        ('auth', 'Authentication'),
        ('signal', 'Signal'),
        ('compliance', 'Compliance'),
        ('attendance', 'Attendance'),
        ('settings', 'Settings'),
        ('report', 'Report'),
        ('system', 'System'),
    )

    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    actor_label = models.CharField(max_length=100, default='system', help_text='Display name at time of action')
    action = models.TextField()
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='system')
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='info')
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    target_content_type = models.ForeignKey(ContentType, on_delete=models.SET_NULL, null=True, blank=True)
    target_object_id = models.UUIDField(null=True, blank=True)
    target_object = GenericForeignKey('target_content_type', 'target_object_id')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['category', 'severity']),
            models.Index(fields=['actor', 'created_at']),
        ]

    def __str__(self):
        return f"[{self.severity}] {self.actor_label}: {self.action[:80]}"
