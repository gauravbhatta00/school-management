'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Stage 5 restore finalization: the one part of restore that genuinely
 * needs Electron rather than a Django endpoint, because only Electron
 * controls the backend child process. Everything risky about a restore —
 * validating the chosen archive, creating a pre-restore safety backup,
 * extracting the chosen archive into backups/_staging/restore/ — has
 * already happened over HTTP, through the renderer's normal authenticated
 * API client, *before* this function is ever called (see
 * frontend/src/pages/Settings.jsx). By the time this runs, the backend is
 * about to be stopped, so nothing here can rely on Django being reachable.
 *
 * Safety model: the current live db.sqlite3/media are renamed aside
 * (never deleted) before the staged files are swapped in. If anything
 * from that point on fails, the aside files are renamed straight back —
 * a plain, dependency-free filesystem operation that works even if the
 * backend itself is broken. The aside files are only deleted after a
 * post-restart health check actually succeeds.
 */

function stagingRestoreDir(dataDir) {
  return path.join(dataDir, 'backups', '_staging', 'restore');
}

function liveDbPath(dataDir) {
  return path.join(dataDir, 'db.sqlite3');
}

function liveMediaPath(dataDir) {
  return path.join(dataDir, 'media');
}

/** Renames a file/dir aside if it exists; no-op (returns null) otherwise. */
function renameAsideIfExists(targetPath, suffix) {
  if (!fs.existsSync(targetPath)) return null;
  const asidePath = `${targetPath}${suffix}`;
  fs.renameSync(targetPath, asidePath);
  return asidePath;
}

function restoreAside(asidePath, targetPath) {
  if (!asidePath) return;
  // Clear whatever partial state the failed forward-swap may have left.
  fs.rmSync(targetPath, { recursive: true, force: true });
  fs.renameSync(asidePath, targetPath);
}

function cleanupAside(asidePath) {
  if (!asidePath) return;
  fs.rmSync(asidePath, { recursive: true, force: true });
}

/**
 * @param {object} opts
 * @param {string} opts.dataDir - <userData>/data
 * @param {() => boolean} opts.isBackendOwned
 * @param {() => Promise<void>} opts.stopOwnedBackend
 * @param {() => {pid: number|undefined}} opts.startOwnedBackend - starts a
 *   fresh backend and updates the caller's own child-process bookkeeping;
 *   returns the new child handle only for logging.
 * @param {() => Promise<{ok: boolean, reason?: string}>} opts.waitForHealthy
 * @param {(line: string) => void} [opts.onLog]
 * @returns {Promise<{success: boolean, rolledBack: boolean, message: string}>}
 */
async function finalizeRestore({
  dataDir,
  isBackendOwned,
  stopOwnedBackend,
  startOwnedBackend,
  waitForHealthy,
  onLog,
}) {
  const log = (line) => onLog?.(line);
  const stagingDir = stagingRestoreDir(dataDir);
  const stagedDb = path.join(stagingDir, 'db.sqlite3');
  const stagedMedia = path.join(stagingDir, 'media');

  if (!fs.existsSync(stagedDb)) {
    return {
      success: false,
      rolledBack: false,
      message: 'No staged backup was found. Validate and stage a backup before restoring.',
    };
  }

  if (!isBackendOwned()) {
    return {
      success: false,
      rolledBack: false,
      message:
        'The running backend was not started by this application instance, so it cannot be safely ' +
        'stopped for restore. Close the externally-running backend first, then try again.',
    };
  }

  log('Restore: stopping backend before file swap...');
  await stopOwnedBackend();

  const suffix = `.pre-restore-${Date.now()}`;
  const dbTarget = liveDbPath(dataDir);
  const mediaTarget = liveMediaPath(dataDir);
  let dbAside = null;
  let mediaAside = null;

  const rollbackAndRestart = async (reason) => {
    log(`Restore: rolling back after failure (${reason}).`);
    try {
      restoreAside(dbAside, dbTarget);
      restoreAside(mediaAside, mediaTarget);
    } catch (rollbackErr) {
      log(`Restore: rollback itself failed: ${rollbackErr.message}`);
      return {
        success: false,
        rolledBack: false,
        message:
          `Restore failed (${reason}) and automatic rollback also failed: ${rollbackErr.message}. ` +
          'The application data may be in an inconsistent state — restore manually from a backup ' +
          'before continuing to use the application.',
      };
    }

    try {
      startOwnedBackend();
      const health = await waitForHealthy();
      if (!health.ok) {
        return {
          success: false,
          rolledBack: true,
          message: `Restore failed (${reason}). Rolled back successfully, but the backend did not ` +
            `restart cleanly afterward: ${health.reason}. Restart the application.`,
        };
      }
    } catch (restartErr) {
      return {
        success: false,
        rolledBack: true,
        message: `Restore failed (${reason}). Rolled back successfully, but the backend could not be ` +
          `restarted: ${restartErr.message}. Restart the application.`,
      };
    }

    return {
      success: false,
      rolledBack: true,
      message: `Restore failed (${reason}). Your previous data was automatically restored.`,
    };
  };

  try {
    dbAside = renameAsideIfExists(dbTarget, suffix);
    mediaAside = renameAsideIfExists(mediaTarget, suffix);

    fs.renameSync(stagedDb, dbTarget);
    if (fs.existsSync(stagedMedia)) {
      fs.renameSync(stagedMedia, mediaTarget);
    } else {
      fs.mkdirSync(mediaTarget, { recursive: true }); // backup had no media at all
    }
  } catch (swapErr) {
    return rollbackAndRestart(`file swap error: ${swapErr.message}`);
  }

  log('Restore: files swapped, restarting backend...');
  try {
    startOwnedBackend();
  } catch (startErr) {
    return rollbackAndRestart(`backend failed to start: ${startErr.message}`);
  }

  const health = await waitForHealthy();
  if (!health.ok) {
    return rollbackAndRestart(`backend did not become healthy: ${health.reason}`);
  }

  cleanupAside(dbAside);
  cleanupAside(mediaAside);
  fs.rmSync(stagingDir, { recursive: true, force: true });

  log('Restore: completed successfully.');
  return { success: true, rolledBack: false, message: 'Restore completed successfully.' };
}

module.exports = { finalizeRestore };
