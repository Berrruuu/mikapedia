from django.apps import AppConfig


class IntegrationConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'integration'
    verbose_name = 'Integrations'

    def ready(self):
        # import signal handlers if any in future
        return None
