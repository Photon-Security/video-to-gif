// All Node access is funnelled through window.api (see preload.js).
// The renderer itself runs with nodeIntegration:false + sandbox:true.
// Note: `window.api` is also auto-exposed as the global `api` identifier in
// Chromium script scope, so declaring `const api = window.api` would throw
// "Identifier 'api' has already been declared" and abort the whole script.

// DOM Elements
const dropArea = document.getElementById('drop-area');
const selectFileBtn = document.getElementById('select-file-btn');
const conversionPanel = document.getElementById('conversion-panel');
const resultPanel = document.getElementById('result-panel');
const errorPanel = document.getElementById('error-panel');
const cancelBtn = document.getElementById('cancel-btn');
const newConversionBtn = document.getElementById('new-conversion-btn');
const tryAgainBtn = document.getElementById('try-again-btn');
const videoPreview = document.getElementById('video-preview');
const fileName = document.getElementById('file-name');
const fileSize = document.getElementById('file-size');
const fileDuration = document.getElementById('file-duration');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const consoleContent = document.getElementById('console-content');
const toggleConsole = document.getElementById('toggle-console');
const errorMessage = document.getElementById('error-message');
const errorDetails = document.getElementById('error-details');

// Tab buttons
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Comparison tab elements
const originalPreview = document.getElementById('original-preview');
const originalSizeEl = document.getElementById('original-size');
const originalDimensions = document.getElementById('original-dimensions');
const originalBar = document.getElementById('original-bar');
const originalSizeChart = document.getElementById('original-size-chart');

// Tiny version elements
const tinyPreview = document.getElementById('tiny-preview');
const tinyPreviewLarge = document.getElementById('tiny-preview-large');
const tinySize = document.getElementById('tiny-size');
const tinyReduction = document.getElementById('tiny-reduction');
const tinyDimensions = document.getElementById('tiny-dimensions');
const tinyBar = document.getElementById('tiny-bar');
const tinySizeChart = document.getElementById('tiny-size-chart');
const originalSizeTiny = document.getElementById('original-size-tiny');
const tinySizeDetail = document.getElementById('tiny-size-detail');
const tinyReductionDetail = document.getElementById('tiny-reduction-detail');
const tinyDimensionsDetail = document.getElementById('tiny-dimensions-detail');
const tinyFps = document.getElementById('tiny-fps');
const tinyColorDepth = document.getElementById('tiny-color-depth');
const tinyDitherMethod = document.getElementById('tiny-dither-method');
const tinyPath = document.getElementById('tiny-path');
const openTinyBtn = document.getElementById('open-tiny-btn');
const openTinyFolderBtn = document.getElementById('open-tiny-folder-btn');

// Small version elements
const smallPreview = document.getElementById('small-preview');
const smallPreviewLarge = document.getElementById('small-preview-large');
const smallSize = document.getElementById('small-size');
const smallReduction = document.getElementById('small-reduction');
const smallDimensions = document.getElementById('small-dimensions');
const smallBar = document.getElementById('small-bar');
const smallSizeChart = document.getElementById('small-size-chart');
const originalSizeSmall = document.getElementById('original-size-small');
const smallSizeDetail = document.getElementById('small-size-detail');
const smallReductionDetail = document.getElementById('small-reduction-detail');
const smallDimensionsDetail = document.getElementById('small-dimensions-detail');
const smallFps = document.getElementById('small-fps');
const smallColorDepth = document.getElementById('small-color-depth');
const smallDitherMethod = document.getElementById('small-dither-method');
const smallPath = document.getElementById('small-path');
const openSmallBtn = document.getElementById('open-small-btn');
const openSmallFolderBtn = document.getElementById('open-small-folder-btn');

// Medium version elements
const mediumPreview = document.getElementById('medium-preview');
const mediumPreviewLarge = document.getElementById('medium-preview-large');
const mediumSize = document.getElementById('medium-size');
const mediumReduction = document.getElementById('medium-reduction');
const mediumDimensions = document.getElementById('medium-dimensions');
const mediumBar = document.getElementById('medium-bar');
const mediumSizeChart = document.getElementById('medium-size-chart');
const originalSizeMedium = document.getElementById('original-size-medium');
const mediumSizeDetail = document.getElementById('medium-size-detail');
const mediumReductionDetail = document.getElementById('medium-reduction-detail');
const mediumDimensionsDetail = document.getElementById('medium-dimensions-detail');
const mediumFps = document.getElementById('medium-fps');
const mediumColorDepth = document.getElementById('medium-color-depth');
const mediumDitherMethod = document.getElementById('medium-dither-method');
const mediumPath = document.getElementById('medium-path');
const openMediumBtn = document.getElementById('open-medium-btn');
const openMediumFolderBtn = document.getElementById('open-medium-folder-btn');

// Global variables
let currentVideoPath = null;
let currentGifVersions = {
  tiny: null,
  small: null,
  medium: null
};

// Event listeners for drag and drop
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropArea.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
  dropArea.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
  dropArea.addEventListener(eventName, unhighlight, false);
});

function highlight() {
  dropArea.classList.add('active');
}

function unhighlight() {
  dropArea.classList.remove('active');
}

// Handle file drop
dropArea.addEventListener('drop', handleDrop, false);

function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;

  if (files.length > 0) {
    const filePath = api.getPathForFile(files[0]);
    if (filePath) handleFile(filePath);
  }
}

// Handle file selection via button
selectFileBtn.addEventListener('click', async () => {
  const filePath = await api.openFileDialog();
  if (filePath) {
    handleFile(filePath);
  }
});

// Handle files opened via the OS (drag onto .app icon, "Open With…",
// or `open foo.mp4 -a "Video to GIF"`).
api.onFileOpened((filePath) => {
  if (filePath) {
    handleFile(filePath);
  }
});

// Handle the selected file
async function handleFile(filePath) {
  // Check if it's a video file
  if (!api.isSupportedVideo(filePath)) {
    const ext = api.extname(filePath);
    showError('Unsupported file type', `The file you selected (${ext}) is not a supported video format. Please select a video file.`);
    return;
  }

  currentVideoPath = filePath;

  // Show conversion panel
  dropArea.classList.add('hidden');
  conversionPanel.classList.remove('hidden');
  resultPanel.classList.add('hidden');
  errorPanel.classList.add('hidden');

  // Update file info
  fileName.textContent = api.basename(filePath);
  const stats = await api.statFile(filePath);
  if (stats && !stats.error) {
    fileSize.textContent = formatSize(stats.size);
  }

  // Load video preview (use file:// URL so spaces/non-ASCII paths work).
  videoPreview.src = await api.pathToFileURL(filePath);
  videoPreview.onloadedmetadata = () => {
    fileDuration.textContent = formatDuration(videoPreview.duration);
  };

  // Clear console
  consoleContent.textContent = '';

  // Start conversion
  startConversion(filePath);
}

// Format file size
function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

// Format duration
function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Start the conversion process
function startConversion(videoPath) {
  // Reset progress
  progressFill.style.width = '0%';
  progressText.textContent = 'Processing...';

  // Send to main process
  api.startConversion(videoPath);
}

// Listen for conversion progress
api.onConversionProgress((data) => {
  // Update console output
  consoleContent.textContent += data.data;
  consoleContent.scrollTop = consoleContent.scrollHeight;
});

// Accurate ffmpeg-derived progress (overall + per-version).
api.onConversionProgressPct((data) => {
  progressFill.style.width = `${data.overallPct}%`;
  if (data.version === 'parallel') {
    progressText.textContent = `Encoding 3 versions in parallel... ${data.overallPct}%`;
  } else {
    progressText.textContent = `Processing ${data.version} version... ${data.versionPct}% (overall ${data.overallPct}%)`;
  }
});

// Listen for version updates
api.onConversionVersion((data) => {
  progressText.textContent = `${data.version} version finished`;
});

// Listen for conversion complete
api.onConversionComplete(async (result) => {
  if (result.success) {
    // Store paths to GIF versions
    currentGifVersions = {
      tiny: result.versions.tiny.path,
      small: result.versions.small.path,
      medium: result.versions.medium.path
    };

    // Resolve all file:// URLs before swapping the panel so spaces / non-ASCII
    // characters in the original path don't break <img>/<video> sources.
    const urls = {
      original: await api.pathToFileURL(result.originalPath),
      tiny: await api.pathToFileURL(result.versions.tiny.path),
      small: await api.pathToFileURL(result.versions.small.path),
      medium: await api.pathToFileURL(result.versions.medium.path)
    };

    // Update progress
    progressFill.style.width = '100%';
    progressText.textContent = 'Conversion Complete!';

    // Show result panel
    setTimeout(() => {
      conversionPanel.classList.add('hidden');
      resultPanel.classList.remove('hidden');

      // Update original video info
      originalPreview.src = urls.original;
      originalSizeEl.textContent = formatSize(result.originalSize);
      originalSizeChart.textContent = formatSize(result.originalSize);
      originalDimensions.textContent = result.metadata.dimensions.original || 'N/A';

      // Set original size as 100% for the chart
      const maxSize = result.originalSize;

      // Update tiny version info
      tinyPreview.src = urls.tiny;
      tinyPreviewLarge.src = urls.tiny;
      tinySize.textContent = formatSize(result.versions.tiny.size);
      tinySizeDetail.textContent = formatSize(result.versions.tiny.size);
      tinyReduction.textContent = `${result.versions.tiny.reduction}%`;
      tinyReductionDetail.textContent = `${result.versions.tiny.reduction}%`;
      tinyDimensions.textContent = result.metadata.dimensions.tiny || 'N/A';
      tinyDimensionsDetail.textContent = result.metadata.dimensions.tiny || 'N/A';
      tinyFps.textContent = result.metadata.fps.tiny || 'N/A';
      tinyColorDepth.textContent = result.metadata.colorDepth.tiny ? `${result.metadata.colorDepth.tiny} colors` : 'N/A';
      tinyDitherMethod.textContent = result.metadata.ditherMethod.tiny || 'N/A';
      tinyPath.textContent = result.versions.tiny.path;
      originalSizeTiny.textContent = formatSize(result.originalSize);

      // Update small version info
      smallPreview.src = urls.small;
      smallPreviewLarge.src = urls.small;
      smallSize.textContent = formatSize(result.versions.small.size);
      smallSizeDetail.textContent = formatSize(result.versions.small.size);
      smallReduction.textContent = `${result.versions.small.reduction}%`;
      smallReductionDetail.textContent = `${result.versions.small.reduction}%`;
      smallDimensions.textContent = result.metadata.dimensions.small || 'N/A';
      smallDimensionsDetail.textContent = result.metadata.dimensions.small || 'N/A';
      smallFps.textContent = result.metadata.fps.small || 'N/A';
      smallColorDepth.textContent = result.metadata.colorDepth.small ? `${result.metadata.colorDepth.small} colors` : 'N/A';
      smallDitherMethod.textContent = result.metadata.ditherMethod.small || 'N/A';
      smallPath.textContent = result.versions.small.path;
      originalSizeSmall.textContent = formatSize(result.originalSize);

      // Update medium version info
      mediumPreview.src = urls.medium;
      mediumPreviewLarge.src = urls.medium;
      mediumSize.textContent = formatSize(result.versions.medium.size);
      mediumSizeDetail.textContent = formatSize(result.versions.medium.size);
      mediumReduction.textContent = `${result.versions.medium.reduction}%`;
      mediumReductionDetail.textContent = `${result.versions.medium.reduction}%`;
      mediumDimensions.textContent = result.metadata.dimensions.medium || 'N/A';
      mediumDimensionsDetail.textContent = result.metadata.dimensions.medium || 'N/A';
      mediumFps.textContent = result.metadata.fps.medium || 'N/A';
      mediumColorDepth.textContent = result.metadata.colorDepth.medium ? `${result.metadata.colorDepth.medium} colors` : 'N/A';
      mediumDitherMethod.textContent = result.metadata.ditherMethod.medium || 'N/A';
      mediumPath.textContent = result.versions.medium.path;
      originalSizeMedium.textContent = formatSize(result.originalSize);
      
      // Update chart bars with animation
      setTimeout(() => {
        tinyBar.style.width = `${(result.versions.tiny.size / maxSize) * 100}%`;
        smallBar.style.width = `${(result.versions.small.size / maxSize) * 100}%`;
        mediumBar.style.width = `${(result.versions.medium.size / maxSize) * 100}%`;
        tinySizeChart.textContent = formatSize(result.versions.tiny.size);
        smallSizeChart.textContent = formatSize(result.versions.small.size);
        mediumSizeChart.textContent = formatSize(result.versions.medium.size);
      }, 500);
    }, 1000);
  } else if (result.cancelled) {
    resetUI();
  } else {
    showError('Conversion Failed', result.error);
  }
});

// Show error panel
function showError(title, details) {
  dropArea.classList.add('hidden');
  conversionPanel.classList.add('hidden');
  resultPanel.classList.add('hidden');
  errorPanel.classList.remove('hidden');
  
  errorMessage.textContent = title;
  errorDetails.textContent = details;
}

// Cancel button — kills the running Ruby + ffmpeg processes.
cancelBtn.addEventListener('click', () => {
  api.cancelConversion();
  // The main process will reply with conversion-complete{cancelled:true},
  // which resets the UI via showError/resetUI handling below.
});

// New conversion button
newConversionBtn.addEventListener('click', resetUI);

// Try again button
tryAgainBtn.addEventListener('click', resetUI);

// Reset UI to initial state
function resetUI() {
  dropArea.classList.remove('hidden');
  conversionPanel.classList.add('hidden');
  resultPanel.classList.add('hidden');
  errorPanel.classList.add('hidden');
  
  // Reset video preview
  videoPreview.src = '';
  
  // Reset progress
  progressFill.style.width = '0%';
  progressText.textContent = 'Processing...';
  
  // Clear console
  consoleContent.textContent = '';
  
  currentVideoPath = null;
}

// Toggle console visibility
toggleConsole.addEventListener('click', () => {
  consoleContent.classList.toggle('hidden');
});

// Tab switching
tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    // Remove active class from all buttons and contents
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    // Add active class to clicked button and corresponding content
    button.classList.add('active');
    const tabId = button.getAttribute('data-tab');
    document.getElementById(`${tabId}-tab`).classList.add('active');
  });
});

// Open GIF buttons
openTinyBtn.addEventListener('click', () => {
  if (currentGifVersions.tiny) api.openPath(currentGifVersions.tiny);
});

openSmallBtn.addEventListener('click', () => {
  if (currentGifVersions.small) api.openPath(currentGifVersions.small);
});

openMediumBtn.addEventListener('click', () => {
  if (currentGifVersions.medium) api.openPath(currentGifVersions.medium);
});

// Open folder buttons
openTinyFolderBtn.addEventListener('click', () => {
  if (currentGifVersions.tiny) api.showItemInFolder(currentGifVersions.tiny);
});

openSmallFolderBtn.addEventListener('click', () => {
  if (currentGifVersions.small) api.showItemInFolder(currentGifVersions.small);
});

openMediumFolderBtn.addEventListener('click', () => {
  if (currentGifVersions.medium) api.showItemInFolder(currentGifVersions.medium);
});

// Initialize the UI
document.addEventListener('DOMContentLoaded', () => {
  resetUI();

  // Set initial tab
  tabButtons[0].click();

  // Route all <a data-external> links through the bridged opener so they
  // open in the user's default browser instead of trying to navigate the
  // Electron window.
  document.querySelectorAll('a[data-external]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      api.openExternal(a.href);
    });
  });
});
