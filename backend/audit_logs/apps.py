from django.apps import AppConfig


class AuditLogsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'audit_logs'

    def ready(self):
        try:
            import audit_logs.signals  # noqa: F401
        except Exception:
            pass
