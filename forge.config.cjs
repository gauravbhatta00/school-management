'use strict';

/**
 * Electron Forge configuration (Stage 4 — Windows packaging + installer).
 *
 * All paths are resolved relative to this file (__dirname is the repo
 * root, since Forge loads this file from there), never a machine-specific
 * absolute path.
 *
 * What gets packaged, and how:
 *   - App source (goes inside app.asar): desktop/**, frontend/dist/**, and
 *     the root package.json — everything else (backend/, frontend/src,
 *     node_modules, .venv, docs, tests, .git, ...) is excluded via
 *     `ignore` below. None of desktop/*.cjs requires anything from
 *     node_modules at runtime (only Node built-ins + the `electron` module
 *     itself, which Electron provides natively), so node_modules doesn't
 *     need to ship at all.
 *   - The Django backend (PyInstaller --onedir output) is copied via the
 *     packageAfterCopy hook directly into resources/backend/school-backend,
 *     a sibling of app.asar — outside ASAR entirely, exactly where a
 *     native executable needs to live to still be runnable.
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ICON_PATH = path.join(ROOT, 'desktop', 'assets', 'icon.ico');
const BACKEND_SRC = path.join(ROOT, 'backend', 'dist', 'school-backend');

const APP_NAME = 'SchoolManagement';
const PRODUCT_TITLE = 'EduCore — School Management System';
const AUTHOR = 'GIgaBYte6610';
const DESCRIPTION = 'Desktop school management system (React + Django REST Framework, packaged with Electron).';

/**
 * Allowlist-based ignore function (Stage 4 §2/§14): only what's needed to
 * run the Electron shell and the already-built React app is copied into
 * the packaged app source. Everything else — the Python virtualenv, the
 * Django source tree, dev databases/media, frontend/src, tests, docs — is
 * excluded, regardless of what happens to exist in the working tree when
 * packaging runs.
 *
 * electron-packager calls this once per path *and stops recursing into a
 * directory the moment it's told to ignore it* — so an ancestor of an
 * allowed path (e.g. "/frontend", the parent of the allowed
 * "/frontend/dist") must also resolve to "not ignored", or the allowed
 * subtree underneath it is never even visited. keptPrefixes therefore
 * matches exact allowed paths, anything inside them, AND any ancestor
 * directory that leads to one.
 */
const KEEP_EXACT = ['/package.json'];
const KEEP_PREFIXES = ['/desktop', '/frontend/dist'];

function shouldIgnore(filePath) {
  if (!filePath) return false; // the project root itself must never be ignored
  const normalized = filePath.replace(/\\/g, '/');

  if (KEEP_EXACT.includes(normalized)) return false;

  for (const prefix of KEEP_PREFIXES) {
    if (normalized === prefix) return false; // the allowed directory itself
    if (normalized.startsWith(`${prefix}/`)) return false; // something inside it
    if (prefix.startsWith(`${normalized}/`)) return false; // an ancestor leading to it
  }

  return true;
}

module.exports = {
  packagerConfig: {
    name: APP_NAME,
    executableName: APP_NAME,
    icon: ICON_PATH,
    asar: true,
    ignore: shouldIgnore,
    win32metadata: {
      CompanyName: AUTHOR,
      ProductName: APP_NAME,
      FileDescription: DESCRIPTION,
    },
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: APP_NAME,
        title: PRODUCT_TITLE,
        authors: AUTHOR,
        owners: AUTHOR,
        description: DESCRIPTION,
        exe: `${APP_NAME}.exe`,
        setupExe: 'SchoolManagementSetup.exe',
        setupIcon: ICON_PATH,
        noMsi: true, // one Windows installer system only, per Stage 4 scope
      },
    },
  ],
  plugins: [],
  hooks: {
    /**
     * Copies the Stage 3 PyInstaller --onedir backend output into
     * resources/backend/school-backend, preserving its full directory
     * structure (not just the .exe). Runs after Forge copies the app
     * source but before ASAR packing, so this lands as a sibling of
     * app.asar rather than inside it — see desktop/utils/python-path.cjs's
     * process.resourcesPath-based resolution for how the app finds it at
     * runtime.
     */
    packageAfterCopy: async (_forgeConfig, buildPath) => {
      if (!fs.existsSync(BACKEND_SRC)) {
        throw new Error(
          `Packaged Django backend not found at "${BACKEND_SRC}".\n` +
            'Build it first with:\n' +
            '  npm run build:backend'
        );
      }
      if (!fs.existsSync(path.join(BACKEND_SRC, 'school-backend.exe'))) {
        throw new Error(
          `"${BACKEND_SRC}" exists but school-backend.exe is missing from it — ` +
            'the PyInstaller build is incomplete. Rebuild with: npm run build:backend'
        );
      }

      const resourcesDir = path.dirname(buildPath);
      const backendDest = path.join(resourcesDir, 'backend', 'school-backend');

      fs.rmSync(path.join(resourcesDir, 'backend'), { recursive: true, force: true });
      fs.mkdirSync(path.dirname(backendDest), { recursive: true });
      fs.cpSync(BACKEND_SRC, backendDest, { recursive: true });
    },
  },
};
