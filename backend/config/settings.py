"""
Django settings for MIKAPEDIA TOMS Backend
"""

from pathlib import Path
from datetime import timedelta
from decouple import config, Csv

BASE_DIR = Path(__file__).resolve().parent.parent

# Security
SECRET_KEY = config('SECRET_KEY', default='django-insecure-change-this-in-production')
DEBUG = config('DEBUG', default=True, cast=bool)
# Default allowed hosts for local development. Use env `ALLOWED_HOSTS` to override.
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=Csv())

# Shared webhook secret for TradingView alerts.
TRADINGVIEW_WEBHOOK_SECRET = config('TRADINGVIEW_WEBHOOK_SECRET', default='')

# When running in DEBUG, allow common local tunnel hosts (e.g. localtunnel/ngrok)
if DEBUG:
    # Allow a specific localtunnel host used during development; append if not present.
    # Allow any localtunnel subdomain and common tunnel providers to hit the dev server.
    _dev_patterns = ['.loca.lt', '.ngrok.io', '.ngrok-free.dev', '.ngrok-free.app', '.ngrok.app']
    for _p in _dev_patterns:
        if _p not in ALLOWED_HOSTS:
            ALLOWED_HOSTS.append(_p)

# Application definition
INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third party
    'channels',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    
    # Local apps
    'authentication.apps.AuthenticationConfig',
    'users.apps.UsersConfig',
    'dashboard.apps.DashboardConfig',
    'attendance.apps.AttendanceConfig',
    'signals.apps.SignalsConfig',
    'mt5.apps.Mt5Config',
    'compliance.apps.ComplianceConfig',
    'reports.apps.ReportsConfig',
    'notifications.apps.NotificationsConfig',
    'app_settings.apps.AppSettingsConfig',
    'audit_logs.apps.AuditLogsConfig',
    'monitoring.apps.MonitoringConfig',
    'integration.apps.IntegrationConfig',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Serve static files efficiently
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'audit_logs.middleware.AuditRequestMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Database
DB_NAME = config('DB_NAME', default='db.sqlite3')
if DB_NAME and not Path(DB_NAME).is_absolute():
    DB_NAME = BASE_DIR / DB_NAME

DATABASES = {
    'default': {
        'ENGINE': config('DB_ENGINE', default='django.db.backends.postgresql'),
        'NAME': DB_NAME,
        'USER': config('DB_USER', default='postgres'),
        'PASSWORD': config('DB_PASSWORD', default=''),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='5432'),
    }
}

# Use in-memory SQLite for test runs when the project is configured to use SQLite.
if 'sqlite' in str(DATABASES['default'].get('ENGINE', '')).lower():
    DATABASES['default']['TEST'] = {'NAME': ':memory:'}

# Custom User Model
AUTH_USER_MODEL = 'users.User'

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Jakarta'
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# WhiteNoise — compressed & hashed static file serving
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage' if not DEBUG else 'django.contrib.staticfiles.storage.StaticFilesStorage'

MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Django REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    'DATETIME_FORMAT': '%Y-%m-%dT%H:%M:%S%z',
    # Use DRF built-ins here to avoid import-time circular imports with our
    # `common.api` module. The project will still use the standardized
    # behavior in viewsets; custom handlers/renderers can be reintroduced
    # once imported lazily or moved to a lightweight module.
    'EXCEPTION_HANDLER': 'rest_framework.views.exception_handler',
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ) + (('rest_framework.renderers.BrowsableAPIRenderer',) if DEBUG else ()),
}

# JWT Settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=config('JWT_ACCESS_TOKEN_LIFETIME_MINUTES', default=60, cast=int)),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=config('JWT_REFRESH_TOKEN_LIFETIME_DAYS', default=7, cast=int)),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': config('JWT_SECRET_KEY', default=SECRET_KEY),
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',
}

# Integration / EA token
EA_INTEGRATION_TOKEN = config('EA_INTEGRATION_TOKEN', default='')

# CORS Settings
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:5173,http://127.0.0.1:5173',
    cast=Csv()
)
CORS_ALLOW_CREDENTIALS = True

APPEND_SLASH = True

# In DEBUG, also allow any ngrok/tunnel origin so dev webhook testing works
if DEBUG:
    CORS_ALLOWED_ORIGIN_REGEXES = [
        r'^https://.*\.ngrok-free\.app$',
        r'^https://.*\.ngrok\.app$',
        r'^https://.*\.ngrok\.io$',
        r'^https://.*\.loca\.lt$',
    ]

# Security (production hardening)
if not DEBUG:
    SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=True, cast=bool)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_HSTS_SECONDS = 31536000  # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# CSRF trusted origins (needed when behind reverse proxy)
CSRF_TRUSTED_ORIGINS = config(
    'CSRF_TRUSTED_ORIGINS',
    default=','.join(CORS_ALLOWED_ORIGINS),
    cast=Csv()
)

# ── Logging ──────────────────────────────────────────────────────────────────
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO' if not DEBUG else 'DEBUG',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'WARNING' if not DEBUG else 'INFO',
            'propagate': False,
        },
        'django.request': {
            'handlers': ['console'],
            'level': 'ERROR',
            'propagate': False,
        },
    },
}

# ─── Django Channels ──────────────────────────────────────────────────────────
ASGI_APPLICATION = 'config.asgi.application'

# ASGI / Channels configuration
# Prefer a Redis URL in production. In DEBUG, default to empty so the
# in-memory channel layer is used when Redis is not available locally.
REDIS_URL = config('REDIS_URL', default=('' if DEBUG else 'redis://127.0.0.1:6379'))

# Use RedisChannelLayer when REDIS_URL is configured, otherwise fall back
# to the in-memory channel layer (suitable for local development).
if REDIS_URL:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {
                'hosts': [REDIS_URL],
            },
        }
    }
else:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer',
        }
    }

# Celery configuration
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE

# Periodic tasks (Celery Beat) - fallback to simple second-based schedules
CELERY_BEAT_SCHEDULE = {
    'sweep-expired-signals-every-5-min': {
        'task': 'compliance.tasks.sweep_expired_signals',
        'schedule': 300.0,  # every 5 minutes
    },
    'auto-update-signal-statuses-every-minute': {
        'task': 'signals.tasks.auto_update_signal_statuses',
        'schedule': 60.0,   # every 1 minute
    },
    'sync-connected-accounts-every-1-sec': {
        'task': 'mt5.tasks.sync_connected_accounts',
        'schedule': 1.0,  # every 1 second for near-live MT5 updates
    },
    'sync-all-accounts-every-5-min': {
        'task': 'mt5.tasks.sync_all_accounts',
        'schedule': 300.0,  # 5 minutes
    },
    'cleanup-old-records-daily': {
        'task': 'maintenance.tasks.prune_old_records',
        'schedule': 86400.0,  # daily
    },
    'health-check-every-minute': {
        'task': 'maintenance.tasks.health_check',
        'schedule': 60.0,
    },
    'monitor-collect-every-30-sec': {
        'task': 'monitoring.tasks.collect_and_broadcast',
        'schedule': 30.0,
    },
}
