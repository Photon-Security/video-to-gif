#!/usr/bin/env node

const { execSync } = require('child_process');

// Try to use chalk for colored output, but fall back to plain text if not available
let chalk;
try {
  chalk = require('chalk');
} catch (e) {
  // Create a simple mock of chalk if it's not installed yet
  chalk = {
    blue: (text) => text,
    green: (text) => text,
    red: (text) => text,
    yellow: (text) => text
  };
}

console.log(chalk.blue('Checking dependencies for Video to GIF Converter...'));

// Check for Ruby
try {
  const rubyVersion = execSync('ruby -v').toString().trim();
  console.log(chalk.green('✓ Ruby found:'), rubyVersion);
} catch (error) {
  console.log(chalk.red('✗ Ruby not found!'));
  console.log(chalk.yellow('Please install Ruby before continuing:'));
  console.log('  • macOS: brew install ruby');
  console.log('  • Ubuntu/Debian: sudo apt install ruby');
  console.log('  • Windows: Download from https://rubyinstaller.org/');
  process.exit(1);
}

// Check for FFmpeg
try {
  const ffmpegVersion = execSync('ffmpeg -version').toString().split('\n')[0].trim();
  console.log(chalk.green('✓ FFmpeg found:'), ffmpegVersion);
} catch (error) {
  console.log(chalk.red('✗ FFmpeg not found!'));
  console.log(chalk.yellow('Please install FFmpeg before continuing:'));
  console.log('  • macOS: brew install ffmpeg');
  console.log('  • Ubuntu/Debian: sudo apt install ffmpeg');
  console.log('  • Windows: Download from https://ffmpeg.org/download.html');
  process.exit(1);
}

console.log(chalk.green('All dependencies are installed! ✓'));
