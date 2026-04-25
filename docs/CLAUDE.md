# CLAUDE.md — MyanTerm

This file is the single source of truth for Claude Code working on MyanTerm. Read it fully before any task.

---

## Project identity

**MyanTerm** — cross-platform GPU-accelerated terminal emulator with first-class Myanmar (Burmese) text rendering. Built on Tauri 2 + Rust + xterm.js. Targets macOS, Windows, Linux.

The project competes with myanso (Electron-based Myanmar terminal) on correctness AND with Ghostty/Alacritty/Wezterm on TUI compatibility. The killer feature is "Myanmar renders correctly AND Claude Code/vim/tmux/lazygit work flawlessly" — a combination no other terminal currently delivers.

**Owner:** KyawZayya (solo developer)
**Stack:** Rust + Tauri 2 + React 19 + TypeScript + Tailwind v4 + xterm.js 5.x

---

## Critical context Claude Code MUST internalize

### 1. This is a TERMINAL EMULATOR, not a web app

Standard web app heuristics will mislead you. Specifically:

- **Performance budgets are sub-millisecond.** A 50ms render is unacceptable. Profile every change.
- **Latency matters more than throughput.** Keystroke-to-screen must be < 16ms always.
- **Correctness > convenience.** A terminal that breaks vim is broken, regardless of how nice the UI is.
- **The user lives in this app for 8+ hours/day.** Memory leaks, GPU leaks, focus bugs, and IME bugs are catastrophic.

### 2. Myanmar rendering is the defining feature

When in doubt about ANY rendering, font, layout, or text-handling decision, the Myanmar correctness path wins. But — and this is the critical part — **Myanmar correctness must NEVER break TUI compatibility.**

The contract is:

- Myanmar text MUST shape correctly (combining marks attached, syllables visually whole).
- Cell widths MUST be `wcwidth`-compatible (Myanmar syllable = 2 cells, even if visually it could fit in 1.5).
- Cursor positions reported to TUI apps MUST match what `wcwidth` would say.
- The browser/webview text engine does the actual shaping — we don't ship HarfBuzz.

If a change makes Myanmar look prettier but breaks vim cursor positioning, REJECT IT.

### 3. Two-tier rendering is non-negotiable

Architecture decision baked into v1.0:

- **WebGL renderer** (xterm.js `@xterm/addon-webgl`) handles ASCII, Latin, CJK — i.e., 95%+ of cells.
- **Myanmar overlay** handles only cells containing Myanmar codepoints (U+1000–U+109F, U+AA60–U+AA7F).
- **Cluster shape cache** (LRU 5000) memoizes shaped Myanmar runs by `(cluster_string, font, size)` key.
- **Atlas integration** uploads pre-rendered Myanmar compound glyphs to the WebGL atlas (v1.0 scope: optional, fall back to DOM overlay).

Do not propose architectures that route ALL text through DOM. That's myanso's mistake.

### 4. SSH is system `ssh`, not embedded

We do NOT bundle an SSH client. We spawn the user's `ssh` binary in a PTY and pass profile-derived arguments. This means:

- No russh, no libssh, no key management UI.
- User's `~/.ssh/config`, ssh-agent, jump hosts work for free.
- Profiles are JSON files describing how to invoke `ssh` (host, user, port, key path, jump host, remote command).

If you find yourself adding crypto or key parsing, stop — you're going the wrong way.

### 5. No Zawgyi

Decision is final for v1.0. Don't add Zawgyi detection, conversion, or fallback fonts. Unicode-only.

---

## Repo structure (target)

```
myanterm/
├── src-tauri/                      # Rust backend
│   ├── src/
│   │   ├── main.rs                 # Tauri app entry
│   │   ├── pty/
│   │   │   ├── mod.rs
│   │   │   ├── manager.rs          # PTY lifecycle
│   │   │   └── platform.rs         # OS-specific PTY tweaks
│   │   ├── profiles/
│   │   │   ├── mod.rs
│   │   │   ├── store.rs            # JSON persistence
│   │   │   └── ssh.rs              # Profile → ssh argv
│   │   ├── settings/
│   │   │   ├── mod.rs
│   │   │   └── store.rs
│   │   ├── commands.rs             # Tauri command handlers
│   │   └── events.rs               # Backend → frontend events
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── icons/
│   └── fonts/
│       └── Padauk.ttf              # Embedded Myanmar font
│
├── src/                            # React frontend
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── terminal/
│   │   │   ├── Terminal.tsx        # Wraps xterm.js
│   │   │   ├── MyanmarOverlay.tsx  # DOM overlay renderer
│   │   │   ├── characterJoiner.ts  # registerCharacterJoiner logic
│   │   │   └── shapeCache.ts       # LRU cluster cache
│   │   ├── tabs/
│   │   ├── panes/
│   │   ├── command-palette/
│   │   ├── settings/
│   │   └── profile-manager/
│   ├── lib/
│   │   ├── tauri.ts                # IPC wrappers
│   │   ├── myanmar.ts              # Codepoint detection, segmentation
│   │   └── wcwidth.ts              # Cell-width compat layer
│   ├── styles/
│   └── types/
│
├── tests/
│   ├── compat/                     # CT-XX acceptance tests
│   └── perf/                       # Throughput, frame time
│
├── docs/
│   ├── PRD.md
│   ├── architecture.md
│   ├── myanmar-rendering.md
│   └── compatibility.md
│
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── tailwind.config.ts
├── vite.config.ts
├── README.md
└── CLAUDE.md
```

---

## Development environment

### Prerequisites

- Rust stable (rustup, edition 2021)
- Node 20+ + pnpm 9+
- Tauri 2 prerequisites per platform: https://v2.tauri.app/start/prerequisites/
- macOS: Xcode CLT
- Windows: WebView2 runtime, MSVC build tools
- Linux: WebKitGTK 4.1, build-essential, libssl-dev, libgtk-3-dev, libayatana-appindicator3-dev, librsvg2-dev

### Setup commands

```bash
# Install JS deps
pnpm install

# Run dev (auto-reload frontend + rebuild Rust on change)
pnpm tauri dev

# Build release for current platform
pnpm tauri build

# Run tests
pnpm test                  # Vitest, frontend
cargo test --manifest-path src-tauri/Cargo.toml  # Rust tests

# Type check
pnpm typecheck

# Lint
pnpm lint
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

### Style and conventions

- **Rust:** rustfmt default, clippy with `-D warnings`. Use `tracing` for logs, never `println!` in non-test code.
- **TypeScript:** strict mode on. No `any` except at IPC boundaries (and document why). Prefer `type` over `interface` for data shapes.
- **React:** functional components only. Hooks. No class components. Tailwind for all styling — no CSS modules, no styled-components.
- **Imports:** use absolute imports from `src/` via tsconfig path aliases.
- **Naming:** components PascalCase, hooks `useFoo`, files match export name.

---

## Coding rules — the non-negotiables

These are MUSTs. Violations should be caught in PR review.

### R1. Never block the main thread on Myanmar shaping

Myanmar shape lookups in render path must complete in < 0.1ms. Use the cluster cache. If a cluster isn't cached and shaping would block, render placeholder (empty cells) and shape async, then invalidate.

### R2. Cell width is sacred

`wcwidth` returns N for a Myanmar cluster — your renderer MUST occupy exactly N cells. Don't round, don't fudge, don't optimize. The contract with TUI apps depends on this.

### R3. Use xterm.js public APIs

Don't reach into xterm.js internals (`_core`, `__`, etc). If you need something not exposed, file an issue or wrap it cleanly. Internals change between versions.

### R4. PTY data is bytes, not strings

PTY output is `Vec<u8>`. Decode to UTF-8 only at the xterm.js layer. Backend code must handle invalid UTF-8 gracefully (it WILL happen — programs emit binary garbage).

### R5. All user-visible text uses i18n keys

Even if v1.0 is English-only, wrap UI strings in `t('key')`. Adding Burmese UI later should be a config swap, not a refactor.

### R6. No `localStorage` / `sessionStorage`

Tauri apps persist via the backend. Use `tauri-plugin-store` or custom Tauri commands. localStorage gets wiped on webview cache clears.

### R7. Performance regressions block merge

Every PR touching the render path must include before/after numbers from the perf test suite. Frame time, memory, throughput.

### R8. Tests precede features

For F-100 through F-113 (Myanmar features) especially: write the failing test, then implement. Tests are in `tests/compat/` and reference CT-XX from PRD.

### R9. Never ship `console.log`

Use `tracing` (Rust) or a debug logger (frontend) gated by NODE_ENV. Stray `console.log` in release breaks devtools-less debugging.

### R10. Keep the binary small

Audit `Cargo.toml` and `package.json` regularly. Reject deps that pull in > 1MB without strong justification. Target < 25MB installer.

---

## Common tasks for Claude Code

### Adding a new Tauri command

1. Define the command in `src-tauri/src/commands.rs` with `#[tauri::command]`.
2. Register it in `main.rs` `tauri::Builder::default().invoke_handler(...)`.
3. Add the TypeScript wrapper in `src/lib/tauri.ts`:
   ```ts
   export const fooCommand = (args: FooArgs): Promise<FooResult> =>
     invoke('foo_command', args);
   ```
4. Add types in `src/types/`.
5. Test: Rust unit test in commands module, TS test for IPC wrapper.

### Adding a Myanmar rendering feature

1. Read `docs/myanmar-rendering.md` first.
2. Identify whether it touches detection (`src/lib/myanmar.ts`), segmentation (`characterJoiner.ts`), caching (`shapeCache.ts`), or rendering (`MyanmarOverlay.tsx`).
3. Add a CT-XX test in `tests/compat/myanmar/`.
4. Verify against `wcwidth` contract — Myanmar cell counts must match.
5. Run perf suite before/after.

### Adding a TUI compatibility test

1. Add a script under `tests/compat/tui/` that drives the TUI tool via PTY.
2. Use expectations on terminal buffer state (xterm.js `serialize` addon helps).
3. Add to CI matrix if reproducible across platforms.

### Adding an SSH profile field

1. Update `SshProfile` type in both `src-tauri/src/profiles/store.rs` and `src/types/profile.ts`.
2. Update `profile_to_command` in `src-tauri/src/profiles/ssh.rs` if the field affects argv.
3. Update profile manager UI form.
4. Migration: bump profiles JSON schema version, add migration logic.

---

## What NOT to do (anti-patterns)

- **Don't add Electron polyfills.** This is Tauri. `process`, `Buffer`, `__dirname` don't exist in webview.
- **Don't use Node APIs from frontend.** No `fs`, no `child_process`. Use Tauri commands.
- **Don't bundle xterm.js's deprecated canvas renderer.** WebGL only.
- **Don't add features outside the PRD without explicit ask.** Scope discipline matters.
- **Don't optimize prematurely.** Measure first, then change. Especially for Myanmar — don't assume you know where time goes.
- **Don't trust LLM-suggested xterm.js APIs.** xterm.js's API surface is large and changes; verify against actual `node_modules/@xterm/xterm/typings/xterm.d.ts`.
- **Don't add a "smart" feature that auto-detects Zawgyi.** Out of scope. If user wants Zawgyi, they install a converter externally.
- **Don't do `cmd | string` PTY bridging on Windows.** Use ConPTY via portable-pty. Anything else breaks colors.

---

## Project-specific knowledge

### Myanmar codepoint ranges

- Primary block: **U+1000–U+109F** (Myanmar)
- Extended block: **U+AA60–U+AA7F** (Myanmar Extended-A)
- Extended-B: **U+A9E0–U+A9FF** (also include for completeness)
- A character is "Myanmar" if its codepoint falls in any of these.

### Grapheme clustering

Use `Intl.Segmenter` with `granularity: 'grapheme'`. It correctly handles Myanmar combining marks per Unicode UAX #29. Don't hand-roll cluster boundaries.

```ts
const segmenter = new Intl.Segmenter('my', { granularity: 'grapheme' });
const clusters = [...segmenter.segment(text)].map(s => s.segment);
```

### Cell width formula (the rule)

```ts
function myanmarCellWidth(cluster: string): number {
  // For wcwidth compatibility:
  // Single Myanmar grapheme = 2 cells.
  // Empty/whitespace clusters = wcwidth default.
  if (containsMyanmar(cluster)) return 2;
  return wcwidth(cluster);
}
```

This is the contract. Don't change it without a PRD amendment.

### xterm.js character joiner

```ts
term.registerCharacterJoiner((line) => {
  // Return [[startCol, endCol], ...] for runs to keep together
  const ranges: [number, number][] = [];
  // Walk line, find Myanmar runs, return their ranges
  return ranges;
});
```

This is the ONLY supported hook for "treat these cells as one rendering unit." Use it.

### Padauk font loading

```css
@font-face {
  font-family: 'Padauk';
  src: url('/fonts/Padauk.ttf') format('truetype');
  font-display: block;  /* not 'swap' — avoid FOUT in terminal */
  unicode-range: U+1000-109F, U+AA60-AA7F, U+A9E0-A9FF;
}

.terminal {
  font-family: 'JetBrains Mono', 'Padauk', monospace;
}
```

`font-display: block` is critical — terminal text shouldn't reflow after font load.

---

## Performance baselines (track these)

After each significant change, run `pnpm test:perf` and update this section:

| Metric | Baseline | Last measured | Target | Status |
|---|---|---|---|---|
| Cold start, macOS M5 Pro | TBD | TBD | < 250ms | ⚠️ |
| Memory, 1 tab idle | TBD | TBD | < 150MB | ⚠️ |
| Frame time, ASCII redraw | TBD | TBD | < 4ms | ⚠️ |
| Frame time, Myanmar redraw | TBD | TBD | < 8ms | ⚠️ |
| Cluster cache hit rate | TBD | TBD | > 95% | ⚠️ |
| `cat` Myanmar throughput | TBD | TBD | > 50 MB/s | ⚠️ |

Update after every PR that touches render path.

---

## Reference docs (read these when stuck)

- Tauri 2: https://v2.tauri.app/
- xterm.js: https://github.com/xtermjs/xterm.js/tree/master/typings
- portable-pty: https://docs.rs/portable-pty/
- Unicode UAX #29 (grapheme clusters): https://unicode.org/reports/tr29/
- Myanmar Unicode block: https://unicode.org/charts/PDF/U1000.pdf
- VT100/xterm escape sequences: https://invisible-island.net/xterm/ctlseqs/ctlseqs.html
- Padauk font: https://software.sil.org/padauk/

---

## When in doubt, ask

If a task touches:
- Cell width contract
- Myanmar grapheme handling
- TUI compatibility
- PRD scope boundaries
- Performance baselines

…stop and ask the user (KyawZayya) before implementing. Wrong answers here cause weeks of cleanup.
