# MyanTerm bundled fonts (Tauri resources)

The Tauri bundler ships everything in this directory inside the installer.
Drop the same `Padauk-Regular.ttf`, `Padauk-Bold.ttf`, and `JetBrainsMono-Regular.ttf`
files you placed in `/public/fonts/` here as well so they end up in the
release installer.

If this directory is empty at build time the renderer falls back to the
webview's system font shaping (Noto Sans Myanmar / Pyidaungsu on most
distros) — Myanmar text still shapes correctly, it just won't be uniform
across machines.
