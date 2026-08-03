#!/usr/bin/env node
'use strict';

/**
 * Stage 5 release pipeline: `npm run verify:release`.
 *
 * 1. Checks Git branch/working-tree state and basic environment
 *    prerequisites (never hard-fails on git state — a release build should
 *    still be inspectable from a dirty tree during testing — only the
 *    backend virtualenv missing is treated as fatal).
 * 2. Runs the existing `make:desktop` pipeline (build:backend ->
 *    build:frontend:desktop -> validate:desktop -> electron-forge package
 *    -> electron-forge make), which already fails loudly and stops the
 *    whole chain on any step's non-zero exit.
 * 3. Computes a SHA-256 checksum of the generated installer and writes it
 *    to SchoolManagementSetup-<version>.exe.sha256 alongside it.
 * 4. Prints every output path and size clearly.
 *
 * Never publishes anything — this only ever writes into backend/dist,
 * frontend/dist, and out/, exactly like the existing build scripts.
 */

const { execSync, spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function step(label) {
  console.log(`\n[release] ${label}`);
}

function fail(message) {
  console.error(`[release] FAIL: ${message}`);
  process.exit(1);
}

function checkGitAndEnvironment() {
  step('Checking Git and environment assumptions...');

  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: REPO_ROOT }).toString().trim();
    console.log(`  Branch: ${branch}`);
    if (branch !== 'main') {
      console.warn(`  WARNING: not on 'main' (currently on '${branch}').`);
    }

    const status = execSync('git status --porcelain', { cwd: REPO_ROOT }).toString().trim();
    if (status) {
      console.warn(`  WARNING: working tree has uncommitted changes (${status.split('\n').length} entr${status.split('\n').length === 1 ? 'y' : 'ies'}).`);
    } else {
      console.log('  Working tree is clean.');
    }
  } catch (err) {
    console.warn(`  WARNING: could not inspect Git state (${err.message}).`);
  }

  console.log(`  Node: ${process.version}`);

  const venvPython = path.join(REPO_ROOT, 'backend', '.venv', 'Scripts', 'python.exe');
  if (!fs.existsSync(venvPython)) {
    fail(
      `Backend virtual environment not found at ${venvPython}.\n` +
        'Create it first:\n' +
        '  cd backend && python -m venv .venv && .venv\\Scripts\\pip install -r requirements.txt -r requirements-build.txt'
    );
  }
  console.log('  Backend virtual environment found.');

  const pkg = require(path.join(REPO_ROOT, 'package.json'));
  console.log(`  Application version: ${pkg.version}`);
  return pkg.version;
}

function runPipeline() {
  step('Running the full build/package/installer pipeline (npm run make:desktop)...');
  const result = spawnSync('npm', ['run', 'make:desktop'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    fail('make:desktop failed — see the output above for the failing step.');
  }
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function computeChecksum(version) {
  step('Computing installer checksum...');
  const installerPath = path.join(REPO_ROOT, 'out', 'make', 'squirrel.windows', 'x64', 'SchoolManagementSetup.exe');
  if (!fs.existsSync(installerPath)) {
    fail(`Installer not found at ${installerPath}.`);
  }

  const checksum = sha256File(installerPath);
  const checksumFilename = `SchoolManagementSetup-${version}.exe.sha256`;
  const checksumPath = path.join(path.dirname(installerPath), checksumFilename);
  const content = [
    'filename: SchoolManagementSetup.exe',
    `sha256: ${checksum}`,
    `version: ${version}`,
    `generated_at: ${new Date().toISOString()}`,
    '',
  ].join('\n');
  fs.writeFileSync(checksumPath, content, 'utf8');
  console.log(`  ${checksumPath}`);

  return { installerPath, checksumPath, checksum };
}

function directorySizeBytes(dir) {
  let total = 0;
  if (!fs.existsSync(dir)) return total;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    try {
      total += fs.statSync(path.join(entry.parentPath ?? entry.path ?? dir, entry.name)).size;
    } catch {
      // Best-effort size total; a single unreadable entry shouldn't abort the summary.
    }
  }
  return total;
}

function formatMb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function printSummary({ installerPath, checksumPath, checksum }) {
  step('Release summary');
  const unpackedDir = path.join(REPO_ROOT, 'out', 'SchoolManagement-win32-x64');

  console.log(`  Unpacked app:      ${unpackedDir}`);
  if (fs.existsSync(unpackedDir)) {
    console.log(`  Unpacked size:     ${formatMb(directorySizeBytes(unpackedDir))}`);
  }
  console.log(`  Installer:         ${installerPath}`);
  console.log(`  Installer size:    ${formatMb(fs.statSync(installerPath).size)}`);
  console.log(`  Installer SHA-256: ${checksum}`);
  console.log(`  Checksum file:     ${checksumPath}`);
  console.log(
    '\n[release] Done. This build is unsigned and was not published — ' +
      'see README.md and docs/RELEASE_NOTES_TEMPLATE.md for the remaining release checklist.'
  );
}

function main() {
  const version = checkGitAndEnvironment();
  runPipeline();
  const checksumInfo = computeChecksum(version);
  printSummary(checksumInfo);
}

main();
