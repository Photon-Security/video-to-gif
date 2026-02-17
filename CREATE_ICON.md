# How to Add a Custom Icon to Your App

The app bundle is ready, but you need to add a custom icon. Here's how:

## Quick Method: Using an existing ICNS file

If you already have an `.icns` file:
```bash
cp your-icon.icns "Video to GIF.app/Contents/Resources/AppIcon.icns"
```

## Creating an ICNS from a PNG

1. Start with a 1024x1024 PNG image (e.g., `assets/icons/app-icon.png`)

2. Create the iconset directory structure:
```bash
mkdir AppIcon.iconset
```

3. Generate all required sizes:
```bash
sips -z 16 16     assets/icons/app-icon.png --out AppIcon.iconset/icon_16x16.png
sips -z 32 32     assets/icons/app-icon.png --out AppIcon.iconset/icon_16x16@2x.png
sips -z 32 32     assets/icons/app-icon.png --out AppIcon.iconset/icon_32x32.png
sips -z 64 64     assets/icons/app-icon.png --out AppIcon.iconset/icon_32x32@2x.png
sips -z 128 128   assets/icons/app-icon.png --out AppIcon.iconset/icon_128x128.png
sips -z 256 256   assets/icons/app-icon.png --out AppIcon.iconset/icon_128x128@2x.png
sips -z 256 256   assets/icons/app-icon.png --out AppIcon.iconset/icon_256x256.png
sips -z 512 512   assets/icons/app-icon.png --out AppIcon.iconset/icon_256x256@2x.png
sips -z 512 512   assets/icons/app-icon.png --out AppIcon.iconset/icon_512x512.png
sips -z 1024 1024 assets/icons/app-icon.png --out AppIcon.iconset/icon_512x512@2x.png
```

4. Convert to ICNS:
```bash
iconutil -c icns AppIcon.iconset -o "Video to GIF.app/Contents/Resources/AppIcon.icns"
```

5. Clean up:
```bash
rm -rf AppIcon.iconset
```

## Using the App

Once the icon is added (or even without it):

1. The app is located at: `Video to GIF.app`
2. You can drag it to your Dock
3. You can move it to `/Applications` if you want
4. Double-click or click from Dock to launch

Note: `Video to GIF.app` is a build artifact. This repo does not commit `*.app/` bundles.
