"""Launch the packaged Django application with Waitress on loopback only.

Does not use Django's development server. Binds to 127.0.0.1 only.
"""

import errno
import logging
import os
import secrets
import socket
import stat
import sys
from pathlib import Path

HOST = "127.0.0.1"
PORT = 8765

logger = logging.getLogger("desktop_launcher")


def _data_dir():
    configured = os.environ.get("SCHOOL_DATA_DIR")
    if configured:
        return Path(configured).expanduser().resolve()
    local_app_data = os.environ.get("LOCALAPPDATA")
    root = Path(local_app_data) if local_app_data else Path.home()
    return (root / "EduCore").resolve()


def _ensure_data_dir(data_dir):
    """Create the persistent data directory, failing loudly if it can't be used."""
    try:
        data_dir.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        raise RuntimeError(
            f"Cannot create or access the data directory at {data_dir}: {exc}"
        ) from exc
    if not os.access(data_dir, os.W_OK):
        raise RuntimeError(f"The data directory at {data_dir} is not writable.")


def _setup_logging(data_dir):
    """Configure launcher-level logging before Django's own logging exists."""
    handlers = [logging.StreamHandler(sys.stderr)]
    try:
        handlers.append(
            logging.FileHandler(data_dir / "launcher.log", encoding="utf-8")
        )
    except OSError:
        pass  # Non-fatal: fall back to console-only logging.
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        handlers=handlers,
        force=True,
    )


def _load_or_create_secret(data_dir):
    secret_path = data_dir / ".django-secret"
    try:
        secret = secret_path.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        secret = secrets.token_urlsafe(64)
        try:
            with secret_path.open("x", encoding="utf-8") as secret_file:
                secret_file.write(secret)
        except FileExistsError:
            secret = secret_path.read_text(encoding="utf-8").strip()
        try:
            secret_path.chmod(stat.S_IREAD | stat.S_IWRITE)
        except OSError:
            pass
    if len(secret) < 50:
        raise RuntimeError("The persisted Django secret is invalid or corrupted.")
    return secret


def _resource_root():
    return Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))


def _configure_django(data_dir):
    """Set required environment variables and initialise Django.

    Must run before any `django.*` or `config.*` import.
    """
    os.environ["SCHOOL_DATA_DIR"] = str(data_dir)
    os.environ["DJANGO_ENV"] = "desktop"
    os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings.desktop"
    os.environ["SECRET_KEY"] = _load_or_create_secret(data_dir)
    if getattr(sys, "frozen", False):
        # Only relevant for a PyInstaller-frozen build, where the bundled
        # frontend build is copied to <resource_root>/frontend_dist. In a
        # normal source run, leave SCHOOL_FRONTEND_DIST unset so
        # config.settings.desktop falls back to its own default
        # (frontend/dist next to this repo) instead of a path that only
        # exists inside a frozen bundle.
        os.environ.setdefault(
            "SCHOOL_FRONTEND_DIST", str(_resource_root() / "frontend_dist")
        )

    try:
        import django

        django.setup()
    except Exception as exc:
        raise RuntimeError(
            "Failed to load Django with settings module "
            f"'{os.environ['DJANGO_SETTINGS_MODULE']}': {exc}"
        ) from exc


def _migrations_logger(data_dir):
    """Dedicated logger for migration-safety events (Stage 5), separate
    from the general launcher log so migration history stays easy to find
    even as other startup log lines scroll past.
    """
    migrations_logger = logging.getLogger("desktop_launcher.migrations")
    if migrations_logger.handlers:
        return migrations_logger
    logs_dir = data_dir / "logs"
    try:
        logs_dir.mkdir(parents=True, exist_ok=True)
        handler = logging.FileHandler(logs_dir / "migrations.log", encoding="utf-8")
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s: %(message)s"))
        migrations_logger.addHandler(handler)
        migrations_logger.setLevel(logging.INFO)
        migrations_logger.propagate = False
    except OSError:
        pass  # Non-fatal: falls back to the root logger's handlers only.
    return migrations_logger


def _pending_migrations_exist():
    """Best-effort pending-migration detection. Never raises — if the
    check itself fails for any reason, callers should proceed to run
    `migrate` normally rather than being blocked by a diagnostic step.
    """
    try:
        from django.db import connection
        from django.db.migrations.executor import MigrationExecutor

        executor = MigrationExecutor(connection)
        targets = executor.loader.graph.leaf_nodes()
        plan = executor.migration_plan(targets)
        return len(plan) > 0
    except Exception:  # noqa: BLE001
        return True  # Unknown -> assume yes, so the safety backup still runs.


def _create_safety_backup(kind, mlog):
    """Best-effort backup before a risky step. Failure is logged loudly
    but never blocks startup — a broken backup subsystem (e.g. disk full)
    must not brick the whole application on every launch.
    """
    try:
        from django.core.management import call_command

        call_command("create_backup", kind=kind, verbosity=0)
        mlog.info("Created %s backup before proceeding.", kind)
        return True
    except Exception as exc:  # noqa: BLE001
        mlog.error("Could not create %s backup (continuing anyway): %s", kind, exc)
        logger.error("Could not create %s backup (continuing anyway): %s", kind, exc)
        return False


def _automatic_daily_backup(mlog):
    """Creates one automatic backup per calendar day, only if today
    doesn't already have a successful one. Non-fatal on any failure.
    """
    try:
        from datetime import datetime, timezone

        from apps.backups import config as backup_config
        from apps.backups import services as backup_services

        # created_at in each backup's metadata.json is always stored in UTC
        # (see services.create_backup) — "today" must be computed in UTC
        # too, or this comparison silently fails (and creates a duplicate
        # backup) for the several hours per day where the local calendar
        # date and the UTC calendar date differ, which is most of the day
        # in timezones ahead of UTC.
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        existing = [
            b
            for b in backup_services.list_backups()
            if b["kind"] == "automatic" and b["valid"] and (b["created_at"] or "").startswith(today)
        ]
        if existing:
            mlog.info("Automatic backup already exists for %s; skipping.", today)
            return

        result = backup_services.create_backup(kind="automatic")
        mlog.info("Created automatic daily backup: %s", result.filename)
        cfg = backup_config.get_config()
        retention = backup_services.apply_retention("automatic", cfg["backup_retention_automatic"])
        if retention["deleted"]:
            mlog.info("Automatic backup retention removed: %s", ", ".join(retention["deleted"]))
    except Exception as exc:  # noqa: BLE001
        mlog.error("Automatic daily backup failed (continuing anyway): %s", exc)
        logger.error("Automatic daily backup failed (continuing anyway): %s", exc)


def _run_migrations(data_dir):
    from django.core.management import call_command
    from django.db import connection
    from django.db.utils import OperationalError

    mlog = _migrations_logger(data_dir)

    pending = _pending_migrations_exist()
    mlog.info("Startup migration check: pending=%s", pending)

    if pending:
        _create_safety_backup("pre_migration", mlog)

    try:
        call_command("migrate", interactive=False, verbosity=1)
    except OperationalError as exc:
        mlog.error("Migrations failed (database unreachable/unusable): %s", exc)
        raise RuntimeError(f"Database is unreachable or unusable: {exc}") from exc
    except Exception as exc:
        mlog.error("Migrations failed: %s", exc)
        raise RuntimeError(f"Migrations failed: {exc}") from exc

    try:
        connection.ensure_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception as exc:
        mlog.error("Post-migration database connectivity check failed: %s", exc)
        raise RuntimeError(f"Database is unreachable after migration: {exc}") from exc

    mlog.info("Migrations applied successfully (pending was %s).", pending)

    # Daily automatic backup: independent of whether migrations were
    # actually pending this run, and never allowed to fail startup.
    _automatic_daily_backup(mlog)


def _check_port_available(host, port):
    """Fail fast if the port is taken.

    waitress's listening socket sets SO_REUSEADDR, which on Windows allows a
    second process to bind to a port that already has an active LISTENer
    (unlike POSIX, where SO_REUSEADDR only relaxes TIME_WAIT). That means
    waitress.serve() itself can silently succeed with two processes both
    "listening" on 8765, racing over the same SQLite file. Probing first
    with SO_EXCLUSIVEADDRUSE (Windows) / a plain non-REUSEADDR bind (POSIX)
    reliably detects a real conflict before that can happen.
    """
    probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
        probe.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
    try:
        probe.bind((host, port))
    except OSError as exc:
        raise RuntimeError(
            f"Port {port} on {host} is already in use by another process. "
            "Close the other application (or a previous, still-running "
            "copy of this launcher) and try again."
        ) from exc
    finally:
        probe.close()


def _serve():
    try:
        from config.wsgi import application
        from waitress import serve
    except Exception as exc:
        raise RuntimeError(f"Failed to load the WSGI application: {exc}") from exc

    _check_port_available(HOST, PORT)

    try:
        serve(
            application,
            host=HOST,
            port=PORT,
            threads=4,
            channel_timeout=60,
            clear_untrusted_proxy_headers=True,
            url_scheme="http",
        )
    except OSError as exc:
        if exc.errno == errno.EADDRINUSE or getattr(exc, "winerror", None) == 10048:
            raise RuntimeError(
                f"Port {PORT} on {HOST} is already in use by another process. "
                "Close the other application (or a previous, still-running "
                "copy of this launcher) and try again."
            ) from exc
        raise RuntimeError(f"Waitress failed to start: {exc}") from exc


def main():
    data_dir = _data_dir()

    try:
        _ensure_data_dir(data_dir)
    except RuntimeError as exc:
        print(f"[startup error] {exc}", file=sys.stderr)
        sys.exit(1)

    _setup_logging(data_dir)
    logger.info("Starting desktop backend. Data directory: %s", data_dir)

    try:
        _configure_django(data_dir)
    except RuntimeError as exc:
        logger.error(str(exc))
        sys.exit(1)

    logger.info(
        "Django initialised with settings module '%s'.",
        os.environ["DJANGO_SETTINGS_MODULE"],
    )

    try:
        _run_migrations(data_dir)
    except RuntimeError as exc:
        logger.error(str(exc))
        sys.exit(1)

    logger.info("Migrations applied successfully.")
    logger.info("Starting Waitress on http://%s:%s", HOST, PORT)

    try:
        _serve()
    except RuntimeError as exc:
        logger.error(str(exc))
        sys.exit(1)
    except KeyboardInterrupt:
        logger.info("Shutdown requested by user.")
        sys.exit(0)


if __name__ == "__main__":
    main()
