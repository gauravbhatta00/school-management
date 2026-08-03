"""
Base settings shared across all environments.
Multi-tenant School Management System
"""

from datetime import timedelta
from pathlib import Path
from urllib.parse import urlparse

import dj_database_url
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = config("SECRET_KEY", default="").strip() or "change-me-in-production"

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
    "django_filters",
    "djoser",
    # Local apps
    "apps.accounts",
    "apps.schools",
    "apps.students",
    "apps.teachers",
    "apps.attendance",
    "apps.applications",
    "apps.exams",
    "apps.fees",
    "apps.notices",
    "apps.backups",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # Custom middleware for school context
    "apps.schools.middleware.SchoolMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
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
ASGI_APPLICATION = "config.asgi.application"

# Custom User Model
AUTH_USER_MODEL = "accounts.User"

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"
    },
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ─── DRF Configuration ────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
}

# ─── JWT Configuration ────────────────────────────────────────────────────────
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# ─── Djoser Configuration ─────────────────────────────────────────────────────
FRONTEND_URL = config("FRONTEND_URL", default="http://localhost:5173").rstrip("/")
_frontend_url = urlparse(FRONTEND_URL)
_frontend_scheme = _frontend_url.scheme or "http"
_frontend_domain = _frontend_url.netloc or _frontend_url.path

DJOSER = {
    "LOGIN_FIELD": "email",
    "USER_CREATE_PASSWORD_RETYPE": True,
    "PASSWORD_RESET_CONFIRM_URL": "reset-password/{uid}/{token}",
    "EMAIL_FRONTEND_DOMAIN": _frontend_domain,
    "EMAIL_FRONTEND_PROTOCOL": _frontend_scheme,
    "EMAIL_FRONTEND_SITE_NAME": config("SITE_NAME", default="EduCore"),
    "SERIALIZERS": {
        "user": "apps.accounts.serializers.UserSerializer",
        "current_user": "apps.accounts.serializers.UserSerializer",
        "user_create": "apps.accounts.serializers.UserCreateSerializer",
        "user_create_password_retype": "apps.accounts.serializers.UserCreatePasswordRetypeSerializer",
        "password_reset": "apps.accounts.serializers.StudentTeacherPasswordResetSerializer",
    },
    "PERMISSIONS": {
        "user_list": ["rest_framework.permissions.IsAdminUser"],
    },
}

# ─── CORS Configuration ───────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000",
    cast=lambda v: [s.strip() for s in v.split(",")],
)
CORS_ALLOW_CREDENTIALS = True


# ─── Database configuration from DATABASE_URL or default sqlite ──────────────
from urllib.parse import urlparse, unquote

_db_url = config("DATABASE_URL", default="")


def _parse_database_url(url: str):
    """Lightweight DATABASE_URL parser to avoid a hard dependency on
    `dj-database-url`. Supports common schemes: postgres, mysql, sqlite.
    """
    parsed = urlparse(url)
    scheme = parsed.scheme

    if scheme in ("sqlite", "sqlite3"):
        # sqlite:///relative/path or sqlite:////absolute/path
        path = parsed.path or ""
        if path.startswith("/") and path.count("/") >= 2:
            name = BASE_DIR / path.lstrip("/")
        else:
            name = path or (BASE_DIR / "db.sqlite3")
        return {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": name,
        }

    # Postgres / MySQL style
    if scheme.startswith("postgres") or scheme.startswith("pgsql"):
        engine = "django.db.backends.postgresql"
    elif scheme.startswith("mysql"):
        engine = "django.db.backends.mysql"
    else:
        # Unknown scheme, fallback to sqlite
        return {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }

    name = parsed.path.lstrip("/") if parsed.path else ""
    user = unquote(parsed.username) if parsed.username else ""
    password = unquote(parsed.password) if parsed.password else ""
    host = parsed.hostname or ""
    port = str(parsed.port) if parsed.port else ""

    cfg = {
        "ENGINE": engine,
        "NAME": name,
    }
    if user:
        cfg["USER"] = user
    if password:
        cfg["PASSWORD"] = password
    if host:
        cfg["HOST"] = host
    if port:
        cfg["PORT"] = port

    return cfg


if _db_url:
    try:
        import dj_database_url

        DATABASES = {
            "default": dj_database_url.config(
                default=_db_url,
                conn_max_age=600,
                conn_health_checks=True,
            )
        }
    except Exception:
        # Fallback to the lightweight parser if dj-database-url isn't installed
        DATABASES = {"default": _parse_database_url(_db_url)}
else:
    # Default to SQLite if DATABASE_URL not set
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}
