'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Persistent Electron-side logger (Stage 4). Writes to
 * <dataDir>/logs/electron.log so startup/shutdown problems in an installed
 * app can be diagnosed without a terminal. Never throws — a logger that
 * can't write to disk falls back to console-only rather than crashing
 * startup over a logging failure.
 *
 * Callers are responsible for never passing secrets (passwords, tokens,
 * SECRET_KEY, full environment dumps, sensitive record contents) into
 * logged messages; this module does no content inspection of its own.
 */

const MAX_LOG_BYTES = 5 * 1024 * 1024; // 5 MB

let logFilePath = null;
let echoToConsole = false;

function rotateIfNeeded() {
  try {
    const stat = fs.statSync(logFilePath);
    if (stat.size > MAX_LOG_BYTES) {
      const rotated = `${logFilePath}.1`;
      fs.rmSync(rotated, { force: true });
      fs.renameSync(logFilePath, rotated);
    }
  } catch {
    // No existing file yet, or stat/rename failed — nothing to rotate.
  }
}

/**
 * Initializes file logging under <dataDir>/logs/electron.log. Safe to call
 * more than once (e.g. if dataDir changes); only ever call once dataDir is
 * known to exist (main.cjs creates it before this runs).
 */
function initLogger(dataDir, { console: alsoConsole = false } = {}) {
  echoToConsole = alsoConsole;
  try {
    const logsDir = path.join(dataDir, 'logs');
    fs.mkdirSync(logsDir, { recursive: true });
    logFilePath = path.join(logsDir, 'electron.log');
    rotateIfNeeded();
  } catch (err) {
    logFilePath = null;
    console.error('[logger] Could not initialise file logging:', err.message);
  }
}

function write(level, message) {
  if (echoToConsole || !logFilePath) {
    (level === 'ERROR' ? console.error : console.log)(`[electron] ${message}`);
  }
  if (!logFilePath) return;
  try {
    fs.appendFileSync(logFilePath, `${new Date().toISOString()} ${level} ${message}\n`, 'utf8');
  } catch {
    // Best-effort only; a failed log write must never crash the app.
  }
}

const logger = {
  info: (message) => write('INFO', message),
  error: (message) => write('ERROR', message),
};

module.exports = { initLogger, logger };
