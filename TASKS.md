# TASKS.md — MyanTerm execution plan

This is the execution-order task list Claude Code in cloud should work through. Each task is small enough for one Claude Code session and produces verifiable output.

**Ground rules:**
- Complete tasks in order — later tasks depend on earlier infrastructure.
- Each task ends with: code + tests + perf measurements (where applicable) + commit.
- If a task takes > 1 day of session time, break it down further before starting.
- Update PRD/CLAUDE.md if assumptions change — don't silently drift.

Status legend: ⬜ not started · 🟦 in progress · ✅ done · ⚠️ blocked

> **Phase 1 (T-001 → T-024) shipped in commit `428b8f4`** — Tauri 2 backend,
> portable-pty PTY manager, Myanmar detection / wcwidth contract / character
> joiner / DOM overlay / shape cache, xterm.js Terminal wrapper, tab bar,
> command palette, settings panel, SSH profile manager, six themes. Full
> verification matrix (typecheck / vitest 34 ✅ / cargo test 4 ✅ / vite build /
> cargo check / clippy `-D warnings`) green.
>
> Phase 2/3 in flight on branch `claude/develop-file-data-app-Tzpws`.

---

## Phase 1 — MVP rendering (Weekends 1–4)

### Week 1: Skeleton

- ✅ **T-001** Initialize Tauri 2 project. `pnpm create tauri-app@latest myanterm --template react-ts`. Configure `tauri.conf.json` with app name "MyanTerm", window 1200×800, dark titlebar.
- ✅ **T-002** Set up Tailwind v4, shadcn/ui base, project file structure per CLAUDE.md repo structure.
- ✅ **T-003** Add lint/format/typecheck scripts. Configure rustfmt, clippy with `-D warnings`, prettier, eslint, tsc strict.
- ✅ **T-004** Add `portable-pty` to Cargo.toml. Write `src-tauri/src/pty/manager.rs` with `PtyManager` struct holding HashMap<PtyId, PtySession>. Implement `spawn`, `write`, `resize`, `kill`.
- ✅ **T-005** Wire Tauri commands `pty_spawn`, `pty_write`, `pty_resize`, `pty_kill` to PtyManager. Emit `pty:data` and `pty:exit` events from a tokio task per PTY.
- ✅ **T-006** Frontend: install xterm.js 6.x + addons (webgl, unicode11, fit, search, web-links, serialize). Create `Terminal.tsx` component that mounts xterm and binds to Tauri events. Wire keystrokes to `pty_write`.
- ✅ **T-007** Verify: launch app → see shell prompt → type commands → output appears. **Acceptance: `ls`, `git status`, `echo hello` all work.**

### Week 2: Myanmar detection + naive overlay

- ✅ **T-008** Create `src/lib/myanmar.ts` with `containsMyanmar(text: string): boolean` and `isMyanmarCodepoint(cp: number): boolean`. Cover all three Myanmar blocks. Unit tests.
- ✅ **T-009** Create `src/lib/wcwidth.ts` — port wcwidth tables. Add `myanmarCellWidth` per CLAUDE.md spec. Unit tests against known clusters.
- ✅ **T-010** Create `src/components/terminal/characterJoiner.ts`. Implements `term.registerCharacterJoiner` callback that scans line text, uses `Intl.Segmenter`, returns `[startCol, endCol]` ranges for Myanmar runs. Unit tests.
- ✅ **T-011** Create `src/components/terminal/MyanmarOverlay.tsx`. For each Myanmar run, position absolute div over canvas at the correct cell coords. Listen to xterm scroll events, reposition overlays.
- ✅ **T-012** Embed Padauk.ttf in `src-tauri/fonts/`. Configure `@font-face` with `unicode-range` per CLAUDE.md.
- ✅ **T-013** Verify: `cat myanmar-sample.txt` displays correctly. Cursor positioning in shell works. **Acceptance: typing Myanmar in zsh prompt renders shaped, Backspace deletes one cluster.**
- ✅ **T-014** Run CT-04 (vim Myanmar). Document any breakage. **Acceptance: vim doesn't visually corrupt; cursor may be slightly off — flag for T-018 fix.**

### Week 3: Cluster cache + atlas integration

- ✅ **T-015** Create `src/components/terminal/shapeCache.ts`. LRU cache (use `lru-cache` package) keyed by `${cluster}|${font}|${size}|${fg}|${bg}`. Stores rendered ImageData or atlas slot ID.
- ✅ **T-016** Wire shape cache into MyanmarOverlay — on render, check cache first; if miss, render to OffscreenCanvas, cache result. Reuse DOM nodes via React keys.
- ✅ **T-017** Build perf harness: `tests/perf/myanmar-throughput.ts`. Measures ms-to-render a 10MB Myanmar log via xterm.js. Capture frame times.
- ✅ **T-018** Investigate xterm.js WebGL atlas extension. If feasible in v1.0 scope, implement compound-glyph upload. If not, document why and stay on DOM overlay (acceptable for v1.0 per PRD).
- ✅ **T-019** Tune cell width formula. Test against vim, less, fzf with Myanmar text. Iterate until cursor positions match. **Acceptance: vim cursor lands correctly on Myanmar lines.**
- ✅ **T-020** Write CT-01 through CT-04 tests in `tests/compat/`. Automate where possible.

### Week 4: Phase 1 polish

- ✅ **T-021** Add font picker setting (code font + Myanmar font separately). Default Padauk for Myanmar, JetBrains Mono for code.
- ✅ **T-022** Add Myanmar IME testing on macOS. Verify Keymagic / native input. Fix composition event handling if broken.
- ✅ **T-023** Run perf suite, populate baseline numbers in CLAUDE.md. **Targets per PRD §1.5: cold start < 250ms, frame Myanmar < 8ms, throughput > 50 MB/s.**
- ✅ **T-024** Phase 1 demo build. Single-tab terminal, Myanmar works, ASCII fast. Tag `v0.1.0-mvp`.

---

## Phase 2 — Daily-driver (Weekends 5–8)

### Week 5: Tabs

- ✅ **T-025** Tab bar component. Tab state (id, title, ptyId, cwd). Add/close/reorder via drag.
- ✅ **T-026** Multiple xterm instances per window, one per tab. Lazy-render hidden tabs (don't run renderer).
- ✅ **T-027** Parse OSC 7 (cwd) and OSC 0/2 (title) from PTY stream. Update tab title. New-tab-here uses cwd.
- ✅ **T-028** Keybindings: Cmd+T new tab, Cmd+W close, Cmd+Shift+] / [ next/prev tab. **Acceptance: 5 tabs, switching, closing, reordering all smooth.**

### Week 6: Splits

- ✅ **T-029** Pane tree data structure. Recursive Split | Leaf with horizontal/vertical orientation and resizable ratios.
- ✅ **T-030** SplitPane component using react-resizable-panels or custom. One xterm per leaf.
- ✅ **T-031** Keybindings: Cmd+D horizontal split, Cmd+Shift+D vertical, Cmd+arrow focus nav, Cmd+W close pane.
- ✅ **T-032** Drag dividers to resize. Fire SIGWINCH to PTYs on resize. **Acceptance: 4-pane grid, all resize smoothly, tmux works in nested splits.**

### Week 7: SSH

- ✅ **T-033** Define `SshProfile` type. Create `src-tauri/src/profiles/store.rs` for JSON persistence in app data dir.
- ✅ **T-034** Implement `profile_to_command` — maps profile fields to `ssh` argv (-p port, -i key, -J jump, etc).
- ✅ **T-035** Profile manager UI: list, add/edit form, delete with confirm. Use shadcn dialogs/forms.
- ✅ **T-036** "Quick connect" — open profile in new tab, runs the ssh command. **Acceptance: add profile for a remote host, click quick-connect, get remote shell.**
- ✅ **T-037** Read `~/.ssh/config` for host autocomplete in profile form (P1, may defer).
- ⬜ **T-038** Run CT-09, CT-10 (SSH local + jump). **Acceptance: all CT tests pass over SSH.**

### Week 8: Settings + command palette

- ✅ **T-039** Settings UI (Cmd+,). Tabs: General, Appearance, Keybindings, Profiles, Advanced. Persist via tauri-plugin-store.
- ✅ **T-040** Built-in themes: One Dark, Solarized Dark/Light, Dracula, Nord, Tokyo Night. Theme switcher in settings.
- ✅ **T-041** Command palette (Cmd+Shift+P) using cmdk. Commands: New tab, New window, Open profile, Theme switch, Settings, Reload.
- ✅ **T-042** Session restore — on quit, save tab/pane structure to session.json. On launch, restore layout (NOT buffer content). **Acceptance: 6 tabs with splits → quit → relaunch → same layout.**
- ⬜ **T-043** Phase 2 beta build. Tag `v0.5.0-beta`.

---

## Phase 3 — Cross-platform polish (Weekends 9–12)

### Week 9: Windows

- ⬜ **T-044** Provision Windows dev environment. Run all CT tests on Windows. Document failures.
- ⬜ **T-045** Fix ConPTY edge cases. Common issues: color handling, resize events, exit codes.
- ⬜ **T-046** Test Myanmar IME on Windows (WebView2). Fix composition handling.
- ⬜ **T-047** Verify font rendering on Windows — Padauk + ClearType interactions.

### Week 10: Linux

- ⬜ **T-048** Test on Ubuntu 24.04 + Fedora 43. WebKitGTK quirks: scrollbar, cursor blink, IME via IBus.
- ✅ **T-049** Linux packaging: .deb, .rpm, AppImage via Tauri bundler.
- ⬜ **T-050** Verify Padauk on Linux (fontconfig).

### Week 11: Distribution

- ⬜ **T-051** Apple Developer ID setup. Code-sign macOS .dmg. Notarize via altool/notarytool.
- ⬜ **T-052** Windows code-signing cert (Sectigo or similar). Sign .msi.
- ✅ **T-053** Configure tauri-plugin-updater. Self-hosted update endpoint or GitHub Releases.
- ✅ **T-054** Set up CI (GitHub Actions): build all three platforms, run tests, publish artifacts on tag.

### Week 12: Polish

- ✅ **T-055** Accessibility audit — keyboard navigation everywhere, focus rings, ARIA labels.
- ✅ **T-056** Error handling — what happens when PTY dies, when font fails to load, when settings.json is corrupted.
- ✅ **T-057** Logging — `tracing` to file (rotating), error reports.
- ✅ **T-058** README, screenshots, GIFs. Documentation site.

---

## Phase 4 — Ship (Weekends 13–14)

### Week 13: Beta

- ⬜ **T-059** Recruit 5–10 Myanmar developers for beta. Distribute signed builds.
- ⬜ **T-060** Bug bash. Fix top 10 issues from beta feedback.

### Week 14: Release

- ⬜ **T-061** Tag `v1.0.0`, build signed installers, publish GitHub release.
- ⬜ **T-062** Demo video: side-by-side MyanTerm vs myanso showing memory, startup, Windows support, Claude Code session.
- ⬜ **T-063** Distribution: post to Myanmar dev FB groups, HN Show, Lobsters, r/programming, r/myanmar.
- ⬜ **T-064** Submit Homebrew cask, winget, AUR.

---

## Definition of "done" per task

A task is done when:

1. Code compiles, type-checks, lints clean (zero warnings).
2. Tests pass — both new and existing.
3. If the task touches render path, perf suite ran and numbers updated in CLAUDE.md.
4. Manual verification per task's "Acceptance" line.
5. Commit message follows conventional commits: `feat(scope): description`.
6. PRD/CLAUDE.md updated if any assumption changed.

---

## When you (Claude Code) get stuck

- Reread the relevant section of CLAUDE.md.
- Check PRD acceptance criteria.
- If contradiction or unclear scope, STOP and ask the user. Don't guess on Myanmar correctness or TUI compat.
- If a task is too big, split it into sub-tasks here in this file, then proceed.
