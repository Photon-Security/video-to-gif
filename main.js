const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'assets', 'icons', 'app-icon.png')
  });

  mainWindow.loadFile('src/index.html');

  // Open DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
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
  const scriptPath = path.join(__dirname, 'video2gif.rb');

  // Run the Ruby script to convert the video
  const rubyProcess = spawn('ruby', [scriptPath, videoPath], {
    cwd: __dirname
  });
  
  let stdoutData = '';
  let stderrData = '';
  
  rubyProcess.stdout.on('data', (data) => {
    const dataStr = data.toString();
    stdoutData += dataStr;
    
    // Check if the output indicates which version is being encoded
    const versionMatch = dataStr.match(/Creating (tiny|small|medium) version:/);
    if (versionMatch) {
      const currentVersion = versionMatch[1];
      event.sender.send('conversion-version', { version: currentVersion });
    }
    
    event.sender.send('conversion-progress', { type: 'stdout', data: dataStr });
  });
  
  rubyProcess.stderr.on('data', (data) => {
    stderrData += data.toString();
    event.sender.send('conversion-progress', { type: 'stderr', data: data.toString() });
  });

  rubyProcess.on('error', (error) => {
    event.sender.send('conversion-complete', {
      success: false,
      error: `Failed to start Ruby conversion process: ${error.message}`
    });
  });
  
  rubyProcess.on('close', (code) => {
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
