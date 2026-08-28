import os
from django.apps import AppConfig


class SignalsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'signals'

    def ready(self):
        # Only start scheduler in the main process (not in migrations, tests, etc.)
        # RUN_MAIN is set by Django's auto-reloader for the main worker process.
        run_main = os.environ.get('RUN_MAIN')
        is_manage = os.environ.get('DJANGO_SETTINGS_MODULE')

        # Skip during management commands like migrate, makemigrations, test
        import sys
        skip_commands = {'migrate', 'makemigrations', 'test', 'collectstatic', 'check', 'shell'}
        argv = set(sys.argv[1:2])
        if argv & skip_commands:
            return

        # Skip in runserver's reloader subprocess (only run in main process)
        if run_main == 'true' or 'runserver' not in sys.argv:
            try:
                from signals.scheduler import start
                start()
            except Exception:
                import logging
                logging.getLogger('signals.scheduler').exception(
                    'Failed to start signal scheduler from AppConfig.ready()'
                )
