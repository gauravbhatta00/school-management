# Recovery Guide

What to do when something goes wrong. Read the matching section below
before touching any files by hand — **never manually delete the database
as a first response**; every scenario here has a safer first step.

Where things live (all under one folder, `<userData>/data` — on a normal
installed app this is `%APPDATA%\school-management-desktop\data`; the
Settings page in the app shows the exact path for this machine):

| What | Path |
|---|---|
| Database | `data/db.sqlite3` |
| Uploaded media | `data/media/` |
| Backups | `data/backups/manual/`, `data/backups/automatic/`, `data/backups/safety/` |
| Logs | `data/logs/electron.log`, `data/logs/desktop.log`, `data/logs/migrations.log`, `data/logs/launcher.log` |
| Config (retention settings) | `data/config/settings.json` |

## The app won't start at all

1. Open **Settings → Open Logs Folder** if you can reach it, or navigate
   to `data/logs/` directly. Check `electron.log` first — it logs the
   resolved backend mode, the backend executable path, and the process
   exit code for every startup attempt.
2. If `electron.log` shows the backend process exited immediately, check
   `desktop.log` next for anything Django logged after its own logging
   configuration took over (most real startup failures — bad migration,
   corrupt settings — end up here, not in `electron.log`).
3. Common causes and fixes:
   - **Port 8765 already in use** — see [Port conflicts](#port-conflicts)
     below.
   - **Database locked or corrupt** — see
     [Database won't open / integrity failure](#database-wont-open--integrity-failure)
     below.
   - **A previous restore or migration was interrupted mid-way** — check
     `data/backups/_staging/` for a leftover `restore/` folder and
     `data/db.sqlite3.pre-restore-<timestamp>` next to the real database.
     If either exists, the app likely crashed mid-restore. Do not delete
     anything yet — capture a copy of the whole `data/` folder first (see
     [Before you do anything destructive](#before-you-do-anything-destructive)),
     then try restarting the app once; if a `.pre-restore-*` file is
     present and `db.sqlite3` looks wrong/missing, rename the
     `.pre-restore-*` file back to `db.sqlite3` (and the matching
     `media.pre-restore-*` back to `media`) before restarting again.
4. If none of the above resolves it, reinstall (see
   [Reinstalling](#reinstalling)) — reinstalling never touches `data/`,
   so your database and backups are safe either way.

## Port conflicts

**"Port 8765 is already in use by another application"** — something else
on this computer is bound to port 8765. The app deliberately refuses to
start on top of an unrecognized listener rather than risk two things
writing to the same database.

1. Find what's using it:
   ```powershell
   netstat -ano | findstr :8765
   ```
2. If it's a leftover copy of this app's own backend (e.g. from a crashed
   previous session), close it via Task Manager (`school-backend.exe`) or:
   ```powershell
   taskkill /PID <pid> /F
   ```
3. If it's an unrelated application that happens to use the same port,
   close that application, or contact support — changing this app's port
   is not currently an end-user-facing setting.
4. Relaunch the app.

## Database won't open / integrity failure

The app has a built-in, admin-only **Integrity Check** (Settings → Run
Integrity Check) that verifies the database connection, that expected
tables exist, and reports the result without exposing raw SQL to you.

1. Run it first. If it passes, the problem is elsewhere (check logs
   instead — see above).
2. If it fails:
   - **Do not delete `db.sqlite3`.** Rename it aside instead (e.g. to
     `db.sqlite3.broken`) so it's preserved for later inspection.
   - Restore from the most recent known-good backup — see
     [Restoring from a backup](#restoring-from-a-backup) below.
   - If you don't have a backup you trust, `data/backups/safety/` may
     still hold a `pre_migration` or `pre_restore_safety` backup from
     before whatever went wrong — check there before giving up.

## Missing media / uploaded files look wrong after a restore

Restore replaces media, it does not merge it — restoring a backup sets
`media/` to exactly what was in that backup, including removing files
added after the backup was taken. This is expected, documented behavior
(see [UNINSTALL_AND_DATA_RETENTION.md](UNINSTALL_AND_DATA_RETENTION.md)
and the in-app restore confirmation dialog), not a bug. If you restored
the wrong backup by mistake, the **automatic pre-restore safety backup**
(created just before every restore, kept in `data/backups/safety/`) has
your prior state — restore that instead.

## Restore or migration failed midway

Both restore and migration are designed to leave your previous data
intact on failure, not to leave you with a half-swapped database:

- **Restore failure**: the app automatically rolls back to the exact
  files that were live before the restore attempt and restarts the
  backend. You'll see a message telling you whether rollback succeeded.
  If it says rollback also failed, don't restart the app yet — copy the
  whole `data/` folder somewhere safe first, then look for
  `db.sqlite3.pre-restore-<timestamp>` next to `db.sqlite3` and follow
  the manual recovery steps in
  [The app won't start at all](#the-app-wont-start-at-all) above.
- **Migration failure**: a backup is taken automatically before any
  pending migration runs (kept in `data/backups/automatic/`, tagged as a
  pre-migration backup), and the app never automatically deletes or
  overwrites your database as part of a failed migration. Check
  `data/logs/migrations.log` for what happened, then restore the
  pre-migration backup if the database is left in a bad state — see
  below.

## Restoring from a backup

1. In the app: **Settings → Restore**.
2. Choose the backup file (from the list, or **Choose File** if you have
   one saved elsewhere, e.g. copied from `data/backups/` or from an
   external drive).
3. The app validates the archive first (format version, checksums, no
   unsafe paths or embedded executables) and shows you what it found
   before asking for confirmation — read it before confirming.
4. Confirm. The app automatically:
   - Creates a **safety backup** of your current data first (so this
     restore itself is undoable).
   - Stops the backend.
   - Swaps in the backup's database and media.
   - Restarts the backend and waits for it to become healthy.
5. If it reports success, verify the data you expected to see is back.
6. If it reports failure, it will also tell you whether it rolled back
   automatically. Trust that message — don't manually touch files unless
   it explicitly says automatic rollback also failed.

## Reinstalling

Reinstalling (over the same version, or a newer one) **never deletes or
modifies `data/`** — only the application program files are replaced.
Your database, media, backups, and logs are exactly as you left them
after reinstalling. See
[UNINSTALL_AND_DATA_RETENTION.md](UNINSTALL_AND_DATA_RETENTION.md) for
full detail on what is and isn't touched.

1. Uninstall via Windows "Apps & Features" (optional — installing over an
   existing install also works and is simpler).
2. Run the installer for the version you want.
3. Launch the app. Your existing data is used automatically; no restore
   step is needed unless something was already broken before you
   reinstalled.

## Windows user account changed / new computer, old data

Data lives under the **Windows user profile** that ran the app
(`%APPDATA%\school-management-desktop\data` under that specific account).
If the school switches which Windows account runs the app, or moves to a
new computer:

1. On the old account/computer, take a fresh manual backup (Settings →
   Create Backup), or copy the whole `data/backups/` folder and the
   `data/db.sqlite3` + `data/media/` files directly.
2. Install the app on the new account/computer.
3. Launch it once (so it creates its own fresh `data/` folder and empty
   database), then use **Settings → Restore → Choose File** to restore
   the backup you took in step 1.

This app has no built-in cross-machine sync — this manual backup/restore
is the supported way to move data between accounts or machines, not an
automatic process.

## Storage device replaced / drive failure

If the computer's drive is being replaced (planned) or has already
failed (unplanned):

- **Planned replacement**: take a manual backup, copy `data/backups/` to
  external storage too if you can, do the drive swap/reimage, reinstall
  the app, then restore from your backup as in
  [Restoring from a backup](#restoring-from-a-backup).
- **Already failed**: your only recovery path is whatever backup exists
  outside the failed drive — an external copy of `data/backups/` from
  before the failure, or a copy an admin made to a USB drive per the
  pilot checklist's recommendation. If no such copy exists, the data
  cannot be recovered by this app; this is exactly why
  [docs/PILOT_CHECKLIST.md](PILOT_CHECKLIST.md) asks admins to keep
  off-machine copies. This app does not currently offer cloud backup.

## Before you do anything destructive

If you're ever about to try something not covered above and you're not
sure it's safe: **copy the entire `data/` folder to another location
first** (a USB drive, another folder, anywhere outside the app's own
directory). It's a plain folder of files — no special tool needed — and
having a raw copy means nothing you try next can make things worse than
they already are.

## Diagnostic report

Settings → **Export Diagnostic Report** produces a sanitized JSON/text
file (app version, backend mode, backup/retention status, integrity
check result, disk space, recent log summaries) with no passwords,
tokens, secret keys, or full environment dumps in it. If you're asking
someone else for help, send them this file rather than raw log files or
screenshots of the database.
