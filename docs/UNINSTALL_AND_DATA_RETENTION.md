# Uninstall and Data Retention Policy

## The short version

**Uninstalling this app does not delete your school's data.** Only the
program files are removed. Your database, uploaded media, backups, and
logs are left exactly where they were.

## What uninstall actually removes

The installer uses Squirrel.Windows. Uninstalling (via Windows "Apps &
Features", or running `Update.exe --uninstall` from the install
directory) removes:

- The installed program files under
  `%LOCALAPPDATA%\SchoolManagement\` (the Electron shell, the bundled
  React build, and the packaged Django backend executable).
- The Start Menu shortcut.

That is all. `desktop/utils/squirrel-startup.cjs` — the code that runs
during install/uninstall — only ever asks Squirrel's `Update.exe` to
create or remove that one shortcut; nothing in this app's uninstall path
touches user data, and nothing was added in this project to delete it.

## What uninstall does NOT remove

Everything under the app's data directory, which lives in your Windows
user profile, **separate from the install directory**:

```
%APPDATA%\school-management-desktop\data\
├── db.sqlite3          ← the actual database: students, teachers, grades, fees, everything
├── media/               ← uploaded files (photos, logos, etc.)
├── backups/
│   ├── manual/           ← backups you created yourself
│   ├── automatic/        ← daily automatic backups + pre-migration backups
│   └── safety/           ← automatic safety backups taken right before each restore
├── logs/                ← electron.log, desktop.log, migrations.log, launcher.log
└── config/settings.json ← backup retention settings
```

This survives:
- Uninstalling the app.
- Reinstalling the same version.
- Installing a newer version over an existing install.
- The app crashing, being force-closed, or the computer losing power
  mid-session (the database itself is a standard SQLite file with normal
  crash-safety; nothing here uses unsafe write modes).

This does **not** survive:
- Manually deleting the `%APPDATA%\school-management-desktop\` folder
  yourself.
- Reformatting the drive, replacing the storage device, or reimaging the
  computer without first copying this folder elsewhere.
- Switching to a different Windows user account (each Windows account has
  its own separate `%APPDATA%`, and therefore its own separate, empty
  data directory the first time the app runs under it — see
  [docs/RECOVERY.md](RECOVERY.md#windows-user-account-changed--new-computer-old-data)
  for how to move data across accounts).

## Why data isn't deleted on uninstall

This is a deliberate choice, not an oversight: uninstalling is often done
to reinstall a fresh copy (troubleshooting, a corrupted install, moving
to a new version), and destroying a school's actual data as a side effect
of that would be dangerous. There is currently **no in-app "erase my
data" option** — if you genuinely want to wipe local data, the only way
is to manually delete
`%APPDATA%\school-management-desktop\` yourself, after uninstalling, with
full understanding that this is irreversible and unrelated to the normal
uninstall flow. Take a backup first if there's any chance you'll want the
data again (see [Settings → Create Backup](RECOVERY.md), and copy the
resulting backup file outside `%APPDATA%` before deleting anything).

## Backup retention (separate from uninstall)

Independent of uninstall, the app itself prunes old **automatic**
backups on an ongoing basis so `backups/automatic/` doesn't grow forever
— configurable in Settings (default: keep the newest 14). This retention
process:

- Only ever deletes files inside the app's own managed backup
  directories (`backups/manual/`, `backups/automatic/`) — never the live
  database, never `backups/safety/`.
- Never deletes the newest or only remaining backup in a directory, even
  if the configured retention count is set to 0 or 1.
- Skips (never deletes) any backup file it can't read/parse the metadata
  of, erring on the side of keeping data rather than losing it.

`backups/safety/` (automatic safety backups taken immediately before each
restore) is retained separately and capped at a small fixed number — it
exists purely as short-term restore insurance, not as long-term backup
storage. Don't rely on it as your only backup; use manual or automatic
backups (and copies moved outside `%APPDATA%`) for anything you want kept
long-term.

## Moving or backing up data outside the app

Since nothing here syncs to the cloud, keeping a copy of your data
somewhere other than this one computer is the school's own
responsibility. The supported way to do that:

1. Settings → **Create Backup** (or wait for the automatic daily one).
2. Settings → **Open Backup Folder**, or use the backup list's copy/save
   action to save a chosen backup file to a USB drive or another folder.
3. Store that copy somewhere other than this computer.

See [docs/PILOT_CHECKLIST.md](PILOT_CHECKLIST.md) for the recommended
ongoing routine, and [docs/RECOVERY.md](RECOVERY.md) for how to restore
from a backup on this computer or a different one.
