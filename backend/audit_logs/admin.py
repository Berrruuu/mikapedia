from django.contrib import admin
from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
	list_display = ('created_at', 'actor_label', 'action', 'category', 'severity', 'ip_address')
	list_filter = ('category', 'severity')
	search_fields = ('actor_label', 'action', 'metadata')
	readonly_fields = ('created_at',)

