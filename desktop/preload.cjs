'use strict';

/**
 * Minimal, secure preload bridge. Runs with contextIsolation + sandbox
 * enabled, so it can only reach the safe subset of Node the sandboxed
 * preload context exposes (no filesystem, no child_process, no raw
 * `require` in the page). React gets exactly the specific, narrow actions
 * below — never the raw `ipcRenderer` object, and never a way to pass an
 * arbitrary filesystem path or shell command through to the main process.
 *
 * Every function here maps 1:1 to one of the channels registered in
 * desktop/utils/ipc-handlers.cjs. Channel names are hardcoded on both
 * ends (an allowlist by construction — there is no generic "invoke(channel,
 * args)" passthrough for the page to call an unlisted channel with).
 */

const { contextBridge, ipcRenderer } = require('electron');

function invoke(channel, args) {
  return ipcRenderer.invoke(channel, args);
}

contextBridge.exposeInMainWorld('desktopApp', {
  isElectron: true,
  platform: process.platform,

  getInfo: () => invoke('app:get-info'),

  backup: {
    chooseDestination: () => invoke('backup:choose-destination'),
    chooseFile: () => invoke('backup:choose-file'),
    openFolder: () => invoke('backup:open-folder'),
    copyTo: (filename, destinationDir) => invoke('backup:copy-to', { filename, destinationDir }),
  },

  restore: {
    finalize: () => invoke('restore:finalize'),
  },

  logs: {
    openFolder: () => invoke('logs:open-folder'),
  },

  diagnostics: {
    export: (content) => invoke('diagnostics:export', { content }),
  },
});
