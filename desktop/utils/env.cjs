'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Minimal .env loader for desktop/.env (optional, gitignored, local-only
 * overrides — see desktop/.env.example). Intentionally not a dependency:
 * this project's only need is a handful of plain KEY=VALUE lines. Real
 * environment variables always win over the file.
 */
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const contents = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function loadDesktopEnv() {
  loadEnvFile(path.join(__dirname, '..', '.env'));
}

module.exports = { loadDesktopEnv, loadEnvFile };
