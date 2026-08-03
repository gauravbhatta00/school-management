# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller --onedir spec for the desktop Django backend (Stage 3).

Builds a standalone `school-backend.exe` from backend/desktop_launcher.py so
Electron can start the backend without a system Python installation.

Run via `npm run build:backend` (from the repo root) or directly with:
    backend/.venv/Scripts/python.exe -m PyInstaller school-backend.spec --noconfirm

All paths are resolved relative to this spec file, not the invoking shell's
working directory, so the build is reproducible on any machine.

Why a live `django.setup()` at spec-build time: Django's migration and
template loaders discover files by walking each installed app's real
filesystem directory (`pkgutil.iter_modules`, `Path.glob`), not by following
Python `import` statements. PyInstaller's --onedir bundles pure-Python
modules as compiled bytecode inside an archive, so a plain hidden-import
list leaves migrations/templates undiscoverable at runtime. Introspecting
the actual app registry here lets us copy exactly the directories each
installed app needs, at the same dotted-path location Django expects.
"""

import os
import sys
from pathlib import Path

from PyInstaller.utils.hooks import collect_submodules

SPEC_DIR = Path(os.path.abspath(SPEC)).parent  # backend/
sys.path.insert(0, str(SPEC_DIR))

# Scratch-only settings for spec-time introspection. Never touches real user
# data (SCHOOL_DATA_DIR here is a throwaway folder under backend/build/,
# which is gitignored and cleaned by scripts/build_backend.py).
os.environ["DJANGO_ENV"] = "desktop"
os.environ.setdefault("SECRET_KEY", "pyinstaller-spec-introspection-only")
os.environ.setdefault(
    "SCHOOL_DATA_DIR", str(SPEC_DIR / "build" / "_spec_introspection_scratch")
)
os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings.desktop"

import django  # noqa: E402

django.setup()

from django.apps import apps as django_apps  # noqa: E402

# ─── hidden imports ───────────────────────────────────────────────────────
# Django/DRF/djoser resolve many classes purely by dotted string in settings
# (MIDDLEWARE, AUTHENTICATION_CLASSES, STORAGES, EMAIL_BACKEND, ROOT_URLCONF,
# djoser SERIALIZERS, apps.*.urls via include()) which PyInstaller's static
# analysis cannot see. collect_submodules per package covers those.
#
# django is collected as a whole minus contrib apps this project never
# installs or configures (gis/postgres/sites/redirects/sitemaps/flatpages/
# syndication/humanize/admindocs) — collecting all of django blindly risks
# pulling in optional native deps (e.g. GDAL for contrib.gis) this project
# has no use for.
_UNUSED_DJANGO_PREFIXES = (
    "django.contrib.gis",
    "django.contrib.sites",
    "django.contrib.postgres",
    "django.contrib.redirects",
    "django.contrib.sitemaps",
    "django.contrib.flatpages",
    "django.contrib.syndication",
    "django.contrib.humanize",
    "django.contrib.admindocs",
)


def _keep_django_submodule(name):
    return not name.startswith(_UNUSED_DJANGO_PREFIXES)


hiddenimports = []
hiddenimports += collect_submodules("django", filter=_keep_django_submodule)
hiddenimports += collect_submodules("apps")  # local Django apps (project code)
hiddenimports += collect_submodules("config")  # settings, urls, wsgi, desktop_* modules
hiddenimports += collect_submodules("rest_framework")
hiddenimports += collect_submodules("rest_framework_simplejwt")
hiddenimports += collect_submodules("djoser")
hiddenimports += collect_submodules("django_filters")
hiddenimports += collect_submodules("corsheaders")
hiddenimports += collect_submodules("whitenoise")
hiddenimports += collect_submodules("waitress")
hiddenimports += ["dj_database_url", "decouple", "PIL", "PIL.Image"]

# djoser.urls.jwt is only ever reached through Django's string-based
# include("djoser.urls.jwt") in config/urls.py — never a literal Python
# import — so it's invisible to static analysis. collect_submodules("djoser")
# can't discover it either: enumerating djoser.urls's own children requires
# importing djoser.urls in an isolated probe process that has no Django
# settings configured, which fails with AppRegistryNotReady. Listed
# explicitly so the JWT auth endpoints resolve in the frozen build.
hiddenimports += ["djoser.urls", "djoser.urls.base", "djoser.urls.jwt", "djoser.urls.authtoken"]

# ─── data files ───────────────────────────────────────────────────────────
# Every installed app's migrations/templates/locale, copied as real files at
# the same dotted-path location the app would occupy on a normal filesystem
# (app_config.name with dots replaced by slashes), so Django's disk-based
# discovery finds them inside the frozen bundle exactly like it would in a
# source checkout.
extra_datas = []
for app_config in django_apps.get_app_configs():
    app_path = Path(app_config.path)
    dest_prefix = app_config.name.replace(".", "/")
    for subdir in ("migrations", "templates", "locale"):
        src = app_path / subdir
        if src.is_dir():
            extra_datas.append((str(src), f"{dest_prefix}/{subdir}"))

# Django-internal template dirs not tied to any installed app, but used by
# forms/admin rendering and default error views regardless.
django_pkg_dir = Path(django.__path__[0])
for rel in ("forms/templates", "views/templates"):
    src = django_pkg_dir / rel
    if src.is_dir():
        extra_datas.append((str(src), f"django/{rel}"))

# WhiteNoise's CompressedManifestStaticFilesStorage needs collectstatic's
# output (staticfiles.json manifest + hashed files) generated at build time
# — never run inside the frozen bundle or on every startup. This directory
# must exist before PyInstaller runs; scripts/build_backend.py creates it.
staticfiles_dir = SPEC_DIR / "staticfiles"
if not staticfiles_dir.is_dir():
    raise SystemExit(
        "backend/staticfiles/ is missing. Run collectstatic before building "
        "(scripts/build_backend.py does this automatically) so Django admin "
        "assets are bundled: "
        ".venv\\Scripts\\python.exe manage.py collectstatic --noinput"
    )
extra_datas.append((str(staticfiles_dir), "staticfiles"))

a = Analysis(
    [str(SPEC_DIR / "desktop_launcher.py")],
    pathex=[str(SPEC_DIR)],
    binaries=[],
    datas=extra_datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Dev/lint/test-only tooling never needed to serve the backend.
        "black",
        "flake8",
        "isort",
        "mccabe",
        "pycodestyle",
        "pyflakes",
        "pytest",
        "pytest_django",
        "_pytest",
        "factory",
        "faker",
        "mypy_extensions",
        "tkinter",
    ],
    noarchive=False,
    optimize=0,
)

# PyInstaller ships its own hook-django.py (PyInstaller/hooks/hook-django.py),
# which runs automatically because "django" is a hidden import above. Besides
# a blanket collect_all('django') (harmless, if broad), it also does:
#   _patterns = ['*.db', 'db.*']
#   for p in _patterns: glob(<dir next to the Django project root>, p) ...
# — a heuristic for typical non-desktop Django layouts that ship the sqlite
# file alongside manage.py. In this repo that glob matches
# backend/db.sqlite3, the real local dev database, and would silently bundle
# it into the distributable. Desktop mode never uses a bundled database (see
# SCHOOL_DATA_DIR handling in config/settings/desktop.py and
# desktop_launcher.py), so strip that specific entry.
_BLOCKED_DATA_DEST = {"db.sqlite3"}
_blocked = [d for d in a.datas if d[0] in _BLOCKED_DATA_DEST]
if _blocked:
    print(f"[school-backend.spec] Excluding {len(_blocked)} unwanted data file(s) "
          f"pulled in by PyInstaller's built-in Django hook: "
          f"{[d[1] for d in _blocked]}")
a.datas = [d for d in a.datas if d[0] not in _BLOCKED_DATA_DEST]

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="school-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,  # Stage 3: keep visible for startup diagnostics (see README).
    disable_windowed_traceback=False,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="school-backend",
)
