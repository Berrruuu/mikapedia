("""Configuration package for Django project. Initialize Celery here so
the app is available when Django starts.""")
try:
	# Import Celery app so it's discovered by `celery -A backend` and Django
	from ..celery_app import app as celery_app  # noqa: F401
except Exception:
	celery_app = None

