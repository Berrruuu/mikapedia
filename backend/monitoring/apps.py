from django.apps import AppConfig


class MonitoringConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'monitoring'

    def ready(self):
        # ensure any monitoring signals/tasks are imported
        try:
            import monitoring.tasks  # noqa: F401
        except Exception:
            pass
