# Pilot Deployment Checklist

For deploying EduCore to **one real computer** for a school to actually use.
This app is single-machine, offline, local-SQLite software — there is no
multi-computer sync, no server mode, and no cloud backup. If the school
needs the app on more than one computer, each computer runs its own fully
independent copy with its own independent data; nothing here makes them
share data.

Work through this top to bottom. Do not skip the restore drill — an
unverified backup is not a backup.

## 1. Before installing

- [ ] Confirm this is the intended computer: the one the school will
      actually use day to day, with a Windows user account for daily use
      that isn't a shared/guest account.
- [ ] Confirm free disk space is comfortably more than the installer +
      unpacked app + expected data growth (a few hundred MB is enough to
      start; back-of-envelope is fine — the app itself checks free space
      before backup/restore operations and will refuse rather than risk
      a partial write).
- [ ] Have the installer (`SchoolManagementSetup.exe`) and its matching
      `.sha256` checksum file both in hand, from the same release.
- [ ] Verify the checksum before running the installer:

      ```powershell
      Get-FileHash SchoolManagementSetup.exe -Algorithm SHA256
      ```

      Compare the printed hash against the `sha256:` line in the
      `.sha256` file. If they don't match, **do not install** — re-download
      the installer and re-check. See
      [Antivirus and Windows warnings](../README.md#antivirus-and-windows-warnings)
      in the README: the installer is unsigned, so this checksum check is
      the only integrity verification available — it is not a substitute
      for code signing, only a way to confirm the file wasn't corrupted or
      swapped in transit.

## 2. Install

- [ ] Run `SchoolManagementSetup.exe`. Expect a Windows SmartScreen
      "unrecognized app" prompt — this is expected for an unsigned
      installer (see README), not a sign of a problem.
- [ ] Confirm the Start Menu shortcut ("EduCore — School Management
      System") was created.
- [ ] Launch the app. Confirm the window opens and you reach the login
      screen within a few seconds (first launch also runs database
      migrations — a brief pause here is normal).

## 3. First-run configuration

- [ ] Log in with the seeded admin account (or whatever account the school
      was given) and **change the admin password immediately** if it's
      still a default/shared one.
- [ ] Create the accounts the school actually needs (teachers, students)
      — or import them, if a CSV import path is being used.
- [ ] Open **Settings** (admin-only) and confirm:
  - App version shown matches the release being deployed.
  - Data directory shown is a real, sensible path (not empty/blank).
  - Backup retention values look reasonable (defaults: 14 manual, 14
    automatic — adjust per the school's preference if needed).

## 4. Backup drill (mandatory — do not skip)

Do this **before** the school starts entering real data, so the restore
sequence is proven safe on throwaway data first.

- [ ] Enter a few rows of obviously-fake test data (e.g. a "Test Student
      Zzz").
- [ ] Settings → **Create Backup** (manual). Confirm it appears in the
      backup list with today's date.
- [ ] Delete or edit the test data you just entered.
- [ ] Settings → **Restore** → choose the backup you just created →
      confirm the restore.
- [ ] Confirm: the app restarts itself, comes back up, and the test data
      you deleted/edited is back exactly as it was in the backup.
- [ ] Confirm a **safety backup** was created automatically before the
      restore ran (visible in the backup list) — this is the app's own
      insurance policy in case the restore itself had gone wrong; leave it
      in place, don't delete it.
- [ ] Delete the test data again, for real this time, before the school
      starts using the app.

If any step here fails, **stop** — do not let the school start entering
real data until restore has been proven to work on this machine. See
[docs/RECOVERY.md](RECOVERY.md) for troubleshooting.

## 5. Ongoing operation (tell the school this)

- [ ] Automatic daily backups run on their own — no action needed, but
      show an admin where to check they're happening (Settings → "Last
      Successful Backup").
- [ ] Show an admin how to take a manual backup before anything risky
      (a bulk import, end-of-term data cleanup, etc.) — Settings →
      Create Backup, same as the drill above.
- [ ] Show an admin **Open Backup Folder** and explain that copying that
      folder's contents to a USB drive / external disk periodically is
      the school's own responsibility — this app does not upload backups
      anywhere. Local backups protect against a corrupted database or a
      bad restore; they do not protect against the computer itself being
      lost, stolen, or destroyed. Off-machine copies are the school's job.
- [ ] Explain that **uninstalling the app does not delete school data**
      by default (see
      [docs/UNINSTALL_AND_DATA_RETENTION.md](UNINSTALL_AND_DATA_RETENTION.md))
      — reinstalling a newer version later will find the existing data
      right where it was.

## 6. Sign-off

- [ ] Record the deployed version number and install date somewhere the
      school can find again (e.g. write it in this checklist and keep a
      copy with the school's records).
- [ ] Record who the admin account holder(s) are.
- [ ] Confirm the person handing off the app to the school has walked
      them through section 5 above out loud, not just handed them a link.

Deployed version: `___________`   Date: `___________`   By: `___________`
