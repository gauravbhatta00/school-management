'use strict';

/**
 * Stage 5 IPC surface. Deliberately narrow: most channels take zero
 * arguments and operate only on paths the main process computes itself
 * (never a renderer-supplied absolute path). The two exceptions —
 * choosing a destination folder or a backup file — only ever return a
 * path that came from a native OS dialog the user explicitly interacted
 * with, never one typed or constructed by the page. `backup:copy-to`
 * additionally validates its filename argument against the real managed
 * backup directories before touching the filesystem.
 *
 * No channel here executes a shell command, opens an arbitrary external
 * URL, or exposes environment variables to the renderer.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const { app, ipcMain, dialog, shell } = require('electron');

const { finalizeRestore } = require('./restore.cjs');

function backupsRoot(dataDir) {
  return path.join(dataDir, 'backups');
}

function logsRoot(dataDir) {
  return path.join(dataDir, 'logs');
}

/** True only if `filename` is a plain file name with no path traversal or separators. */
function isSafeFilename(filename) {
  return (
    typeof filename === 'string' &&
    filename.length > 0 &&
    filename.length < 255 &&
    !filename.includes('/') &&
    !filename.includes('\\') &&
    !filename.includes('..')
  );
}

/** Resolves a backup filename to a real path, but only inside one of the
 * three managed backup subdirectories — never anywhere else. */
function resolveManagedBackupPath(dataDir, filename) {
  if (!isSafeFilename(filename)) return null;
  for (const kind of ['manual', 'automatic', 'safety']) {
    const candidate = path.join(backupsRoot(dataDir), kind, filename);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * @param {object} opts
 * @param {() => string} opts.getDataDir
 * @param {() => boolean} opts.isBackendOwned
 * @param {() => Promise<void>} opts.stopOwnedBackend
 * @param {() => void} opts.startOwnedBackend
 * @param {() => Promise<{ok: boolean, reason?: string}>} opts.waitForHealthy
 * @param {(line: string) => void} opts.onLog
 */
function registerIpcHandlers({ getDataDir, isBackendOwned, stopOwnedBackend, startOwnedBackend, waitForHealthy, onLog }) {
  ipcMain.handle('backup:choose-destination', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose a folder for the backup copy',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('backup:choose-file', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose a backup archive to restore',
      properties: ['openFile'],
      filters: [{ name: 'Backup archives', extensions: ['zip'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('backup:open-folder', async () => {
    const dataDir = getDataDir();
    const target = backupsRoot(dataDir);
    fs.mkdirSync(target, { recursive: true });
    const error = await shell.openPath(target);
    return { ok: error === '', error: error || null };
  });

  ipcMain.handle('logs:open-folder', async () => {
    const dataDir = getDataDir();
    const target = logsRoot(dataDir);
    fs.mkdirSync(target, { recursive: true });
    const error = await shell.openPath(target);
    return { ok: error === '', error: error || null };
  });

  ipcMain.handle('backup:copy-to', async (_event, args) => {
    const filename = args?.filename;
    const destinationDir = args?.destinationDir;

    if (typeof destinationDir !== 'string' || !path.isAbsolute(destinationDir)) {
      return { ok: false, error: 'Invalid destination.' };
    }
    const dataDir = getDataDir();
    const sourcePath = resolveManagedBackupPath(dataDir, filename);
    if (!sourcePath) {
      return { ok: false, error: 'Backup file was not found.' };
    }
    if (!fs.existsSync(destinationDir) || !fs.statSync(destinationDir).isDirectory()) {
      return { ok: false, error: 'Destination folder does not exist.' };
    }

    try {
      const destPath = path.join(destinationDir, path.basename(sourcePath));
      fs.copyFileSync(sourcePath, destPath);
      return { ok: true, path: destPath };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('restore:finalize', async () => {
    const dataDir = getDataDir();
    return finalizeRestore({
      dataDir,
      isBackendOwned,
      stopOwnedBackend,
      startOwnedBackend,
      waitForHealthy,
      onLog,
    });
  });

  ipcMain.handle('diagnostics:export', async (_event, args) => {
    const content = args?.content;
    if (typeof content !== 'string' || content.length > 5 * 1024 * 1024) {
      return { ok: false, error: 'Invalid diagnostic report content.' };
    }

    const result = await dialog.showSaveDialog({
      title: 'Save Diagnostic Report',
      defaultPath: `diagnostic-report-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };

    try {
      fs.writeFileSync(result.filePath, content, 'utf8');
      return { ok: true, path: result.filePath };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('app:get-info', () => ({
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    platform: process.platform,
    osVersion: `${os.type()} ${os.release()}`,
  }));
}

module.exports = { registerIpcHandlers };
