"""Builds the standalone desktop backend executable (Stage 3).

Usage:
    backend/.venv/Scripts/python.exe scripts/build_backend.py
or, from the repo root:
    npm run build:backend

Steps:
    1. Clean previous PyInstaller output for this spec only.
    2. Run collectstatic into backend/staticfiles (build-time only, using a
       throwaway SCHOOL_DATA_DIR — never the real user data directory, and
       never re-run at packaged-app startup).
    3. Run PyInstaller against the committed school-backend.spec.
    4. Print the resulting executable path and size, or exit non-zero.
"""

import os
import secrets
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
SPEC_FILE = BACKEND_DIR / "school-backend.spec"
DIST_DIR = BACKEND_DIR / "dist" / "school-backend"
BUILD_DIR = BACKEND_DIR / "build" / "school-backend"
# Scratch dir the spec file uses at analysis time to introspect the Django
# app registry (see school-backend.spec) — never real user data, safe to wipe.
SPEC_SCRATCH_DIR = BACKEND_DIR / "build" / "_spec_introspection_scratch"
STATICFILES_DIR = BACKEND_DIR / "staticfiles"
EXE_PATH = DIST_DIR / "school-backend.exe"


def _run(cmd, **kwargs):
    print(f"[build_backend] $ {' '.join(str(c) for c in cmd)}")
    result = subprocess.run(cmd, cwd=BACKEND_DIR, **kwargs)
    if result.returncode != 0:
        print(f"[build_backend] Command failed with exit code {result.returncode}.")
        sys.exit(result.returncode)


def clean_previous_output():
    """Removes only this spec's own PyInstaller output directories.

    Deliberately scoped to backend/dist/school-backend and
    backend/build/school-backend (not the whole dist/ or build/ trees) so a
    stray unrelated artifact placed there by hand is never silently deleted.
    """
    for path in (DIST_DIR, BUILD_DIR, SPEC_SCRATCH_DIR):
        if path.exists():
            print(f"[build_backend] Removing previous output: {path}")
            shutil.rmtree(path)


def collect_static_assets():
    """Bundles Django admin / DRF / djoser static assets ahead of freezing.

    WhiteNoise's CompressedManifestStaticFilesStorage needs collectstatic's
    manifest to exist; running it here (build time, real venv) avoids ever
    needing to run collectstatic inside the frozen executable.
    """
    with tempfile.TemporaryDirectory(prefix="school-backend-build-") as scratch:
        env = {
            "SCHOOL_DATA_DIR": scratch,
            "DJANGO_ENV": "desktop",
            "DJANGO_SETTINGS_MODULE": "config.settings.desktop",
            "SECRET_KEY": secrets.token_urlsafe(64),
        }
        print("[build_backend] Running collectstatic...")
        _run(
            [
                sys.executable,
                "manage.py",
                "collectstatic",
                "--noinput",
                "--clear",
            ],
            env={**dict(os.environ), **env},
        )


def run_pyinstaller():
    print("[build_backend] Running PyInstaller (--onedir, via committed spec)...")
    _run(
        [
            sys.executable,
            "-m",
            "PyInstaller",
            str(SPEC_FILE),
            "--noconfirm",
            "--clean",
        ]
    )


def report_result():
    if not EXE_PATH.is_file():
        print(f"[build_backend] Expected executable not found at {EXE_PATH}.")
        sys.exit(1)

    total_size = sum(f.stat().st_size for f in DIST_DIR.rglob("*") if f.is_file())
    size_mb = total_size / (1024 * 1024)
    print("[build_backend] Build succeeded.")
    print(f"[build_backend] Executable: {EXE_PATH}")
    print(f"[build_backend] Onedir output size: {size_mb:.1f} MB ({DIST_DIR})")


def main():
    if not SPEC_FILE.is_file():
        print(f"[build_backend] Spec file not found: {SPEC_FILE}")
        sys.exit(1)

    clean_previous_output()
    collect_static_assets()
    run_pyinstaller()
    report_result()


if __name__ == "__main__":
    main()
