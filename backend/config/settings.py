"""
EduTest Pro — Django Settings
Reads all sensitive values from environment variables (.env via python-decouple).
"""

from datetime import timedelta
from pathlib import Path

from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent

# ── Sentry ────────────────────────────────────────────────────────────────────
_sentry_dsn = config("SENTRY_DSN", default="")
if _sentry_dsn:
    import sentry_sdk
    sentry_sdk.init(
        dsn=_sentry_dsn,
        environment=config("SENTRY_ENVIRONMENT", default="production"),
        traces_sample_rate=0.2,
        send_default_pii=False,
    )

# ── Security ──────────────────────────────────────────────────────────────────
SECRET_KEY = config("SECRET_KEY")
DEBUG = config("DEBUG", default=False, cast=bool)
ALLOWED_HOSTS = [h.strip() for h in config("ALLOWED_HOSTS", default="localhost,127.0.0.1,backend").split(",") if h.strip()]

CSRF_TRUSTED_ORIGINS = [h.strip() for h in config("CSRF_TRUSTED_ORIGINS", default="http://localhost,http://127.0.0.1").split(",") if h.strip()]

SECURE_SSL_REDIRECT = config("SECURE_SSL_REDIRECT", default=False, cast=bool)
SECURE_HSTS_SECONDS = config("SECURE_HSTS_SECONDS", default=0, cast=int)
SECURE_HSTS_INCLUDE_SUBDOMAINS = config("SECURE_HSTS_INCLUDE_SUBDOMAINS", default=False, cast=bool)
SESSION_COOKIE_SECURE = config("SESSION_COOKIE_SECURE", default=False, cast=bool)
CSRF_COOKIE_SECURE = config("CSRF_COOKIE_SECURE", default=False, cast=bool)

# Behind a TLS-terminating proxy (Render, Nginx, etc.) request.is_secure() is False
# unless we trust the X-Forwarded-Proto header. Required for auth cookies to get the
# Secure flag in production. Enable via SECURE_PROXY_SSL_HEADER=True on the platform.
if config("SECURE_PROXY_SSL_HEADER", default=False, cast=bool):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# ── Applications ──────────────────────────────────────────────────────────────
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    # Local
    "apps.exams",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "config.middleware.cookie_auth.CookieAuthMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# ── Database ──────────────────────────────────────────────────────────────────
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("POSTGRES_DB", default="edutest"),
        "USER": config("POSTGRES_USER", default="edutest"),
        "PASSWORD": config("POSTGRES_PASSWORD"),
        "HOST": config("POSTGRES_HOST", default="postgres"),
        "PORT": config("POSTGRES_PORT", default="5432"),
        "CONN_MAX_AGE": config("DB_CONN_MAX_AGE", default=60, cast=int),
    }
}

# Managed Postgres (Supabase) requires SSL. Set POSTGRES_SSLMODE=require in production.
_pg_sslmode = config("POSTGRES_SSLMODE", default="")
if _pg_sslmode:
    DATABASES["default"]["OPTIONS"] = {"sslmode": _pg_sslmode}

# ── Cache / Redis ─────────────────────────────────────────────────────────────
# django-redis backend: unlike Django's built-in RedisCache it supports
# delete_pattern(), which the dashboard cache invalidation relies on.
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": config("CACHE_URL"),
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        },
    }
}

# ── Auth ──────────────────────────────────────────────────────────────────────
AUTH_USER_MODEL = "exams.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ── REST Framework ────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "apps.exams.auth.StudentAttemptAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/hour",
        "user": "1000/hour",
    },
}

# ── JWT ───────────────────────────────────────────────────────────────────────
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=config("JWT_ACCESS_TOKEN_LIFETIME_MINUTES", default=60, cast=int)
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=config("JWT_REFRESH_TOKEN_LIFETIME_DAYS", default=7, cast=int)
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# ── CORS ──────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = [h.strip() for h in config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost,http://localhost:3000,http://127.0.0.1",
).split(",") if h.strip()]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = False

# ── Static & Media ────────────────────────────────────────────────────────────
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# ── Internationalization ──────────────────────────────────────────────────────
LANGUAGE_CODE = "es-pe"
TIME_ZONE = "America/Lima"
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ── Logging ───────────────────────────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] {levelname} {name}: {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "edutest": {"handlers": ["console"], "level": "DEBUG", "propagate": False},
        "django.request": {"handlers": ["console"], "level": "ERROR", "propagate": False},
    },
}

# ── Custom settings ────────────────────────────────────────────────────────────
MAX_IMPORT_FILE_SIZE_MB = 10
ATTEMPT_ABANDON_TIMEOUT_MINUTES = 15
EXAM_TIME_GRACE_SECONDS = 30