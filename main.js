const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const fs = require('fs');

const SUPPORTED_VIDEO_EXTS = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.3gp', '.mpg', '.mpeg'];
const isVideoPath = (p) => typeof p === 'string' && SUPPORTED_VIDEO_EXTS.includes(path.extname(p).toLowerCase());
const findVideoArg = (argv) => (argv || []).find(isVideoPath) || null;

// Ensure only one instance of the app runs. Without this, double-clicking the
// .app bundle or dragging a video onto it spawns a fresh process and a new
// window every time.
if (!app.requestSingleInstanceLock()) {
  app.quit();
  return;
}

// Enable live reload for development
if (process.argv.includes('--dev')) {
  try {
    require('electron-reload')(__dirname, {
      electron: path.join(__dirname, 'node_modules', '.bin', 'electron')
    });
  } catch (err) {
    console.log('Error setting up electron-reload:', err);
  }
}

let mainWindow;
// Holds a file path the OS asked us to open before the window was ready.
let pendingFileToOpen = findVideoArg(process.argv);
// Currently-running Ruby conversion process, if any. Tracked so the renderer
// can cancel it via IPC and so we can reject overlapping starts.
let activeConversion = null;

function deliverFile(filePath) {
  if (!filePath) return;
  if (mainWindow && !mainWindow.webContents.isLoading()) {
    mainWindow.webContents.send('file-opened', filePath);
  } else {
    pendingFileToOpen = filePath;
  }
}

function focusMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icons', 'app-icon.png')
  });

  mainWindow.loadFile('src/index.html');

  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingFileToOpen) {
      mainWindow.webContents.send('file-opened', pendingFileToOpen);
      pendingFileToOpen = null;
    }
  });

  // Open DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// macOS: fired when the user drags a video onto the .app icon or uses
// "Open With…". Must be registered before `ready`.
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  deliverFile(filePath);
  focusMainWindow();
});

// Fires in the original (primary) instance when the user launches a second
// copy of the app (e.g. by double-clicking the .app again or via `open` with
// a file argument on Windows/Linux).
app.on('second-instance', (event, argv) => {
  focusMainWindow();
  deliverFile(findVideoArg(argv));
});

app.on('ready', () => {
  // macOS-only: BrowserWindow({icon}) is ignored on macOS — the dock icon
  // normally comes from the .app bundle's Info.plist. In unpackaged dev mode
  // we have no bundle, so set it explicitly via app.dock.
  if (process.platform === 'darwin' && app.dock) {
    try {
      app.dock.setIcon(path.join(__dirname, 'assets', 'icons', 'app-icon.png'));
    } catch (err) { /* non-fatal */ }
  }
  createWindow();
});

app.on('window-all-closed', () => {
  // Make sure no Ruby/ffmpeg child outlives the UI.
  if (activeConversion) {
    activeConversion.cancelled = true;
    const pid = activeConversion.process.pid;
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(pid), '/f', '/t']);
      } else {
        process.kill(-pid, 'SIGTERM');
      }
    } catch (err) { /* already gone */ }
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle video to GIF conversion
ipcMain.on('convert-video', (event, videoPath) => {
  if (activeConversion) {
    event.sender.send('conversion-complete', {
      success: false,
      error: 'A conversion is already in progress. Cancel it before starting another.'
    });
    return;
  }

  const scriptPath = app.isPackaged
    ? path.join(process.resourcesPath, 'video2gif.rb')
    : path.join(__dirname, 'video2gif.rb');
  const scriptCwd = app.isPackaged ? process.resourcesPath : __dirname;

  // When launched from Finder/Dock, macOS gives the .app a minimal PATH
  // (/usr/bin:/bin:/usr/sbin:/sbin). Homebrew installs (ffmpeg, ruby, etc.)
  // live in /opt/homebrew/bin (Apple Silicon) or /usr/local/bin (Intel) and
  // aren't visible there — so `which ffmpeg` in the Ruby script fails.
  // Prepend the common Homebrew prefixes so the child process can find them.
  const childEnv = { ...process.env };
  if (process.platform === 'darwin') {
    const extra = ['/opt/homebrew/bin', '/opt/homebrew/sbin', '/usr/local/bin', '/usr/local/sbin'];
    const current = (childEnv.PATH || '').split(':').filter(Boolean);
    childEnv.PATH = [...extra, ...current].filter((p, i, a) => a.indexOf(p) === i).join(':');

    // Finder/Dock launches can also omit a UTF-8 locale. Ruby then marks
    // non-ASCII argv paths as ASCII-8BIT, which breaks interpolation with
    // the converter's UTF-8 status output.
    const hasUtf8Locale = (value) => /utf-?8/i.test(value || '');
    if (!hasUtf8Locale(childEnv.LANG)) childEnv.LANG = 'en_US.UTF-8';
    if (!hasUtf8Locale(childEnv.LC_CTYPE)) childEnv.LC_CTYPE = childEnv.LANG;
    if (childEnv.LC_ALL && !hasUtf8Locale(childEnv.LC_ALL)) childEnv.LC_ALL = childEnv.LANG;
  }

  // `detached: true` puts Ruby in its own process group. ffmpeg children
  // inherit that group, so a single `process.kill(-pid)` on cancel takes
  // the whole tree down instead of orphaning ffmpeg.
  const rubyProcess = spawn('ruby', [scriptPath, videoPath], {
    cwd: scriptCwd,
    env: childEnv,
    detached: process.platform !== 'win32'
  });

  activeConversion = { process: rubyProcess, cancelled: false };

  let stdoutData = '';
  let stderrData = '';
  // The Ruby script encodes the three versions in parallel and prints each
  // version's block (header + result) atomically on completion. So we just
  // count completion markers for overall progress.
  const VERSIONS = ['tiny', 'small', 'medium'];
  let completedCount = 0;

  rubyProcess.stdout.on('data', (data) => {
    const dataStr = data.toString();
    stdoutData += dataStr;

    // Announce each version as soon as Ruby flushes its block. Ordering
    // depends on which thread finishes first; the UI just shows the latest.
    const versionStartMatch = dataStr.match(/Creating (tiny|small|medium) version:/);
    if (versionStartMatch) {
      event.sender.send('conversion-version', { version: versionStartMatch[1] });
    }

    // Each successful version dump ends with "✅ X version complete!".
    const completions = dataStr.match(/✅ (?:tiny|small|medium) version complete!/g);
    if (completions) {
      completedCount += completions.length;
      const overallPct = Math.round((completedCount / VERSIONS.length) * 100);
      event.sender.send('conversion-progress-pct', {
        version: 'parallel',
        versionPct: overallPct,
        overallPct
      });
    }

    event.sender.send('conversion-progress', { type: 'stdout', data: dataStr });
  });

  rubyProcess.stderr.on('data', (data) => {
    const dataStr = data.toString();
    stderrData += dataStr;
    event.sender.send('conversion-progress', { type: 'stderr', data: dataStr });
    // Per-version ffmpeg "time=" parsing is intentionally dropped here:
    // three ffmpegs now run concurrently and we can't reliably attribute
    // a given progress line to a specific version. Overall progress is
    // driven by completion-marker counting on stdout instead.
  });

  rubyProcess.on('error', (error) => {
    activeConversion = null;
    event.sender.send('conversion-complete', {
      success: false,
      error: `Failed to start Ruby conversion process: ${error.message}`
    });
  });

  rubyProcess.on('close', (code, signal) => {
    const wasCancelled = activeConversion && activeConversion.cancelled;
    activeConversion = null;

    if (wasCancelled) {
      event.sender.send('conversion-complete', {
        success: false,
        cancelled: true,
        error: 'Conversion cancelled.'
      });
      return;
    }

    if (code === 0) {
      // Get metadata about the original video and the GIF versions
      const originalSize = fs.statSync(videoPath).size;
      
      // Get paths for the different GIF versions
      const tinyGifPath = videoPath.replace(/\.[^.]+$/, '-tiny.gif');
      const smallGifPath = videoPath.replace(/\.[^.]+$/, '-small.gif');
      const mediumGifPath = videoPath.replace(/\.[^.]+$/, '-medium.gif');
      
      // Get sizes for each version
      const tinyGifSize = fs.existsSync(tinyGifPath) ? fs.statSync(tinyGifPath).size : 0;
      const smallGifSize = fs.existsSync(smallGifPath) ? fs.statSync(smallGifPath).size : 0;
      const mediumGifSize = fs.existsSync(mediumGifPath) ? fs.statSync(mediumGifPath).size : 0;
      
      // Extract metadata from the output
      const metadata = extractMetadata(stdoutData);
      
      // Calculate size reduction percentages
      const tinySizeReduction = originalSize > 0 ? ((originalSize - tinyGifSize) / originalSize * 100).toFixed(2) : 0;
      const smallSizeReduction = originalSize > 0 ? ((originalSize - smallGifSize) / originalSize * 100).toFixed(2) : 0;
      const mediumSizeReduction = originalSize > 0 ? ((originalSize - mediumGifSize) / originalSize * 100).toFixed(2) : 0;
      
      event.sender.send('conversion-complete', {
        success: true,
        originalPath: videoPath,
        versions: {
          tiny: {
            path: tinyGifPath,
            size: tinyGifSize,
            reduction: tinySizeReduction
          },
          small: {
            path: smallGifPath,
            size: smallGifSize,
            reduction: smallSizeReduction
          },
          medium: {
            path: mediumGifPath,
            size: mediumGifSize,
            reduction: mediumSizeReduction
          }
        },
        originalSize,
        metadata
      });
    } else {
      event.sender.send('conversion-complete', {
        success: false,
        error: sanitizeTerminalOutput(stderrData || stdoutData) || 'Conversion failed with code ' + code
      });
    }
  });
});

// Cancel an in-flight conversion. Kills Ruby and its ffmpeg children.
ipcMain.on('cancel-conversion', () => {
  if (!activeConversion) return;
  activeConversion.cancelled = true;
  const child = activeConversion.process;
  const pid = child.pid;

  try {
    if (process.platform === 'win32') {
      // On Windows, /T kills the whole tree.
      spawn('taskkill', ['/pid', String(pid), '/f', '/t']);
    } else {
      // We spawned Ruby with detached:true, so -pid targets the process group.
      process.kill(-pid, 'SIGTERM');
    }
  } catch (err) {
    // Process may have already exited between cancel click and kill.
  }

  // Escalate to SIGKILL if the tree didn't exit within 2s.
  setTimeout(() => {
    if (!activeConversion) return;
    try {
      if (process.platform !== 'win32') process.kill(-pid, 'SIGKILL');
    } catch (err) { /* already gone */ }
  }, 2000);
});

// Open file dialog to select a video
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Videos', extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', '3gp', 'mpg', 'mpeg'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Minimal filesystem helpers exposed to the sandboxed renderer.
ipcMain.handle('stat-file', async (_event, filePath) => {
  try {
    const stats = await fs.promises.stat(filePath);
    return { size: stats.size, mtimeMs: stats.mtimeMs };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('open-path', async (_event, p) => shell.openPath(p));
ipcMain.handle('show-in-folder', async (_event, p) => { shell.showItemInFolder(p); });
ipcMain.handle('path-to-file-url', async (_event, p) => pathToFileURL(p).href);

// Open an external URL — restricted to http/https so a compromised renderer
// can't ask main to open `file://` paths or custom-scheme handlers.
ipcMain.handle('open-external', async (_event, url) => {
  if (typeof url !== 'string') return false;
  if (!/^https?:\/\//i.test(url)) return false;
  await shell.openExternal(url);
  return true;
});

// Extract metadata from the Ruby script output
function extractMetadata(output) {
  const metadata = {
    dimensions: {},
    fps: {},
    colorDepth: {},
    ditherMethod: {}
  };
  
  // Extract dimensions for tiny version
  const tinyDimensionsMatch = output.match(/Creating tiny version:[\s\S]*?• Size: (\d+x\d+)/);
  if (tinyDimensionsMatch) {
    metadata.dimensions.tiny = tinyDimensionsMatch[1];
  }
  
  // Extract dimensions for small version
  const smallDimensionsMatch = output.match(/Creating small version:[\s\S]*?• Size: (\d+x\d+)/);
  if (smallDimensionsMatch) {
    metadata.dimensions.small = smallDimensionsMatch[1];
  }
  
  // Extract dimensions for medium version
  const mediumDimensionsMatch = output.match(/Creating medium version:[\s\S]*?• Size: (\d+x\d+)/);
  if (mediumDimensionsMatch) {
    metadata.dimensions.medium = mediumDimensionsMatch[1];
  }
  
  // Extract FPS for each version
  const tinyFpsMatch = output.match(/Creating tiny version:[\s\S]*?• FPS: (\d+)/);
  const smallFpsMatch = output.match(/Creating small version:[\s\S]*?• FPS: (\d+)/);
  const mediumFpsMatch = output.match(/Creating medium version:[\s\S]*?• FPS: (\d+)/);
  
  if (tinyFpsMatch) metadata.fps.tiny = tinyFpsMatch[1];
  if (smallFpsMatch) metadata.fps.small = smallFpsMatch[1];
  if (mediumFpsMatch) metadata.fps.medium = mediumFpsMatch[1];
  
  // Extract color depth for each version
  const tinyColorDepthMatch = output.match(/Creating tiny version:[\s\S]*?• Color depth: (\d+) colors/);
  const smallColorDepthMatch = output.match(/Creating small version:[\s\S]*?• Color depth: (\d+) colors/);
  const mediumColorDepthMatch = output.match(/Creating medium version:[\s\S]*?• Color depth: (\d+) colors/);
  
  if (tinyColorDepthMatch) metadata.colorDepth.tiny = tinyColorDepthMatch[1];
  if (smallColorDepthMatch) metadata.colorDepth.small = smallColorDepthMatch[1];
  if (mediumColorDepthMatch) metadata.colorDepth.medium = mediumColorDepthMatch[1];
  
  // Extract dither method for each version
  const tinyDitherMethodMatch = output.match(/Creating tiny version:[\s\S]*?• Dither method: ([a-z0-9_]+)/);
  const smallDitherMethodMatch = output.match(/Creating small version:[\s\S]*?• Dither method: ([a-z0-9_]+)/);
  const mediumDitherMethodMatch = output.match(/Creating medium version:[\s\S]*?• Dither method: ([a-z0-9_]+)/);
  
  if (tinyDitherMethodMatch) metadata.ditherMethod.tiny = tinyDitherMethodMatch[1];
  if (smallDitherMethodMatch) metadata.ditherMethod.small = smallDitherMethodMatch[1];
  if (mediumDitherMethodMatch) metadata.ditherMethod.medium = mediumDitherMethodMatch[1];
  
  // Extract original dimensions
  const originalDimensionsMatch = output.match(/• Original size: (\d+x\d+)/);
  if (originalDimensionsMatch) {
    metadata.dimensions.original = originalDimensionsMatch[1];
  }
  
  // Extract author information
  const authorMatch = output.match(/Developed by ([^]+?)$/m);
  if (authorMatch) {
    metadata.author = authorMatch[1].trim();
  }
  
  return metadata;
}

function sanitizeTerminalOutput(output) {
  return output.replace(/\u001b\[[0-9;]*m/g, '').trim();
}
