# CLI & Developer Guide

Everything in this file is for people who want to run the converter from the command line, build the app from source, or change the output presets. End users should stick with the DMG — see the main [README.md](README.md).

## Run the Ruby script directly

The desktop app is a UI wrapper around `video2gif.rb`. You can call it yourself:

```bash
ruby video2gif.rb path/to/video.mp4    # convert a single file
ruby video2gif.rb                      # convert every video in the current directory
```

Outputs land next to the input as `<name>-tiny.gif`, `<name>-small.gif`, `<name>-medium.gif`.

### Prerequisites

- **Ruby** — system Ruby on macOS is fine; otherwise `brew install ruby`, `apt install ruby`, or [rubyinstaller.org](https://rubyinstaller.org/)
- **FFmpeg** — `brew install ffmpeg`, `apt install ffmpeg`, or [ffmpeg.org/download.html](https://ffmpeg.org/download.html)

### Example output

```
video2gif-ruby v1.1.0
FFmpeg found: /opt/homebrew/bin/ffmpeg
Converting sample.MP4 to multiple GIF versions...
  Original size: 1848x1078

  Creating tiny version:
  Size: 640x374
  FPS: 2
  Color depth: 128 colors
  Dither method: bayer
  tiny version complete!
    Size: 410.45 KB (86.52% reduction)

  Creating small version:
  Size: 1280x746
  small version complete!
    Size: 1.35 MB (54.67% reduction)

  Creating medium version:
  Size: 1848x1078
  medium version complete!
    Size: 3.08 MB
```

The three versions encode in parallel; each stdout block is emitted atomically when its thread finishes, so the order reflects completion time rather than start time.

## Configuration

Edit `config.json` to change per-version FFmpeg parameters:

```json
{
  "versions": {
    "tiny":   { "max_width": 640,  "fps": 2, "color_depth": 128, "dither_method": "bayer" },
    "small":  { "max_width": 1280, "fps": 2, "color_depth": 160, "dither_method": "sierra2_4a" },
    "medium": { "max_width": 1980, "fps": 3, "color_depth": 256, "dither_method": "sierra2_4a" }
  },
  "supported_video_extensions": [
    ".mp4", ".mkv", ".avi", ".mov", ".wmv",
    ".flv", ".webm", ".m4v", ".3gp", ".mpg", ".mpeg"
  ]
}
```

Available dither methods: `bayer`, `heckbert`, `floyd_steinberg`, `sierra2`, `sierra2_4a`.

## Build the desktop app from source

```bash
git clone https://github.com/Photon-Security/video-to-gif.git
cd video-to-gif
npm install
npm start              # run in dev mode
npm run dev            # same, but with DevTools and live reload
npm run dist:mac       # produce the DMGs in dist/
```

The build pipeline is electron-builder with a `mac.identity: null` override and an `afterPack` hook (`build/after-pack.js`) that runs `codesign --force --deep --sign -` so the bundle has a valid sealed-resource manifest. Without this Gatekeeper shows the misleading *"app is damaged"* error instead of the standard *"developer cannot be verified"* prompt.

### Known build quirk

electron-builder's DMG step occasionally fails on `hdiutil detach` cleanup on macOS Sequoia (the volume gets held by Spotlight or another process). If that happens, the signed `.app` bundles in `dist/mac-arm64/` and `dist/mac/` are still good — build the DMGs manually:

```bash
for arch in mac-arm64:arm64 mac:x64; do
  src="${arch%:*}"; tag="${arch#*:}"
  STAGE=$(mktemp -d)
  cp -R "dist/$src/Video to GIF.app" "$STAGE/"
  ln -s /Applications "$STAGE/Applications"
  hdiutil create -volname "Video to GIF" -srcfolder "$STAGE" \
    -ov -format UDZO "dist/Video to GIF-arm64.dmg"
  rm -rf "$STAGE"
done
```

## Project layout

```
main.js                 Electron main process; spawns Ruby, manages IPC and lifecycle
preload.js              contextBridge surface exposed to the renderer
src/index.html          UI layout
src/css/styles.css      Styling
src/js/renderer.js      UI logic; talks to main via window.api
video2gif.rb            The actual converter; runs ffmpeg in three parallel threads
config.json             Conversion presets
build/after-pack.js     electron-builder hook that ad-hoc signs the bundle
build/strip-icon-bg.py  Helper that floods white backgrounds out of source PNGs
assets/icons/           App icon (PNG + ICNS)
```

## How it works

The Electron app is mostly orchestration. When you drop a video, the main process spawns `ruby video2gif.rb <path>` and parses its stdout for phase markers (`Creating tiny version:` / `tiny version complete!`) to drive the progress bar.

`video2gif.rb` runs three threads — one per output size. Each thread runs two ffmpeg passes (palette generation + paletted encode) using argv-form `Open3.capture3` so filenames can't be misinterpreted as shell metacharacters. Stdout is mutex'd per version so each block is emitted atomically, which lets the renderer's line-based parser stay correct under thread races.

Cancel works by spawning Ruby with `detached: true`, putting it in its own process group. A single `kill -TERM` on the negative pid takes down Ruby and every ffmpeg child it spawned, with a SIGKILL escalation after 2 seconds if anything is still alive.

The renderer runs sandboxed (`nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`) and can only talk to main through a narrow `contextBridge`-exposed `window.api`.
