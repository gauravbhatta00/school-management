"""
Development settings - uses PostgreSQL for local setup.
"""

from .base import *

DEBUG = True

ALLOWED_HOSTS = ["*"]

# Local development defaults to PostgreSQL (matching docker-compose's `db`
# service), but can be switched to a zero-setup SQLite database with
# DB_ENGINE=sqlite3 — useful for quick local work without Postgres running.
DB_ENGINE = config("DB_ENGINE", default="postgresql")

if DB_ENGINE == "postgresql":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": config("DB_NAME", default="school_management"),
            "USER": config("DB_USER", default="postgres"),
            "PASSWORD": config("DB_PASSWORD", default="postgres"),
            "HOST": config("DB_HOST", default="localhost"),
            "PORT": config("DB_PORT", default="5432"),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": config("DB_NAME", default=str(BASE_DIR / "db.sqlite3")),
        }
    }

# Dev-only: show SQL queries
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {"class": "logging.StreamHandler"},
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django.db.backends": {
            "level": "DEBUG",
            "handlers": ["console"],
            "propagate": False,
        },
    },
}

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
