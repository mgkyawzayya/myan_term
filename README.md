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

## Shortcuts

`⌘` is used on macOS; on Linux/Windows substitute `Ctrl`. The Option/Alt key is
written `⌥`.

### Tabs

| Shortcut    | Action                                  |
| ----------- | --------------------------------------- |
| `⌘T`        | New tab                                 |
| `⌘W`        | Close focused pane (or tab if 1 pane)   |
| `⌘⇧]`       | Next tab                                |
| `⌘⇧[`       | Previous tab                            |
| `⌘⇧P`       | Open command palette                    |
| `⌘,`        | Open settings                           |

### Panes

| Shortcut    | Action                                                        |
| ----------- | ------------------------------------------------------------- |
| `⌘D`        | Split horizontally (side-by-side, vertical divider)           |
| `⌘⇧D`       | Split vertically (stacked, horizontal divider)                |
| `⌘⌥←/→/↑/↓` | Focus pane in the given direction                             |
| `⌘W`        | Close the focused pane (collapses parent split if needed)     |

Drag the divider between two panes to resize them. The PTY behind each pane is
sent a SIGWINCH automatically so apps like `vim` and `tmux` reflow correctly.

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

## Releases & auto-update

MyanTerm uses [`tauri-plugin-updater`](https://v2.tauri.app/plugin/updater/)
wired to a GitHub Releases JSON feed. The updater endpoint is configured in
`src-tauri/tauri.conf.json` to:

```
https://github.com/mgkyawzayya/myan_term/releases/latest/download/latest.json
```

### One-time signing-key setup (per release maintainer)

Tauri's updater verifies installer signatures with an Ed25519 keypair. Generate
one *once* and keep the private key safe (1Password, age, etc.):

```bash
mkdir -p ~/.tauri
pnpm tauri signer generate -- -w ~/.tauri/myanterm.key
```

Copy the resulting **public key** into `plugins.updater.pubkey` in
`src-tauri/tauri.conf.json` (it currently ships empty so devs cannot
accidentally release an unsignable build — the build will refuse). Keep the
**private key** out of git.

### Building a signed release locally

Export the private key and password before building so `tauri build` signs the
artefacts and emits a `*.sig` next to each installer:

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/myanterm.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="…"
pnpm tauri build
```

### Bundle targets

`bundle.targets` is now an explicit list — `["deb", "rpm", "appimage", "app",
"dmg", "msi", "nsis"]` — so a single config drives all three Linux package
formats plus macOS `.app`/`.dmg` and Windows `.msi`/`.nsis`. Linux `.deb`
declares dependencies on `libwebkit2gtk-4.1-0` and `libgtk-3-0`; the AppImage
disables `bundleMediaFramework` to keep the binary small (CLAUDE.md R10).

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
  [`tauri-apps/tauri-action`](https://github.com/tauri-apps/tauri-action). The
  workflow reads the same `TAURI_SIGNING_PRIVATE_KEY[_PASSWORD]` env vars as
  local builds from repository secrets and publishes an aggregated `latest.json`
  to the GitHub Release alongside the platform installers — clients pointing at
  the endpoint above pick up the new version through **Settings → Advanced →
  Updates**. Apple notarization and Windows code signing are wired in through
  optional secrets; when unset the build runs unsigned but still completes.

`.github/dependabot.yml` keeps npm, Cargo, and GitHub Actions versions fresh
weekly. See the repository's **Actions** tab for live status.

## License

MIT OR Apache-2.0 (dual-licensed) for the source tree. Bundled fonts retain
their original OFL 1.1 licenses.
