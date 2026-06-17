# 🎬 Video to GIF Converter

A desktop app that converts any video (MP4, MKV, AVI, MOV, WMV, …) into three optimised GIFs — tiny, small, and medium — using FFmpeg. Ships as a native macOS `.app` with a polished UI, or runs as a CLI Ruby script.

Developed by Florian Bidabe / Photon Security ([www.photonsec.com.au](https://www.photonsec.com.au))

[![Download](https://img.shields.io/github/v/release/Photon-Security/video-to-gif?label=Download&style=for-the-badge)](https://github.com/Photon-Security/video-to-gif/releases/latest)
[![Ko-fi](https://img.shields.io/badge/Support%20on-Ko--fi-ff5e5b?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/enelass)

![Demo](assets/media/demo.gif)

## ✨ Features

- 🖱️ **Drag-and-drop** any video, or drop it onto the `.app` icon in the Dock
- ⚡ **Parallel encoding** — all three versions are produced concurrently (≈3× faster on multi-core)
- 🎭 **Three preset outputs** for different use cases:
  - **Tiny** — 640px max, 2 fps, 128 colours (smallest)
  - **Small** — 1280px max, 2 fps, 160 colours (balanced)
  - **Medium** — up to 1980px, 3 fps, 256 colours (highest quality)
- 📊 Visual side-by-side comparison with size-reduction chart
- ⏹️ **Cancel** mid-conversion — kills the whole ffmpeg tree, no orphans
- 🔒 Hardened Electron: `nodeIntegration:false`, `contextIsolation:true`, sandboxed renderer, narrow `contextBridge` IPC surface
- 🪟 **Single-instance** — relaunching focuses the existing window instead of stacking duplicates
- 💻 macOS, Linux, Windows

## 📥 Install

### macOS (recommended)

Download the latest `Video to GIF-<version>-arm64.dmg` (Apple Silicon) or `.zip` from the [Releases page](https://github.com/Photon-Security/video-to-gif/releases/latest), open it, and drag **Video to GIF.app** into `/Applications`.

> The app is **not** code-signed. The first time you open it, macOS will warn that the developer can't be verified. Right-click the app → **Open** → **Open**, or run `xattr -dr com.apple.quarantine "/Applications/Video to GIF.app"`.

### Prerequisites (installed at first launch)

- **FFmpeg** — `brew install ffmpeg` (macOS), `apt install ffmpeg` (Linux), or [ffmpeg.org](https://ffmpeg.org/download.html) (Windows)
- **Ruby** — system Ruby on macOS is fine; otherwise `brew install ruby` / `apt install ruby` / [rubyinstaller.org](https://rubyinstaller.org/)

### Build from source

```bash
git clone https://github.com/Photon-Security/video-to-gif.git
cd video-to-gif
npm install
npm start              # run in dev
npm run dist:mac       # build .dmg + .zip into dist/
```

## 🖥️ Usage

### GUI

```bash
npm start              # production-style run
npm run dev            # opens DevTools, live-reload
```

Drag a video into the drop zone or click **Select Video**. You'll see real-time progress as the three encodes run in parallel, then a comparison panel with thumbnails, size reductions, and per-version metadata.

### CLI

```bash
ruby video2gif.rb path/to/video.mp4   # one file
ruby video2gif.rb                     # every video in the cwd
```

Outputs land next to the input as `<name>-tiny.gif`, `<name>-small.gif`, `<name>-medium.gif`.

## 🛠️ Configuration

Edit `config.json` to change the per-version FFmpeg parameters:

```json
{
  "versions": {
    "tiny":   { "max_width": 640,  "fps": 2, "color_depth": 128, "dither_method": "bayer" },
    "small":  { "max_width": 1280, "fps": 2, "color_depth": 160, "dither_method": "sierra2_4a" },
    "medium": { "max_width": 1980, "fps": 3, "color_depth": 256, "dither_method": "sierra2_4a" }
  },
  "supported_video_extensions": [".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".3gp", ".mpg", ".mpeg"]
}
```

Available dither methods: `bayer`, `heckbert`, `floyd_steinberg`, `sierra2`, `sierra2_4a`.

## 📝 Example output (CLI)

```
🎬 video2gif-ruby v1.0.0
✅ FFmpeg found: /opt/homebrew/bin/ffmpeg
🎬 Converting sample.MP4 to multiple GIF versions...
  • Original size: 1848x1078

  Creating tiny version:
  • Size: 640x374
  • FPS: 2
  • Color depth: 128 colors
  • Dither method: bayer
  ✅ tiny version complete!
    • Size: 410.45 KB (86.52% reduction)

  Creating small version:
  • Size: 1280x746
  ✅ small version complete!
    • Size: 1.35 MB (54.67% reduction)

  Creating medium version:
  • Size: 1848x1078
  ✅ medium version complete!
    • Size: 3.08 MB

🎉 Conversion completed!
```

Versions encode in parallel; their stdout blocks are emitted atomically as each one finishes, so ordering reflects completion order rather than start order.

## 💖 Support

If this tool saved you time, consider buying me a coffee on Ko-fi: **[ko-fi.com/enelass](https://ko-fi.com/enelass)** ☕

It keeps the project alive and motivates new features.

## 📄 License

MIT
