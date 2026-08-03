'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BACKEND_DIR = path.join(REPO_ROOT, 'backend');

function defaultVenvPython() {
  return process.platform === 'win32'
    ? path.join(BACKEND_DIR, '.venv', 'Scripts', 'python.exe')
    : path.join(BACKEND_DIR, '.venv', 'bin', 'python');
}

/**
 * Resolves the Python interpreter used to run the backend.
 * Order: DESKTOP_PYTHON_PATH env var -> backend/.venv -> throws with a
 * clear, actionable message. Never silently falls back to a bare "python"
 * on PATH, since that may not be the project's interpreter.
 */
function resolvePythonPath() {
  const configured = process.env.DESKTOP_PYTHON_PATH;
  if (configured) {
    if (!fs.existsSync(configured)) {
      throw new Error(
        `DESKTOP_PYTHON_PATH is set to "${configured}" but that file does not exist.`
      );
    }
    return configured;
  }

  const venvPython = defaultVenvPython();
  if (fs.existsSync(venvPython)) {
    return venvPython;
  }

  throw new Error(
    'Could not find a Python interpreter for the backend.\n' +
      `Expected a virtual environment at "${venvPython}", but it was not found.\n` +
      'Create it with:\n' +
      '  cd backend && python -m venv .venv && .venv\\Scripts\\pip install -r requirements.txt\n' +
      'or set DESKTOP_PYTHON_PATH to an existing Python executable (see desktop/.env.example).'
  );
}

/**
 * Resolves the Stage 1 desktop backend launcher script.
 * Order: DESKTOP_BACKEND_LAUNCHER env var (relative to repo root, or
 * absolute) -> backend/desktop_launcher.py -> throws.
 */
function resolveLauncherPath() {
  const configured = process.env.DESKTOP_BACKEND_LAUNCHER;
  const launcherPath = configured
    ? path.resolve(REPO_ROOT, configured)
    : path.join(BACKEND_DIR, 'desktop_launcher.py');

  if (!fs.existsSync(launcherPath)) {
    throw new Error(`Backend launcher script not found at "${launcherPath}".`);
  }
  return launcherPath;
}

const VALID_BACKEND_MODES = ['source', 'packaged'];

/**
 * True only when actually running inside a Forge-packaged/installed
 * Electron app (Stage 4) — never true for plain `node` invocations (e.g.
 * desktop/utils/run-python.cjs, used by build:backend and dev:backend*
 * npm scripts), and never true for unpackaged `electron desktop/main.cjs`
 * dev runs either. `require('electron')` returns a plain path *string*
 * (not the module API) when required outside the Electron runtime, so this
 * must not be called unconditionally from a plain-Node context.
 */
function isPackagedElectronApp() {
  if (!process.versions.electron) return false;
  try {
    const { app } = require('electron');
    return Boolean(app && app.isPackaged);
  } catch {
    return false;
  }
}

/**
 * Resolves which backend Electron should start.
 *   - 'source' (default outside a packaged app): the Stage 1 Python
 *     launcher, via resolvePythonPath().
 *   - 'packaged': the PyInstaller executable, via resolvePackagedExePath().
 * A Forge-packaged/installed app has no Python venv to fall back to, so it
 * always resolves to 'packaged' regardless of DESKTOP_BACKEND_MODE. Outside
 * that, an unset DESKTOP_BACKEND_MODE silently means "source" (the
 * long-standing dev default); a *set but unrecognized* value throws instead
 * of silently falling back, since guessing wrong here would start the wrong
 * backend.
 */
function resolveBackendMode() {
  if (isPackagedElectronApp()) return 'packaged';

  const configured = process.env.DESKTOP_BACKEND_MODE;
  if (!configured) return 'source';
  if (!VALID_BACKEND_MODES.includes(configured)) {
    throw new Error(
      `DESKTOP_BACKEND_MODE is set to "${configured}", but must be one of: ` +
        `${VALID_BACKEND_MODES.join(', ')}.`
    );
  }
  return configured;
}

/**
 * Stage 4: inside a packaged/installed app, the PyInstaller onedir output
 * is copied to resources/backend/school-backend/ (outside asar — see the
 * packageAfterCopy hook in forge.config.cjs), reachable via
 * process.resourcesPath. Outside a packaged app, falls back to the Stage 3
 * repo-relative dev/test location.
 */
function defaultPackagedExePath() {
  if (isPackagedElectronApp()) {
    return path.join(process.resourcesPath, 'backend', 'school-backend', 'school-backend.exe');
  }
  return path.join(BACKEND_DIR, 'dist', 'school-backend', 'school-backend.exe');
}

/**
 * Resolves the packaged backend executable.
 * Order: DESKTOP_BACKEND_EXE env var (relative to repo root, or absolute)
 * -> installed-app resource path or Stage 3 repo-relative dev/test path ->
 * throws with a clear, actionable message (never silently falls back to
 * source mode, and never falls back to a source-repository path from an
 * installed application).
 */
function resolvePackagedExePath() {
  const configured = process.env.DESKTOP_BACKEND_EXE;
  const exePath = configured ? path.resolve(REPO_ROOT, configured) : defaultPackagedExePath();

  if (!fs.existsSync(exePath)) {
    const helpText = isPackagedElectronApp()
      ? 'This installation is missing its bundled backend resources. Reinstall the application.'
      : 'Build it first with:\n' +
        '  npm run build:backend\n' +
        'or set DESKTOP_BACKEND_EXE to an existing school-backend.exe (see desktop/.env.example).';
    throw new Error(`Packaged backend executable not found at "${exePath}".\n${helpText}`);
  }
  return exePath;
}

module.exports = {
  REPO_ROOT,
  BACKEND_DIR,
  resolvePythonPath,
  resolveLauncherPath,
  resolveBackendMode,
  resolvePackagedExePath,
  isPackagedElectronApp,
};
