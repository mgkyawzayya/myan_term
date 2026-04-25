# MyanTerm — Product Requirements Document

**Version:** 1.0
**Owner:** KyawZayya
**Status:** Draft for implementation
**Last updated:** 2026-04-25

---

## 1. Overview

### 1.1 What is MyanTerm

MyanTerm is a cross-platform GPU-accelerated terminal emulator with first-class Myanmar (Burmese) text rendering. Built on Tauri 2 + Rust + xterm.js, it delivers Ghostty-class performance for ASCII workloads while correctly shaping Myanmar Unicode syllables that current terminals (including myanso) render incorrectly or slowly.

### 1.2 The problem

Myanmar developers face three pain points with existing terminals:

1. **Ghostty, Alacritty, iTerm2, Wezterm** render Myanmar incorrectly — combining marks break, syllables split across cells, cursor positioning is wrong on Myanmar text.
2. **myanso** (Electron + xterm.js + DOM Myanmar renderer) is the only Myanmar-aware terminal, but it consumes 400MB+ RAM, has 1.5s cold start, broken Windows support, no SSH profile manager, and routes all rendering through DOM (slow on Myanmar-heavy buffers).
3. **No terminal correctly handles Myanmar AND modern TUI apps** (Claude Code, OpenCode, lazygit, vim, tmux). Apps that work in myanso break elsewhere; apps that work elsewhere break Myanmar text.

### 1.3 The solution

MyanTerm fixes all three by:

- **Tauri 2 + Rust backend** — 1/4 memory of Electron, 5× faster startup, native binaries on macOS/Windows/Linux signed and auto-updating from day 1.
- **Two-tier rendering** — xterm.js WebGL for ASCII/Latin/CJK (95%+ of cells), DOM-overlay shaped clusters for Myanmar runs only. Cluster-level glyph caching and GPU atlas integration.
- **TUI-first compatibility** — `wcwidth`-compatible cell widths (Myanmar syllables = 2 cells), Unicode 11 width tables, truecolor, bracketed paste, alternate screen, OSC 8 hyperlinks, synchronized output, mouse SGR mode. Verified working with Claude Code, OpenCode, vim, tmux, lazygit, fzf, btop.
- **SSH profile manager** — system `ssh` invoked via PTY, profiles stored as JSON, jump hosts and keys handled by user's existing `~/.ssh/config`.

### 1.4 Non-goals (v1.0)

- **No Zawgyi support.** Confirmed scope decision — Unicode-only.
- **No mobile** (iOS/Android). PTY sandboxing makes it impractical.
- **No GPU graphics protocols** (Sixel, Kitty graphics). Future consideration.
- **No tmux replacement.** Multiplexing comes from running tmux *inside* MyanTerm, not from MyanTerm itself.
- **No embedded SSH client.** System ssh only — no russh, no key management UI.
- **No AI features.** This is a terminal, not an AI product.

### 1.5 Success metrics

| Metric | Target | How measured |
|---|---|---|
| Cold start | < 250ms to first prompt | macOS, M-series, release build |
| Memory, 1 tab idle | < 150MB RSS | All three platforms |
| Memory, 6 tabs active | < 400MB RSS | Realistic daily-driver load |
| Frame time, ASCII redraw | < 4ms | 80×24 full redraw, WebGL on |
| Frame time, Myanmar redraw | < 8ms | 80×24 Myanmar buffer, warm cache |
| `cat` throughput, Myanmar | > 50 MB/s | 10MB Myanmar log file |
| Scroll FPS, Myanmar buffer | 60 (vsync) | Continuous scroll, full Myanmar |
| TUI compat | 100% | Claude Code, OpenCode, vim, tmux, lazygit, fzf, btop pass acceptance tests |
| Binary size | < 25MB per platform | Compressed installer |

---

## 2. Target user

**Primary persona: Myanmar developer working in mixed-language codebases.**

- Reads/writes code in English, comments and docs in Myanmar Unicode
- Lives in terminal: shell, git, Docker, Claude Code, ssh to remote servers
- Has tried Ghostty/iTerm2 (Myanmar broken), tried myanso (slow, no Windows, no SSH manager)
- Wants a terminal that "just works" for both modern dev tooling AND Myanmar text

**Secondary persona: Myanmar tech lead/CTO** evaluating tooling for Myanmar-speaking dev teams. Needs Windows + macOS support because team is mixed-platform.

**Out of scope as users:** non-Myanmar developers (no reason to switch from Ghostty), Zawgyi-only users (use Pyidaungsu legacy tools).

---

## 3. Feature requirements

Features are tagged **F-NNN** for traceability. Priority: **P0** (v1.0 ship-blocking), **P1** (v1.1), **P2** (later).

### 3.1 Core terminal — F-001 to F-099

| ID | Feature | Priority | Notes |
|---|---|---|---|
| F-001 | Local shell PTY spawning | P0 | portable-pty, default shell from env |
| F-002 | xterm.js parser + WebGL renderer | P0 | xterm.js 5.x, `@xterm/addon-webgl` |
| F-003 | Unicode 11 cell widths | P0 | `@xterm/addon-unicode11` mandatory |
| F-004 | Truecolor (24-bit RGB) | P0 | Set `COLORTERM=truecolor` env |
| F-005 | 256-color + 16-color | P0 | Default `TERM=xterm-256color` |
| F-006 | Mouse support (SGR mode 1006) | P0 | For lazygit, btop, fzf |
| F-007 | Bracketed paste mode | P0 | Critical for Claude Code multi-line paste |
| F-008 | Alternate screen buffer | P0 | vim, less, htop, lazygit |
| F-009 | Cursor shape changes (DECSCUSR) | P0 | vim modal cursor |
| F-010 | Synchronized output (DEC 2026) | P0 | Claude Code, modern Neovim, btop |
| F-011 | OSC 8 clickable hyperlinks | P0 | Claude Code emits these |
| F-012 | OSC 7 working directory tracking | P0 | Tab title + new-tab-here-CWD |
| F-013 | OSC 0/2 window title | P0 | Tab labels |
| F-014 | Scrollback buffer (configurable, default 10000) | P0 | |
| F-015 | Search in scrollback | P0 | `@xterm/addon-search`, Cmd+F |
| F-016 | Selection + copy/paste | P0 | Block selection (alt-drag) included |
| F-017 | URL/path detection + click | P0 | `@xterm/addon-web-links` |
| F-018 | Resize handling (SIGWINCH) | P0 | Smooth reflow |
| F-019 | Sixel graphics | P2 | Defer |
| F-020 | Kitty graphics protocol | P2 | Defer |

### 3.2 Myanmar rendering — F-100 to F-199

| ID | Feature | Priority | Notes |
|---|---|---|---|
| F-100 | Myanmar codepoint detection (U+1000–U+109F, U+AA60–U+AA7F) | P0 | Per-cell tagging in xterm.js |
| F-101 | Grapheme cluster identification | P0 | `Intl.Segmenter` for runs |
| F-102 | `registerCharacterJoiner` for Myanmar runs | P0 | Tells xterm.js to treat run as unit |
| F-103 | DOM overlay renderer for Myanmar runs | P0 | Absolutely-positioned divs over canvas |
| F-104 | wcwidth-compatible cell allocation | P0 | Myanmar syllable = 2 cells, centered |
| F-105 | Cluster-level shape cache (LRU 5000) | P0 | Cache by cluster string + font + size |
| F-106 | Atlas-cached Myanmar compound glyphs | P0 | OffscreenCanvas → atlas blit |
| F-107 | Padauk font embedded as default | P0 | OFL-licensed, ~1MB |
| F-108 | Pyidaungsu and Noto Sans Myanmar as options | P1 | User selects in settings |
| F-109 | Separate "code font" + "Myanmar font" settings | P0 | CSS fallback chain |
| F-110 | Myanmar-correct cursor positioning in TUI apps | P0 | wcwidth contract — vim/tmux work |
| F-111 | Myanmar IME composition events | P0 | Especially macOS — verify with Keymagic |
| F-112 | Scroll-synced overlay positioning | P0 | Overlays update in same RAF as canvas |
| F-113 | Atlas eviction on font/size change | P0 | Don't leak GPU memory |

### 3.3 Tabs and panes — F-200 to F-299

| ID | Feature | Priority | Notes |
|---|---|---|---|
| F-200 | Multiple tabs in single window | P0 | One PTY per tab |
| F-201 | Tab titles auto-set from OSC + cwd | P0 | |
| F-202 | Tab reorder via drag | P0 | |
| F-203 | New tab in same CWD | P0 | Default behavior, Cmd+T |
| F-204 | Close tab with confirmation if running | P0 | |
| F-205 | Horizontal split | P0 | Cmd+D |
| F-206 | Vertical split | P0 | Cmd+Shift+D |
| F-207 | Resize splits via drag | P0 | Draggable dividers |
| F-208 | Pane focus navigation (Cmd+arrow) | P0 | |
| F-209 | Close pane | P0 | Cmd+W |
| F-210 | Zoom pane (toggle full-tab) | P1 | |
| F-211 | Multiple windows | P0 | Cmd+N |
| F-212 | Session restore on launch | P0 | Restore tab/pane layout, not buffer content |

### 3.4 SSH and profiles — F-300 to F-399

| ID | Feature | Priority | Notes |
|---|---|---|---|
| F-300 | SSH via system `ssh` binary | P0 | Spawn in PTY, no embedded client |
| F-301 | SSH profile storage (JSON) | P0 | App data dir, hand-editable |
| F-302 | Profile fields: host, user, port, key, jump, command | P0 | All optional except host |
| F-303 | Profile manager UI | P0 | Sidebar drawer or command palette |
| F-304 | Quick-connect: open profile in new tab | P0 | |
| F-305 | Read `~/.ssh/config` host completion | P1 | Suggest hosts when adding profile |
| F-306 | Profile groups/folders | P1 | For users with many servers |
| F-307 | Detect SSH disconnect, offer reconnect | P1 | |
| F-308 | SSH-aware tab title (`user@host`) | P0 | Parse from prompt or escape sequences |

### 3.5 Settings, themes, UX — F-400 to F-499

| ID | Feature | Priority | Notes |
|---|---|---|---|
| F-400 | Settings UI (React) | P0 | Cmd+, |
| F-401 | Font family picker (code + Myanmar separate) | P0 | |
| F-402 | Font size, line height, letter spacing | P0 | |
| F-403 | Color theme selector | P0 | Built-in: One Dark, Solarized, Dracula, Nord |
| F-404 | Custom theme via JSON | P1 | |
| F-405 | Cursor style + blink | P0 | |
| F-406 | Default shell selector | P0 | Auto-detect, override |
| F-407 | Custom env vars | P0 | |
| F-408 | Keybinding customization | P1 | JSON config first, UI later |
| F-409 | Window opacity/blur | P1 | macOS first |
| F-410 | Command palette | P0 | Cmd+Shift+P — new tab, ssh profile, settings, theme |
| F-411 | Auto-update | P0 | Tauri updater, signed releases |
| F-412 | Crash reporter (opt-in) | P1 | Sentry or similar |

### 3.6 Distribution — F-500 to F-599

| ID | Feature | Priority | Notes |
|---|---|---|---|
| F-500 | macOS .dmg, signed + notarized | P0 | Apple Developer ID |
| F-501 | Windows .msi, signed | P0 | Code signing cert |
| F-502 | Linux .deb, .rpm, .AppImage | P0 | Tauri bundler handles |
| F-503 | Homebrew cask | P1 | After v1.0 stable |
| F-504 | winget package | P1 | |
| F-505 | AUR package | P1 | |

---

## 4. Architecture

### 4.1 Stack

```
┌─────────────────────────────────────────────────────┐
│  React 19 + TypeScript + Tailwind v4 (Frontend)    │
│  ├─ xterm.js 5.x core                               │
│  ├─ @xterm/addon-webgl                              │
│  ├─ @xterm/addon-unicode11                          │
│  ├─ @xterm/addon-fit                                │
│  ├─ @xterm/addon-search                             │
│  ├─ @xterm/addon-web-links                          │
│  ├─ @xterm/addon-serialize                          │
│  ├─ Myanmar overlay renderer (custom)               │
│  ├─ Cluster shape cache (custom)                    │
│  ├─ Tab/pane manager (custom)                       │
│  ├─ Command palette (cmdk)                          │
│  └─ Settings/profile UI (shadcn/ui)                 │
├─────────────────────────────────────────────────────┤
│  Tauri 2 IPC                                         │
├─────────────────────────────────────────────────────┤
│  Rust backend                                        │
│  ├─ tauri 2.x                                        │
│  ├─ portable-pty (cross-platform PTY)               │
│  ├─ tokio (async I/O)                                │
│  ├─ serde + serde_json (config/profiles)            │
│  ├─ directories (XDG paths)                          │
│  ├─ tauri-plugin-store (persisted state)             │
│  ├─ tauri-plugin-updater (auto-update)               │
│  └─ Custom: pty manager, profile store, IPC handlers │
└─────────────────────────────────────────────────────┘
```

### 4.2 Process model

- **One Tauri process per window** (Tauri default)
- **One Tokio task per PTY** — reads PTY stdout, sends bytes to webview via Tauri events
- **One xterm.js Terminal instance per pane** in webview
- **PTY writes** go from webview → Tauri command → tokio task → PTY stdin
- **Resize events** propagate window → React → Tauri command → PTY ioctl

### 4.3 Myanmar rendering pipeline

```
PTY bytes
   │
   ▼
xterm.js parser ───► cells [{char, attrs, ...}]
   │
   ▼
registerCharacterJoiner callback per line
   │  ├─ Detect Myanmar codepoints (U+1000-U+109F, U+AA60-U+AA7F)
   │  └─ Use Intl.Segmenter to find grapheme clusters
   ▼
For each Myanmar cluster:
   │  ├─ Compute cell range (cluster width = ceil(grapheme_count × 1.7) capped to 2)
   │  ├─ Cache key = (cluster_string, font_id, size, fg, bg)
   │  ├─ Check cluster shape cache
   │  │     ├─ HIT  → use cached atlas slot
   │  │     └─ MISS → render to OffscreenCanvas, upload to atlas
   │  └─ Mark cells as "Myanmar overlay"
   ▼
WebGL renderer:
   ├─ Draws non-Myanmar cells normally
   └─ For Myanmar cells: draws compound glyph from atlas slot
   ▼
DOM overlay (fallback for atlas misses or accessibility):
   └─ Absolutely-positioned divs over canvas, synced on RAF
```

### 4.4 Data persistence

| Data | Location | Format |
|---|---|---|
| Settings | `${APP_DATA}/settings.json` | JSON |
| SSH profiles | `${APP_DATA}/profiles.json` | JSON |
| Themes | `${APP_DATA}/themes/*.json` | JSON |
| Session state | `${APP_DATA}/session.json` | JSON, on exit |
| Logs | `${APP_DATA}/logs/myanterm.log` | Plain text |
| Cluster shape cache | In-memory only | LRU 5000 entries |

`${APP_DATA}` resolves to:
- macOS: `~/Library/Application Support/MyanTerm`
- Windows: `%APPDATA%\MyanTerm`
- Linux: `~/.config/MyanTerm`

### 4.5 Key API contracts (Tauri commands)

```typescript
// Frontend → Backend
invoke('pty_spawn', { shell: string, cwd: string, env: Record<string, string>, cols: number, rows: number })
  → { pty_id: string }

invoke('pty_write', { pty_id: string, data: string })
  → void

invoke('pty_resize', { pty_id: string, cols: number, rows: number })
  → void

invoke('pty_kill', { pty_id: string })
  → void

invoke('profile_list')
  → SshProfile[]

invoke('profile_save', { profile: SshProfile })
  → void

invoke('profile_delete', { id: string })
  → void

invoke('profile_to_command', { id: string })
  → { argv: string[], env: Record<string, string> }

invoke('settings_get')
  → Settings

invoke('settings_set', { settings: Settings })
  → void

// Backend → Frontend (events)
event('pty:data', { pty_id: string, data: string })
event('pty:exit', { pty_id: string, code: number })
```

---

## 5. Compatibility acceptance tests

These MUST pass before v1.0 ship. Each is a manual + scripted test.

| Test | Procedure | Pass criteria |
|---|---|---|
| **CT-01** Claude Code | Run `claude` interactively, type Myanmar in prompt, paste 50-line code block | Renders correctly, paste arrives as one block, scrollback intact |
| **CT-02** OpenCode | Run `opencode`, complete a task | Same as CT-01 |
| **CT-03** vim ASCII | `vim file.txt`, edit, `:q` | Colors, cursor shape, alt screen all work |
| **CT-04** vim Myanmar | `vim` a Myanmar `.md` file, navigate with hjkl | Cursor lands on syllable boundaries, no visual corruption |
| **CT-05** tmux nested | `tmux new` then run vim, lazygit, htop inside | All work inside tmux inside MyanTerm |
| **CT-06** lazygit | Run in a real repo, scroll diff, stage hunks | Mouse works, colors correct, no flicker |
| **CT-07** btop | Run for 60 seconds | Smooth refresh, gradients render, no flicker, mouse works |
| **CT-08** fzf | `fzf` over a 100k-line file | Type-ahead responsive, alt screen restored on exit |
| **CT-09** SSH local | SSH to localhost, run all above tests remotely | All pass over SSH |
| **CT-10** SSH jump | SSH through a jump host (ProxyCommand) | Connects, all tests pass |
| **CT-11** Bracketed paste | Paste 1000 lines into bash | Arrives as paste, no per-line execution |
| **CT-12** Throughput ASCII | `cat 100MB-ascii.log` | Completes < 5s, no dropped frames |
| **CT-13** Throughput Myanmar | `cat 10MB-myanmar.log` | Completes < 1s, smooth scroll |
| **CT-14** Resize stress | Drag window resize for 30s | No crash, reflow correct, no orphaned cells |

---

## 6. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| xterm.js WebGL renderer can't be extended for compound glyphs without forking | Med | High | v1.0 uses DOM overlay (slower but works); plan WebGL atlas patch as v1.1 |
| Myanmar IME composition broken on Windows WebView2 | Med | High | Test early on Windows; fall back to manual input handling if needed |
| Padauk font has rendering bugs on Linux WebKitGTK | Low | Med | Ship Noto Sans Myanmar as alternative; provide font picker |
| portable-pty Windows ConPTY edge cases break TUI apps | Med | High | Test all CT-XX tests on Windows early; use Wezterm's PTY fork if needed |
| wcwidth-compatible Myanmar (2 cells per syllable) looks ugly to native readers | High | Low | Document as deliberate; offer "compact" mode in settings (Phase 2, may break TUIs) |
| Code signing certs (Apple + Windows) cost ~$200/yr | High | Low | Budget; revenue from app should cover (or use ad hoc signing initially) |
| Solo dev burnout — terminal is a tool, not revenue | High | Med | Cap scope at v1.0 features; resist feature creep |
| Apple notarization rejection due to entitlements | Low | High | Use minimal entitlements; test notarization in CI before release |
| Myanmar dev community ignores it (myanso adoption inertia) | Med | High | Ship demo video specifically targeting myanso vs MyanTerm side-by-side; distribute through Myanmar dev FB groups |

---

## 7. Roadmap

### Phase 1 — MVP rendering (Weekends 1–4)

Goal: prove Myanmar rendering works at speed, local shell only.

- W1: Tauri + xterm.js + portable-pty skeleton, single tab, single PTY
- W2: WebGL renderer + Unicode 11 + Myanmar codepoint detection + naive DOM overlay
- W3: Cluster shape cache, atlas integration, performance baseline
- W4: Cell-width logic, font embedding (Padauk), Myanmar IME testing

**Deliverable:** dev build, single-tab terminal, passes CT-01 through CT-04 on macOS.

### Phase 2 — Daily-driver (Weekends 5–8)

Goal: replaces user's current terminal for local + SSH work.

- W5: Tabs + tab management, OSC 7/0/2 parsing
- W6: Splits (horizontal + vertical), pane navigation
- W7: SSH profile storage + manager UI + quick-connect
- W8: Command palette, settings UI, theme system

**Deliverable:** beta build, passes all CT-01 through CT-12 on macOS + Linux.

### Phase 3 — Cross-platform polish (Weekends 9–12)

Goal: ships on all three platforms, ready for public release.

- W9: Windows port — ConPTY testing, all CT tests on Windows
- W10: Linux port — WebKitGTK quirks, AppImage/deb/rpm packaging
- W11: Auto-update, code signing, notarization
- W12: Session restore, accessibility audit, README + docs

**Deliverable:** v1.0-rc1, signed installers for all three platforms.

### Phase 4 — Ship (Weekends 13–14)

- W13: Beta testing with 5-10 Myanmar developers, fix top issues
- W14: v1.0.0 release, demo video, distribution

**Deliverable:** v1.0.0 public release, GitHub repo, website, demo video.

---

## 8. Open decisions deferred to implementation

These don't block PRD but need answers during build:

1. **xterm.js fork vs upstream patches** — defer until W3, decide based on whether `registerCharacterJoiner` + atlas blit is enough or we need deeper changes.
2. **Settings storage: tauri-plugin-store vs raw JSON** — defer until W8.
3. **Theme format: VSCode-compatible or custom** — defer until W8. Recommend VSCode-compatible for free theme imports.
4. **Update channel: stable + beta or stable only** — defer until W11.
5. **Telemetry/analytics: opt-in or none** — defer until W11. Recommend none for v1.0 (privacy-first positioning).
