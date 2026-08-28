from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),

    # Versioned API routes
    path('api/v1/auth/', include('authentication.urls')),
    path('api/v1/monitoring/', include('monitoring.urls')),
    path('api/v1/users/', include('users.urls')),
    path('api/v1/dashboard/', include('dashboard.urls')),
    path('api/v1/signals/', include('signals.urls')),
    path('api/v1/attendance/', include('attendance.urls')),
    path('api/v1/mt5/', include('mt5.urls')),
    path('api/v1/compliance/', include('compliance.urls')),
    path('api/v1/notifications/', include('notifications.urls')),
    path('api/v1/audit-logs/', include('audit_logs.urls')),
    path('api/v1/settings/', include('app_settings.urls')),
    path('api/v1/reports/', include('reports.urls')),
    path('api/v1/integration/', include('integration.urls')),

    # Backward-compatible legacy routes
    path('api/auth/', include('authentication.urls')),
    path('api/users/', include('users.urls')),
    path('api/dashboard/', include('dashboard.urls')),
    path('api/signals/', include('signals.urls')),
    path('api/attendance/', include('attendance.urls')),
    path('api/mt5/', include('mt5.urls')),
    path('api/compliance/', include('compliance.urls')),
    path('api/notifications/', include('notifications.urls')),
    path('api/audit-logs/', include('audit_logs.urls')),
    path('api/settings/', include('app_settings.urls')),
    path('api/reports/', include('reports.urls')),
    path('api/integration/', include('integration.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
