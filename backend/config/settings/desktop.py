"""Secure, local-only settings for the packaged Windows desktop application."""

import os
from pathlib import Path

from .base import *
from .base import BASE_DIR

DESKTOP_MODE = True
DEBUG = False

MIDDLEWARE += ["config.desktop_security.DesktopSecurityHeadersMiddleware"]

SCHOOL_DATA_DIR = Path(
    os.environ.get(
        "SCHOOL_DATA_DIR",
        Path(os.environ.get("LOCALAPPDATA", Path.home())) / "EduCore",
    )
).resolve()
SCHOOL_DATA_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_HOSTS = ["127.0.0.1", "localhost"]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": SCHOOL_DATA_DIR / "db.sqlite3",
        "OPTIONS": {"timeout": 20},
    }
}

MEDIA_URL = "/media/"
MEDIA_ROOT = SCHOOL_DATA_DIR / "media"
MEDIA_ROOT.mkdir(parents=True, exist_ok=True)

# Generated reports/exports and other persistent runtime files that aren't
# Django media (e.g. future PDF/CSV exports saved to disk) live here so they
# survive reinstalls/updates alongside the database and media.
REPORTS_ROOT = SCHOOL_DATA_DIR / "reports"
REPORTS_ROOT.mkdir(parents=True, exist_ok=True)

# Stage 5: diagnostic-report exports (apps.backups), and backups themselves.
# apps/backups/services.py creates the manual/automatic/safety/_staging
# subdirectories lazily on first use; only the top-level roots are created
# eagerly here, matching the existing MEDIA_ROOT/REPORTS_ROOT convention.
EXPORTS_ROOT = SCHOOL_DATA_DIR / "exports"
EXPORTS_ROOT.mkdir(parents=True, exist_ok=True)
BACKUPS_ROOT = SCHOOL_DATA_DIR / "backups"
BACKUPS_ROOT.mkdir(parents=True, exist_ok=True)
(SCHOOL_DATA_DIR / "config").mkdir(parents=True, exist_ok=True)

# Packaged/bundled assets (Django admin static files) stay repo/install
# relative, separate from user-generated data in SCHOOL_DATA_DIR.
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
FRONTEND_DIST = Path(
    os.environ.get("SCHOOL_FRONTEND_DIST", BASE_DIR.parent / "frontend" / "dist")
).resolve()

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"
    },
}

FRONTEND_URL = "http://127.0.0.1:8765"
CORS_ALLOWED_ORIGINS = [
    "http://127.0.0.1:8765",
    # Stage 2 (Electron dev only): React is served by the Vite dev server
    # on this origin while Waitress stays on 8765, so API calls from the
    # Electron-loaded page are cross-origin. Harmless when unused (e.g.
    # plain Stage 1 Waitress-serves-the-build testing, where the frontend
    # origin and API origin are the same and this entry is never hit).
    "http://127.0.0.1:5173",
]
# Stage 4 (packaged Electron app): the bundled React build is loaded via
# loadFile(), giving the renderer a "file://" origin — literally what
# Chromium sends as the Origin header on a cross-origin fetch/XHR from a
# file:// document, verified against this exact backend. Without this,
# every API call the packaged app makes is silently blocked client-side by
# the browser's own CORS enforcement (the backend responds fine either
# way; corsheaders' response headers are what the renderer refuses to let
# the page's JS read without this entry).
CORS_ALLOWED_ORIGINS.append("file://")
CORS_ALLOW_CREDENTIALS = False
CSRF_TRUSTED_ORIGINS = ["http://127.0.0.1:8765"]

SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Strict"
CSRF_COOKIE_SAMESITE = "Strict"
SECURE_REFERRER_POLICY = "no-referrer"

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": SCHOOL_DATA_DIR / "desktop.log",
            "maxBytes": 2 * 1024 * 1024,
            "backupCount": 3,
            "encoding": "utf-8",
        }
    },
    "root": {"handlers": ["file"], "level": "INFO"},
}
