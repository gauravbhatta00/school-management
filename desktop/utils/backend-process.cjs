'use strict';

const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const {
  resolvePythonPath,
  resolveLauncherPath,
  resolveBackendMode,
  resolvePackagedExePath,
  BACKEND_DIR,
  REPO_ROOT,
} = require('./python-path.cjs');
const { probePort, checkHealthOnce } = require('./health-check.cjs');

const HOST = '127.0.0.1';
const PORT = 8765;
const HEALTH_URL = `http://${HOST}:${PORT}/api/health/`;

/**
 * Stage 5: the single source of truth for the application version is the
 * root package.json (see README's "Application version management"). This
 * reads it once and passes it to the backend as SCHOOL_APP_VERSION so
 * backup metadata and the diagnostics report both reflect the exact same
 * version Electron/the installer report — Django has no other way to know
 * it, since it runs as a separate process. require() works transparently
 * whether package.json is a loose file (dev) or packed inside app.asar
 * (installed), same as frontend-path.cjs's resolution of frontend/dist.
 */
function resolveAppVersion() {
  try {
    return require(path.join(REPO_ROOT, 'package.json')).version || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Decides how to proceed before touching anything:
 *  - 'free'     -> nothing is listening on the port; safe to start Django
 *  - 'reuse'    -> the expected school-management backend is already up
 *  - 'conflict' -> something else answers (or fails to answer correctly)
 *                  on that port
 *
 * Never assumes an open port means "our" backend — always confirms via the
 * health endpoint's exact response shape first.
 */
async function inspectExistingBackend() {
  const portOpen = await probePort(HOST, PORT);
  if (!portOpen) return { state: 'free' };

  const health = await checkHealthOnce(HEALTH_URL, 2000);
  if (health.ok) return { state: 'reuse' };

  return { state: 'conflict', reason: health.reason };
}

function ensureDataDir(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  return dataDir;
}

/**
 * Wires stdout/stderr line-piping and exit/error handlers onto a spawned
 * backend child process. Shared by both backend modes below so the actual
 * spawn() call is the only thing that differs between them.
 */
function wireChildProcess(child, { onLog, onExit }) {
  const pipeLines = (stream, prefix) => {
    let buffer = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.length > 0) onLog?.(`${prefix} ${line}`);
      }
    });
  };

  pipeLines(child.stdout, '[backend]');
  pipeLines(child.stderr, '[backend:err]');

  child.on('exit', (code, signal) => onExit?.(code, signal));
  child.on('error', (err) => onLog?.(`[backend] failed to start: ${err.message}`));

  return child;
}

/**
 * Source mode: spawns the Stage 1 desktop launcher
 * (backend/desktop_launcher.py) through the project's Python interpreter.
 * Useful for Django development — code changes take effect without a
 * rebuild. Nothing here prints secrets (the launcher itself never logs the
 * Django SECRET_KEY).
 */
function spawnSourceBackend({ dataDir, onLog, onExit }) {
  const pythonPath = resolvePythonPath();
  const launcherPath = resolveLauncherPath();

  const child = spawn(pythonPath, ['-u', launcherPath], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      SCHOOL_DATA_DIR: dataDir,
      DJANGO_ENV: 'desktop',
      DJANGO_SETTINGS_MODULE: 'config.settings.desktop',
      SCHOOL_APP_VERSION: resolveAppVersion(),
    },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return wireChildProcess(child, { onLog, onExit });
}

/**
 * Packaged mode (Stage 3): spawns the PyInstaller-built school-backend.exe
 * directly — no Python interpreter involved. Useful for testing the future
 * distributed architecture (Electron -> packaged executable -> Waitress).
 * The launcher sets its own DJANGO_ENV/DJANGO_SETTINGS_MODULE internally
 * (see backend/desktop_launcher.py), so only SCHOOL_DATA_DIR is required
 * here.
 */
function spawnPackagedBackend({ dataDir, onLog, onExit }) {
  const exePath = resolvePackagedExePath();

  const child = spawn(exePath, [], {
    cwd: path.dirname(exePath),
    env: {
      ...process.env,
      SCHOOL_DATA_DIR: dataDir,
      SCHOOL_APP_VERSION: resolveAppVersion(),
    },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return wireChildProcess(child, { onLog, onExit });
}

/**
 * Starts the backend in whichever mode DESKTOP_BACKEND_MODE resolves to
 * (default: source). See resolveBackendMode() for validation rules.
 */
function startBackend({ dataDir, onLog, onExit }) {
  const mode = resolveBackendMode();
  onLog?.(`Starting backend in "${mode}" mode.`);
  return mode === 'packaged'
    ? spawnPackagedBackend({ dataDir, onLog, onExit })
    : spawnSourceBackend({ dataDir, onLog, onExit });
}

/**
 * Stops a backend process this Electron instance owns. Bounded and
 * Windows-safe: tries a normal kill first, then falls back to a taskkill
 * scoped to that exact PID (and its child tree) if it hasn't exited by the
 * halfway point, and always resolves by the timeout rather than hanging.
 * Never touches any process other than this specific PID.
 */
function stopBackend(child, { timeoutMs = 5000 } = {}) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null || child.killed) {
      resolve();
      return;
    }

    const pid = child.pid;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    child.once('exit', finish);

    try {
      child.kill();
    } catch {
      // Process may already be gone; the bounded wait below still applies.
    }

    const forceKillTimer = setTimeout(() => {
      if (settled || !pid) return;
      if (process.platform === 'win32') {
        execFile('taskkill', ['/pid', String(pid), '/t', '/f'], () => {
          // Best-effort only; the giveUpTimer below bounds total wait time
          // regardless of whether taskkill itself succeeds.
        });
      }
    }, Math.floor(timeoutMs / 2));

    const giveUpTimer = setTimeout(finish, timeoutMs);

    child.once('exit', () => {
      clearTimeout(forceKillTimer);
      clearTimeout(giveUpTimer);
    });
  });
}

module.exports = {
  HOST,
  PORT,
  HEALTH_URL,
  inspectExistingBackend,
  ensureDataDir,
  startBackend,
  stopBackend,
};
