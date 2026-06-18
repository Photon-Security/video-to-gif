<p align="center">
  <img src="assets/Logo.png" alt="Video to GIF logo" width="260" />
</p>


# Video to GIF Converter

Convert any video into three optimised GIFs — small, medium, and large — without leaving your Mac. A native `.app` with drag-and-drop, parallel encoding, and a side-by-side comparison of every output.

Developed by Florian Bidabe / Photon Security ([www.photonsec.com.au](https://www.photonsec.com.au))

[![Download](https://img.shields.io/github/v/release/Photon-Security/video-to-gif?label=Download&style=for-the-badge)](https://github.com/Photon-Security/video-to-gif/releases/latest)
[![Ko-fi](https://img.shields.io/badge/Support%20on-Ko--fi-ff5e5b?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/enelass)

![Demo](assets/media/demo.gif)

## Install

1. Download the latest DMG from the [Releases page](https://github.com/Photon-Security/video-to-gif/releases/latest):
   - `Video to GIF-<version>-arm64.dmg` for Apple Silicon
   - `Video to GIF-<version>-x64.dmg` for Intel
2. Open the DMG and drag **Video to GIF.app** into your `/Applications` folder.
3. Install [FFmpeg](https://ffmpeg.org/download.html) if you don't already have it. On macOS the easiest way is:
   ```bash
   brew install ffmpeg
   ```

### First launch — allow the app

The app is signed but not notarized with Apple, so macOS will block it the first time. You'll see:

> *"Video to GIF cannot be opened because the developer cannot be verified."*

Click **Cancel**, then open **System Settings → Privacy & Security**, scroll to the bottom, and click **Open Anyway** next to the Video to GIF entry. After that it launches normally.

If you'd rather skip the dialog entirely, run this once in Terminal:

```bash
xattr -dr com.apple.quarantine "/Applications/Video to GIF.app"
```

## Use

Drag a video onto the window (or click **Select Video**). The app produces three GIFs side by side and shows the size reduction for each. Open the one you want or reveal it in Finder with the buttons under the preview.

## Features

- Drag-and-drop any common video format (MP4, MOV, MKV, AVI, WebM, …)
- Three output sizes generated in parallel — small, medium, large
- Side-by-side preview with file size and reduction percentage
- Cancel at any time during conversion

## Support

If this tool saved you time, consider buying me a coffee on Ko-fi: **[ko-fi.com/enelass](https://ko-fi.com/enelass)**

## Developers

Looking to run it from the command line, build from source, or change conversion presets? See [docs/CLI_README.md](docs/CLI_README.md).

## License

MIT

---

<p align="center">
  <img src="assets/Banner.png" alt="Photon Security banner" />
</p>
