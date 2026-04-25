# MyanTerm

Cross-platform GPU-accelerated terminal emulator with first-class Myanmar
(Burmese) text rendering. Built on Tauri 2 + Rust + xterm.js.

> The killer feature: Myanmar renders correctly **and** Claude Code, vim, tmux,
> lazygit work flawlessly. No other terminal currently delivers that
> combination.

See [PRD.md](docs/PRD.md), [CLAUDE.md](CLAUDE.md), and [TASKS.md](TASKS.md) for
the full product spec, architecture, and execution plan.

---

## Quick start

```bash
# Prerequisites
#   - Rust stable (rustup, edition 2021)
#   - Node 20+ + pnpm 9+
#   - Tauri 2 platform prereqs: https://v2.tauri.app/start/prerequisites/

pnpm install
pnpm tauri dev          # dev build with hot reload
pnpm tauri build        # signed release installer
```

`pnpm dev` alone runs the React frontend in a browser preview without a PTY —
useful for visual debugging.

## Layout

```
src/                       # React + xterm.js frontend
  components/terminal/     # xterm.js wrapper, Myanmar overlay, joiner, cache
  components/tabs/         # tab bar
  components/command-palette/
  components/settings/
  components/profile-manager/
  lib/                     # myanmar.ts, wcwidth.ts, themes, i18n, tauri IPC
  types/                   # shared TS types
src-tauri/                 # Rust backend
  src/pty/                 # portable-pty manager
  src/profiles/            # SSH profile JSON store + ssh argv builder
  src/settings/            # settings JSON store
  src/commands.rs          # Tauri command handlers
tests/
  lib/                     # myanmar/wcwidth unit tests
  components/              # joiner / shape-cache unit tests
  perf/                    # throughput perf harness
public/fonts/              # Padauk + JetBrains Mono drop-in
```

## Scripts

| Command            | Purpose                                                   |
| ------------------ | --------------------------------------------------------- |
| `pnpm dev`         | Vite dev server (browser preview, no PTY)                 |
| `pnpm tauri:dev`   | Full Tauri dev with hot reload                            |
| `pnpm tauri:build` | Signed release installer for the current platform         |
| `pnpm test`        | Vitest unit tests (Myanmar detection, wcwidth, joiner …)  |
| `pnpm test:perf`   | Perf harness for Myanmar throughput                       |
| `pnpm typecheck`   | `tsc --noEmit`                                            |
| `pnpm lint`        | `eslint . --max-warnings 0`                               |
| `pnpm format`      | Prettier write                                            |

Rust quality gates:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo test  --manifest-path src-tauri/Cargo.toml
```

## Myanmar rendering contract

- Myanmar codepoints: **U+1000–U+109F**, **U+AA60–U+AA7F**, **U+A9E0–U+A9FF**.
- Grapheme clustering uses `Intl.Segmenter` (UAX #29) — never hand-rolled.
- Cell width per CLAUDE.md: `myanmarCellWidth(cluster)` returns 2 for any
  cluster containing a Myanmar codepoint, otherwise sums standard wcwidth.
- Rendering tier: WebGL handles ASCII/Latin/CJK; a DOM overlay
  (`MyanmarOverlay.tsx`) handles Myanmar runs only, synced via
  `requestAnimationFrame`.
- Cluster shape cache: LRU 5000 entries keyed by `cluster|font|size|fg|bg`.

If a change makes Myanmar look prettier but breaks vim cursor positioning,
**REJECT IT** (see CLAUDE.md §2).

## Bundled fonts

Drop the following into `public/fonts/` before `pnpm tauri build` so they ship
in the installer (also copy them to `src-tauri/fonts/`):

| Filename                     | Source                                            | License |
| ---------------------------- | ------------------------------------------------- | ------- |
| `Padauk-Regular.ttf`         | https://software.sil.org/padauk/                  | OFL 1.1 |
| `Padauk-Bold.ttf`            | https://software.sil.org/padauk/                  | OFL 1.1 |
| `JetBrainsMono-Regular.ttf`  | https://www.jetbrains.com/lp/mono/                | OFL 1.1 |

Without these the renderer gracefully falls back to system fonts (Noto Sans
Myanmar, Pyidaungsu).

## CI

Two GitHub Actions workflows live under `.github/workflows/`:

- **`ci.yml`** — runs on every push and pull request. Contains three jobs:
  `lint-and-test-frontend` (typecheck, ESLint, Vitest, Vite build) and
  `lint-and-test-rust` (`cargo fmt --check`, `cargo clippy -D warnings`,
  `cargo test`) on `ubuntu-22.04`, plus `build-tauri` on macOS, Linux, and
  Windows that runs `pnpm tauri build --no-bundle` and uploads the resulting
  binaries as artifacts.
- **`release.yml`** — runs on tag pushes matching `v*`. Builds and publishes a
  draft GitHub release across macOS, Linux, and Windows via
  [`tauri-apps/tauri-action`](https://github.com/tauri-apps/tauri-action),
  including `latest.json` for the updater plugin. Apple notarization and
  Windows code signing are wired in through optional secrets — when they are
  unset the build runs unsigned but still completes.

`.github/dependabot.yml` keeps npm, Cargo, and GitHub Actions versions fresh
weekly. See the repository's **Actions** tab for live status.

## License

MIT OR Apache-2.0 (dual-licensed) for the source tree. Bundled fonts retain
their original OFL 1.1 licenses.
