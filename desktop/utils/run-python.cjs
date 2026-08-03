#!/usr/bin/env node
'use strict';

/**
 * Thin CLI used by root npm scripts (dev:backend, dev:backend:desktop) so
 * they resolve the project's Python interpreter the same way Electron does
 * (DESKTOP_PYTHON_PATH override, else backend/.venv), instead of trusting
 * whatever "python" happens to be first on PATH.
 *
 * Usage: node desktop/utils/run-python.cjs <script.py> [args...]
 */

const { spawn } = require('child_process');
const path = require('path');
const { resolvePythonPath, BACKEND_DIR, REPO_ROOT } = require('./python-path.cjs');

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node desktop/utils/run-python.cjs <script.py> [args...]');
    process.exit(1);
  }

  let pythonPath;
  try {
    pythonPath = resolvePythonPath();
  } catch (err) {
    console.error(`[run-python] ${err.message}`);
    process.exit(1);
  }

  const [script, ...rest] = args;
  const resolvedScript = path.isAbsolute(script) ? script : path.resolve(REPO_ROOT, script);

  const child = spawn(pythonPath, ['-u', resolvedScript, ...rest], {
    cwd: BACKEND_DIR,
    env: process.env,
    stdio: 'inherit',
  });

  child.on('exit', (code) => process.exit(code ?? 1));
  child.on('error', (err) => {
    console.error(`[run-python] Failed to start Python: ${err.message}`);
    process.exit(1);
  });
}

main();
