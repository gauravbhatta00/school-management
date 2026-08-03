'use strict';

const path = require('path');
const { app, BrowserWindow, shell, dialog } = require('electron');

// Must run before anything else: a Squirrel.Windows install/update/
// uninstall launches this exact executable with a --squirrel-* flag to ask
// it to (de)register its own Start Menu shortcut, then expects it to exit
// immediately — no window, no backend, nothing else.
const { handleSquirrelStartupEvent } = require('./utils/squirrel-startup.cjs');
if (handleSquirrelStartupEvent()) {
  app.quit();
  return;
}

const { loadDesktopEnv } = require('./utils/env.cjs');
loadDesktopEnv();

const {
  HEALTH_URL,
  inspectExistingBackend,
  ensureDataDir,
  startBackend,
  stopBackend,
} = require('./utils/backend-process.cjs');
const { resolveBackendMode, resolvePackagedExePath } = require('./utils/python-path.cjs');
const { resolveFrontendEntry } = require('./utils/frontend-path.cjs');
const { initLogger, logger } = require('./utils/logger.cjs');
const { waitForHealthy, waitForPortOpen } = require('./utils/health-check.cjs');
const { registerIpcHandlers } = require('./utils/ipc-handlers.cjs');

const DEV_SERVER_URL = process.env.ELECTRON_DEV_SERVER_URL || 'http://127.0.0.1:5173';
const DEV_SERVER_ORIGIN = new URL(DEV_SERVER_URL).origin;
const isDev = !app.isPackaged;
const ICON_PATH = path.join(__dirname, 'assets', 'icon.ico');

let mainWindow = null;
let backendChild = null;
let backendOwnedByUs = false;
let currentBackendMode = null;
let shuttingDown = false;
// Set for the duration of any intentional stopBackend() call, so the
// 'exit' event that follows isn't misread by handleBackendExit as an
// unexpected crash (which would otherwise show a second, spurious dialog).
let expectingBackendExit = false;

function devLog(...args) {
  if (isDev) console.log('[electron]', ...args);
}

/** Persistent data location: <userData>/data (never inside the repo, the
 * install directory, or an ASAR-packed resource). */
function getDataDir() {
  return path.join(app.getPath('userData'), 'data');
}

/** Stops a backend we own, marking its exit as intentional first. */
async function stopOwnedBackend() {
  if (!backendChild || !backendOwnedByUs) return;
  expectingBackendExit = true;
  try {
    await stopBackend(backendChild);
  } finally {
    backendChild = null;
    backendOwnedByUs = false;
    expectingBackendExit = false;
  }
}

/** Spawns and tracks a new owned backend process. Shared by normal startup
 * and by the Stage 5 restore flow (which stops, swaps files, then needs to
 * start a fresh backend the exact same way). */
function spawnAndTrackBackend(dataDir, mode) {
  if (mode === 'packaged') {
    logger.info(`Backend executable: ${resolvePackagedExePath()}`);
  }

  backendChild = startBackend({
    dataDir,
    onLog: (line) => {
      devLog(line);
      logger.info(line);
    },
    onExit: (code, signal) => handleBackendExit(code, signal),
  });
  backendOwnedByUs = true;
  logger.info(`Backend process started (pid=${backendChild.pid ?? 'unknown'}).`);
  return backendChild;
}

async function ensureBackendRunning() {
  // Validated first, before any port probing or process spawning: an
  // unrecognized DESKTOP_BACKEND_MODE must fail loudly, never silently fall
  // back to a mode the user didn't ask for.
  const mode = resolveBackendMode();
  currentBackendMode = mode;

  // Stage 4 startup order: resolve userData, then create the persistent
  // data directory, before ever touching port 8765 — so logging (and any
  // failure below) always has somewhere durable to go.
  const dataDir = getDataDir();
  ensureDataDir(dataDir);
  initLogger(dataDir, { console: isDev });
  logger.info(`Application starting. Backend mode: ${mode}. Data directory: ${dataDir}.`);

  // Registered regardless of whether this instance ends up owning the
  // backend or reusing an externally-started one: backup/diagnostics/
  // folder-picker actions only ever talk to Django's HTTP API or the local
  // filesystem, neither of which cares who spawned the process. Only
  // restore:finalize itself refuses to proceed when the backend isn't
  // owned by this instance (see ipc-handlers.cjs / restore.cjs).
  registerIpcHandlers({
    getDataDir,
    isBackendOwned: () => backendOwnedByUs,
    stopOwnedBackend,
    startOwnedBackend: () => spawnAndTrackBackend(dataDir, currentBackendMode),
    waitForHealthy: () => waitForHealthy(HEALTH_URL, { timeoutMs: 30000, intervalMs: 500 }),
    onLog: (line) => {
      devLog(line);
      logger.info(line);
    },
  });

  const existing = await inspectExistingBackend();

  if (existing.state === 'reuse') {
    logger.info('An existing school-management backend is already healthy on 8765; reusing it.');
    backendOwnedByUs = false;
    return;
  }

  if (existing.state === 'conflict') {
    const message =
      `Port 8765 is already in use by another application (${existing.reason}). ` +
      'Close that application and try again.';
    logger.error(message);
    throw new Error(message);
  }

  try {
    spawnAndTrackBackend(dataDir, mode);
  } catch (err) {
    logger.error(err.message);
    throw err;
  }

  const health = await waitForHealthy(HEALTH_URL, { timeoutMs: 30000, intervalMs: 500 });
  if (!health.ok) {
    logger.error(`Backend did not become healthy in time: ${health.reason}`);
    await stopOwnedBackend();
    throw new Error(`Backend did not become healthy in time: ${health.reason}`);
  }
  logger.info('Backend health check passed.');
}

/** Detects the backend dying after startup — never left silently "as if" it were still there. */
function handleBackendExit(code, signal) {
  if (shuttingDown || expectingBackendExit || !backendOwnedByUs) return;

  backendOwnedByUs = false;
  backendChild = null;
  const message = `Backend exited unexpectedly (code=${code}, signal=${signal}).`;
  console.error(`[electron] ${message}`);
  logger.error(message);

  dialog.showErrorBox(
    'Backend stopped unexpectedly',
    'The local school-management backend stopped responding. ' +
      'The application will now close. Please reopen it to try again.'
  );
  app.quit();
}

async function waitForFrontend() {
  const url = new URL(DEV_SERVER_URL);
  const port = Number(url.port) || (url.protocol === 'https:' ? 443 : 80);
  const result = await waitForPortOpen(url.hostname, port, { timeoutMs: 30000, intervalMs: 500 });
  if (!result.ok) {
    throw new Error(
      `Could not reach the Vite development server at ${DEV_SERVER_URL}: ${result.reason}`
    );
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'EduCore — School Management System',
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: '#111827',
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: isDev,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // Dev: only ever navigate within the approved dev-server origin. Packaged:
  // the app never needs a full-page navigation of its own — HashRouter (see
  // frontend/src/main.jsx) keeps route changes within the same document —
  // so any 'will-navigate' there is unexpected and denied outright.
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (!isDev) {
      event.preventDefault();
      return;
    }
    let targetOrigin;
    try {
      targetOrigin = new URL(targetUrl).origin;
    } catch {
      targetOrigin = null;
    }
    if (targetOrigin !== DEV_SERVER_ORIGIN) {
      event.preventDefault();
    }
  });

  // No uncontrolled popups. Only https links escape to the system browser;
  // everything else (including unsafe/custom schemes) is denied outright.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return { action: 'deny' };
    }
    if (parsed.protocol === 'https:') {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    const message = `Failed to load frontend: ${errorCode} ${errorDescription}`;
    console.error(`[electron] ${message}`);
    logger.error(message);
  });

  if (isDev && process.env.ELECTRON_OPEN_DEVTOOLS === '1') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/** Loads the Vite dev server in dev, or the bundled React build once packaged. */
async function loadFrontend() {
  if (isDev) {
    await mainWindow.loadURL(DEV_SERVER_URL);
  } else {
    const entryPath = resolveFrontendEntry();
    logger.info(`Loading bundled frontend: ${entryPath}`);
    await mainWindow.loadFile(entryPath);
  }
}

// Stops any backend we own BEFORE showing the (blocking) error dialog —
// cleanup must not wait on the user dismissing a modal — then quits.
async function failStartup(title, message) {
  console.error(`[electron] ${title}:`, message);
  logger.error(`${title}: ${message}`);
  await stopOwnedBackend();
  dialog.showErrorBox(title, message);
  app.quit();
}

async function startup() {
  try {
    await ensureBackendRunning();
    if (isDev) {
      await waitForFrontend();
    }
  } catch (err) {
    await failStartup('Failed to start', err.message);
    return;
  }

  createWindow();
  try {
    await loadFrontend();
  } catch (err) {
    await failStartup('Failed to load frontend', err.message);
  }
}

// Single-instance lock: a second launch never starts a second backend or
// opens a second window — it hands off to this instance and exits
// immediately instead. Must be requested before any other app.* listener.
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(startup);

  app.on('window-all-closed', () => {
    // This is a Windows/Linux-first desktop app; on macOS keep the standard
    // convention of staying alive until an explicit quit.
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      loadFrontend();
    }
  });

  let cleanupPromise = null;
  function cleanupBeforeQuit() {
    if (cleanupPromise) return cleanupPromise;
    shuttingDown = true;
    cleanupPromise = (async () => {
      if (backendChild && backendOwnedByUs) {
        devLog('Stopping backend owned by this Electron instance...');
        logger.info('Stopping backend owned by this Electron instance...');
        try {
          await stopOwnedBackend();
        } catch (err) {
          console.error('[electron] Error while stopping backend:', err.message);
          logger.error(`Error while stopping backend: ${err.message}`);
        }
      }
    })();
    return cleanupPromise;
  }

  app.on('before-quit', (event) => {
    if (!cleanupPromise) {
      event.preventDefault();
      cleanupBeforeQuit().then(() => app.quit());
    }
  });
}
