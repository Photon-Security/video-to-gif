# Changelog

## v1.1.1 - 2026-06-30

### Fixed

- Prevented Ruby `Encoding::CompatibilityError` crashes when converting videos with non-ASCII filenames from the packaged macOS app.
- Ensured the Electron app launches the Ruby converter with a UTF-8 locale on macOS Finder/Dock launches.
- Normalized converter status output so binary-encoded filesystem paths do not break progress messages.
