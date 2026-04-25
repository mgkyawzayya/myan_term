# Bundled fonts

Drop the following TTFs into this directory before `pnpm tauri build` so they
ship with the installer. The `@font-face` declarations in `src/styles/global.css`
already reference these exact filenames; if a file is missing the renderer
gracefully falls back to system fonts (Noto Sans Myanmar / Pyidaungsu) and
prints a one-line warning at startup.

| Filename                  | Source                                                            | License            |
| ------------------------- | ----------------------------------------------------------------- | ------------------ |
| `Padauk-Regular.ttf`      | https://software.sil.org/padauk/                                  | OFL 1.1            |
| `Padauk-Bold.ttf`         | https://software.sil.org/padauk/                                  | OFL 1.1            |
| `JetBrainsMono-Regular.ttf` | https://www.jetbrains.com/lp/mono/                              | OFL 1.1            |

After dropping the files in, copy them into `src-tauri/fonts/` as well so the
Tauri bundler picks them up via the `bundle.resources` glob.
