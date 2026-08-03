'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Resolves the bundled React production entry point (Stage 4).
 *
 * Only used in packaged mode — dev mode always loads the Vite dev server
 * URL directly and never calls this.
 *
 * Resolution is __dirname-relative (desktop/utils -> ../../frontend/dist),
 * which works identically whether the app is running from the source repo
 * (unpacked dev/test) or from inside app.asar: Forge packages desktop/ and
 * frontend/dist/ preserving this same relative layout, and Electron's
 * asar-aware fs patch makes paths inside the archive transparent to
 * fs.existsSync/readFileSync/BrowserWindow.loadFile alike, so no
 * asar-vs-not branching is needed here.
 */
function resolveFrontendEntry() {
  const entryPath = path.join(__dirname, '..', '..', 'frontend', 'dist', 'index.html');
  if (!fs.existsSync(entryPath)) {
    throw new Error(
      `Bundled React build not found at "${entryPath}".\n` +
        'Build it first with:\n' +
        '  npm run build:frontend:desktop'
    );
  }
  return entryPath;
}

module.exports = { resolveFrontendEntry };
