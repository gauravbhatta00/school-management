#!/usr/bin/env node
'use strict';

/**
 * Pre-package validation (Stage 4 §14). Run before Electron Forge packages
 * the app, so a missing/incomplete artifact fails loudly here instead of
 * producing a broken installer. Exits non-zero on the first missing
 * required artifact after checking everything (so a single run reports
 * every problem, not just the first one).
 *
 * Usage: node desktop/scripts/validate-resources.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

const FRONTEND_DIST = path.join(ROOT, 'frontend', 'dist');
const FRONTEND_ENTRY = path.join(FRONTEND_DIST, 'index.html');
const FRONTEND_ASSETS = path.join(FRONTEND_DIST, 'assets');
const BACKEND_DIR = path.join(ROOT, 'backend', 'dist', 'school-backend');
const BACKEND_EXE = path.join(BACKEND_DIR, 'school-backend.exe');
const BACKEND_INTERNAL = path.join(BACKEND_DIR, '_internal');
const MAIN_CJS = path.join(ROOT, 'desktop', 'main.cjs');
const PRELOAD_CJS = path.join(ROOT, 'desktop', 'preload.cjs');
const FORGE_CONFIG = path.join(ROOT, 'forge.config.cjs');
const ICON_PATH = path.join(ROOT, 'desktop', 'assets', 'icon.ico');

let failed = false;

function check(label, condition, hint) {
  if (condition) {
    console.log(`[validate] PASS  ${label}`);
  } else {
    failed = true;
    console.error(`[validate] FAIL  ${label}`);
    if (hint) console.error(`                 ${hint}`);
  }
}

function findByExtension(dir, extensions) {
  const found = [];
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    const name = entry.name.toLowerCase();
    if (extensions.some((ext) => name.endsWith(ext))) {
      found.push(path.join(entry.parentPath ?? entry.path ?? dir, entry.name));
    }
  }
  return found;
}

console.log('[validate] Checking required artifacts before packaging...\n');

// ── Required artifacts ──────────────────────────────────────────────────
check(
  'React production entry file exists (frontend/dist/index.html)',
  fs.existsSync(FRONTEND_ENTRY),
  'Run: npm run build:frontend:desktop'
);
check(
  'React asset files exist (frontend/dist/assets/)',
  fs.existsSync(FRONTEND_ASSETS) && fs.readdirSync(FRONTEND_ASSETS).length > 0,
  'Run: npm run build:frontend:desktop'
);
check(
  'Packaged Django executable exists (backend/dist/school-backend/school-backend.exe)',
  fs.existsSync(BACKEND_EXE),
  'Run: npm run build:backend'
);
check(
  'PyInstaller runtime directory exists (backend/dist/school-backend/_internal/)',
  fs.existsSync(BACKEND_INTERNAL) && fs.readdirSync(BACKEND_INTERNAL).length > 0,
  'Run: npm run build:backend'
);
check('Electron main file exists (desktop/main.cjs)', fs.existsSync(MAIN_CJS));
check('Electron preload file exists (desktop/preload.cjs)', fs.existsSync(PRELOAD_CJS));
check('Forge configuration exists (forge.config.cjs)', fs.existsSync(FORGE_CONFIG));
check(
  'Application icon exists (desktop/assets/icon.ico)',
  fs.existsSync(ICON_PATH),
  'See desktop/assets/README.md — a placeholder must exist even if not final branding.'
);

// ── Nothing sensitive/unnecessary is reachable from what gets packaged ──
// (desktop/ and frontend/dist/ are the only source paths forge.config.cjs
// includes — these checks defend against future misconfiguration, since
// backend/, .venv/, and dev data never belong inside either.)
const PACKAGED_SOURCE_DIRS = [path.join(ROOT, 'desktop'), FRONTEND_DIST];

for (const dir of PACKAGED_SOURCE_DIRS) {
  const rel = path.relative(ROOT, dir);

  const sqliteFiles = findByExtension(dir, ['.sqlite3', '.sqlite']);
  check(`No development database under ${rel}/`, sqliteFiles.length === 0, sqliteFiles.join(', '));

  const mediaDirs = fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true, recursive: true })
        .filter((e) => e.isDirectory() && e.name.toLowerCase() === 'media')
    : [];
  check(`No development media directory under ${rel}/`, mediaDirs.length === 0);

  const envFiles = fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true, recursive: true })
        .filter((e) => e.isFile() && /^\.env(\..+)?$/.test(e.name) && !e.name.endsWith('.example'))
    : [];
  check(`No .env secrets under ${rel}/`, envFiles.length === 0, envFiles.map((e) => e.name).join(', '));

  const venvDirs = fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true, recursive: true })
        .filter((e) => e.isDirectory() && e.name === '.venv')
    : [];
  check(`No Python virtual environment under ${rel}/`, venvDirs.length === 0);

  const nestedNodeModules = fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true, recursive: true })
        .filter((e) => e.isDirectory() && e.name === 'node_modules')
    : [];
  check(`No nested node_modules manually copied under ${rel}/`, nestedNodeModules.length === 0);
}

console.log('');
if (failed) {
  console.error('[validate] One or more required artifacts are missing or invalid. Aborting.');
  process.exit(1);
}
console.log('[validate] All required artifacts present. Safe to package.');
