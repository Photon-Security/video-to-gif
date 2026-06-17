// preload.js — runs in a sandboxed context with a very limited stdlib (only
// `electron`, `events`, `timers`, `url` are available; `path`/`fs` are NOT).
// Bridges a small, explicit surface to the renderer via contextBridge. The
// renderer itself has nodeIntegration: false and cannot require() anything.

const { contextBridge, ipcRenderer, webUtils } = require('electron');

const SUPPORTED_VIDEO_EXTS = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.3gp', '.mpg', '.mpeg'];

// path.basename / path.extname replacements — sandboxed preload can't require
// the `path` module. These cover what the renderer actually needs.
function basename(p) {
  if (typeof p !== 'string') return '';
  const sep = p.includes('\\') ? '\\' : '/';
  const idx = p.lastIndexOf(sep);
  return idx === -1 ? p : p.slice(idx + 1);
}
function extname(p) {
  const b = basename(p);
  const dot = b.lastIndexOf('.');
  return dot <= 0 ? '' : b.slice(dot).toLowerCase();
}

contextBridge.exposeInMainWorld('api', {
  // File picker / drag-drop helpers.
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  statFile: (filePath) => ipcRenderer.invoke('stat-file', filePath),

  // Conversion lifecycle.
  startConversion: (videoPath) => ipcRenderer.send('convert-video', videoPath),
  cancelConversion: () => ipcRenderer.send('cancel-conversion'),

  // Open the produced GIF or its containing folder in the OS file manager.
  openPath: (p) => ipcRenderer.invoke('open-path', p),
  showItemInFolder: (p) => ipcRenderer.invoke('show-in-folder', p),

  // Open an external URL in the user's default browser. Used for the donate
  // link and any other outbound web link.
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Convert a local filesystem path into a file:// URL Chromium can load.
  pathToFileURL: (p) => ipcRenderer.invoke('path-to-file-url', p),

  // Helpers that don't need to round-trip to main.
  basename,
  extname,
  isSupportedVideo: (p) => SUPPORTED_VIDEO_EXTS.includes(extname(p)),
  supportedExtensions: () => [...SUPPORTED_VIDEO_EXTS],

  // Resolve a real filesystem path from a dragged-in File object.
  // Required because Electron removed File.path in v32+; webUtils replaces it.
  getPathForFile: (file) => (webUtils && webUtils.getPathForFile ? webUtils.getPathForFile(file) : (file && file.path) || null),

  // Event subscriptions. Returns an unsubscribe function so renderer can
  // clean up cleanly without exposing the raw ipcRenderer object.
  onConversionProgress: (cb) => {
    const handler = (_event, data) => cb(data);
    ipcRenderer.on('conversion-progress', handler);
    return () => ipcRenderer.removeListener('conversion-progress', handler);
  },
  onConversionProgressPct: (cb) => {
    const handler = (_event, data) => cb(data);
    ipcRenderer.on('conversion-progress-pct', handler);
    return () => ipcRenderer.removeListener('conversion-progress-pct', handler);
  },
  onConversionVersion: (cb) => {
    const handler = (_event, data) => cb(data);
    ipcRenderer.on('conversion-version', handler);
    return () => ipcRenderer.removeListener('conversion-version', handler);
  },
  onConversionComplete: (cb) => {
    const handler = (_event, data) => cb(data);
    ipcRenderer.on('conversion-complete', handler);
    return () => ipcRenderer.removeListener('conversion-complete', handler);
  },
  onFileOpened: (cb) => {
    const handler = (_event, filePath) => cb(filePath);
    ipcRenderer.on('file-opened', handler);
    return () => ipcRenderer.removeListener('file-opened', handler);
  }
});
