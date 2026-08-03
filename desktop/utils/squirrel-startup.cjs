'use strict';

const path = require('path');
const { spawn } = require('child_process');

/**
 * Handles Squirrel.Windows' install/update/uninstall lifecycle events.
 *
 * Squirrel launches the freshly (un)installed app once with a
 * `--squirrel-install` / `--squirrel-updated` / `--squirrel-uninstall` /
 * `--squirrel-obsolete` flag instead of creating shortcuts itself — the app
 * is expected to notice the flag, ask Squirrel's own Update.exe to
 * create/remove the Start Menu (and optionally desktop) shortcut, and exit
 * immediately without showing a window. Equivalent to the well-known
 * `electron-squirrel-startup` package, reimplemented locally (a few lines)
 * to avoid adding a node_modules dependency the packaged app would need to
 * carry — this app's asar deliberately ships no npm packages at all (see
 * forge.config.cjs's ignore allowlist).
 *
 * @returns {boolean} true if this run was a Squirrel lifecycle event (the
 *   caller must quit immediately and do nothing else), false for a normal
 *   launch.
 */
function handleSquirrelStartupEvent() {
  if (process.platform !== 'win32') return false;

  const squirrelCommand = process.argv[1];
  if (!squirrelCommand || !squirrelCommand.startsWith('--squirrel')) return false;

  const appFolder = path.resolve(process.execPath, '..');
  const rootFolder = path.resolve(appFolder, '..');
  const updateExe = path.join(rootFolder, 'Update.exe');
  const exeName = path.basename(process.execPath);

  const runUpdateExe = (args) => {
    try {
      spawn(updateExe, args, { detached: true }).on('error', () => {});
    } catch {
      // Best-effort: a failed shortcut create/remove must not block
      // install/uninstall from otherwise completing.
    }
  };

  switch (squirrelCommand) {
    case '--squirrel-install':
    case '--squirrel-updated':
      runUpdateExe([`--createShortcut=${exeName}`]);
      return true;
    case '--squirrel-uninstall':
      runUpdateExe([`--removeShortcut=${exeName}`]);
      return true;
    case '--squirrel-obsolete':
      return true;
    default:
      return false;
  }
}

module.exports = { handleSquirrelStartupEvent };
