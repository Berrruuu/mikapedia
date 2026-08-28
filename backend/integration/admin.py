from django.contrib import admin
from .models import IntegrationReceipt


@admin.register(IntegrationReceipt)
class IntegrationReceiptAdmin(admin.ModelAdmin):
    list_display = ('source', 'event_id', 'processed', 'received_at', 'processed_at')
    list_filter = ('source', 'processed')
    search_fields = ('event_id',)
