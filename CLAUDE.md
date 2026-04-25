# CLAUDE.md — MyanTerm

The full source-of-truth lives in [docs/CLAUDE.md](docs/CLAUDE.md). The
short version for Claude Code in this repo:

1. **This is a terminal emulator, not a web app.** Sub-millisecond budgets;
   keystroke-to-screen < 16ms; correctness trumps convenience.
2. **Myanmar correctness is the killer feature, but never breaks TUI compat.**
   `myanmarCellWidth` always returns 2 for clusters containing a Myanmar
   codepoint — that's the contract `vim`/`tmux` rely on.
3. **Two-tier rendering is non-negotiable.** WebGL for ASCII/Latin/CJK; DOM
   overlay (`src/components/terminal/MyanmarOverlay.tsx`) for Myanmar only;
   shape cache (`shapeCache.ts`, LRU 5000); future atlas integration.
4. **SSH is the system `ssh` binary in a PTY.** No embedded client, no key
   parsing in our code.
5. **No Zawgyi.** Unicode-only.

Coding rules (the non-negotiables):

- R1. Never block the main thread on Myanmar shaping. Use the cluster cache.
- R2. Cell width is sacred — wcwidth contract above all.
- R3. Use only public xterm.js APIs; no `_core` reach-arounds outside the
  documented escape hatches in `MyanmarOverlay.tsx`.
- R4. PTY data is bytes — decode lossily at the webview boundary
  (`src-tauri/src/pty/manager.rs`).
- R5. All user-visible strings go through `t('key')` (`src/lib/i18n.ts`).
- R6. No `localStorage` — persist via Tauri commands.
- R7. Perf regressions block merge; run `pnpm test:perf` on render-path PRs.
- R8. Tests precede Myanmar features (`tests/lib/myanmar.test.ts`,
  `tests/lib/wcwidth.test.ts`, `tests/components/`).
- R9. Never ship `console.log` in render path; use `tracing` (Rust) or warn-only.
- R10. Keep the binary < 25 MB; audit deps regularly.

When in doubt about: cell-width contract, Myanmar grapheme handling, TUI
compat, PRD scope, performance baselines — **stop and ask**.
