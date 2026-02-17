# Repository Guidelines

## Project Structure & Module Organization
- `main.js`: Electron main process; spawns the Ruby converter and relays progress via IPC.
- `src/`: UI layer — `index.html`, `js/renderer.js`, `css/styles.css`.
- `video2gif.rb`: Ruby script using FFmpeg to generate `-tiny.gif`, `-small.gif`, `-medium.gif`.
- `config.json`: Conversion presets (`versions` block or legacy keys).
- `assets/`: Icons and UI assets (e.g., `upload-icon.svg`).
- `test_video2gif.rb`: Basic Ruby test harness.
- Samples: `assets/media/sample.MP4`, `assets/media/demo.gif`.

## Build, Test, and Development Commands
- `npm install`: Installs dependencies. Runs `check-dependencies.js` to verify Ruby/FFmpeg; sets `video2gif.rb` executable.
- `npm run dev`: Launches Electron with live reload and DevTools.
- `npm start`: Launches Electron app normally.
- `ruby video2gif.rb <path/to/video>`: CLI conversion; emits three GIF variants.
- `ruby test_video2gif.rb`: Executes the Ruby test harness.

## Coding Style & Naming Conventions
- JavaScript: 2-space indent, semicolons, `camelCase` for variables/functions.
- Ruby: 2-space indent, `snake_case` for methods/variables, constants like `AUTHOR`.
- Filenames: lowercase, concise; keep output suffixes `-tiny.gif`, `-small.gif`, `-medium.gif`.
- Keep UI IDs/classes consistent with `src/index.html` and `renderer.js`.

## Testing Guidelines
- Ruby tests: use `test_video2gif.rb` for smoke checks; add focused scripts under root with clear names (e.g., `test_*.rb`).
- No JS test runner is configured; validate UI via `npm run dev` and manual flows.
- Ensure FFmpeg and Ruby are installed (`node check-dependencies.js`).

## Commit & Pull Request Guidelines
- Commits: short, imperative subject (e.g., "Add FFmpeg dimension parsing"), include scope and rationale in body.
- PRs: clear description, linked issues, reproduction steps, before/after screenshots for UI changes, and platform notes if FFmpeg behavior differs.

## Security & Configuration Tips
- Do not commit large media; use small samples. Add paths to `.gitignore` when working with outputs.
- Document config changes in `config.json` with examples; prefer the `versions` schema.
