# Platform Testing Guide — MyanTerm

This document outlines the platform-specific testing requirements for MyanTerm across Windows, Linux, and macOS.

## Overview

MyanTerm is built on Tauri 2 and uses platform-specific webview engines:
- **macOS**: WKWebView (WebKit)
- **Windows**: WebView2 (Chromium Edge)
- **Linux**: WebKitGTK 4.1

Each platform has unique quirks that must be tested and handled.

---

## Phase 3 Testing Tasks

### Windows (T-044 to T-047)

#### T-044: Windows Dev Environment Setup

**Prerequisites:**
```powershell
# Install Rust
winget install --id Rustlang.Rustup

# Install Node.js 20+
winget install OpenJS.NodeJS.LTS

# Install pnpm
npm install -g pnpm

# Install WebView2 Runtime (usually pre-installed on Windows 11)
# Download from: https://developer.microsoft.com/en-us/microsoft-edge/webview2/
```

**Build Test:**
```powershell
cd myan_term
pnpm install
pnpm tauri build
```

**Expected Issues:**
- ConPTY may have different behavior than unix PTY
- Path separators (`\` vs `/`)
- Line endings (CRLF vs LF)

#### T-045: ConPTY Edge Cases

**Test Cases:**
1. **Color Handling**
   ```cmd
   # Test ANSI colors
   echo [31mRed[0m [32mGreen[0m [34mBlue[0m

   # Test 256-color mode
   curl -L https://gist.githubusercontent.com/HaleTom/89ffe32783f89f403bba96bd7bcd1263/raw/
   ```

2. **Resize Events**
   - Open terminal, run `vim`
   - Resize window rapidly
   - Verify: no visual corruption, cursor position correct

3. **Exit Codes**
   ```cmd
   exit 42
   # Verify toast shows "PTY exit (code 42)"
   ```

**Known Issues:**
- ConPTY sometimes drops the first character after resize
- Exit code may be lost if process exits too quickly

#### T-046: Myanmar IME on Windows

**Test with:**
- Myanmar Unicode keyboard (Zawgyi NOT supported)
- Microsoft Input Method Editor (IME)
- Third-party: Keyman, Google Input Tools

**Test Cases:**
1. Type Myanmar in terminal prompt (PowerShell/CMD)
2. Type Myanmar in vim
3. Copy/paste Myanmar text
4. Composition events (e.g., medial ra + ya)

**Success Criteria:**
- All Myanmar clusters render correctly
- Composition underline appears during input
- Backspace deletes one cluster

#### T-047: Font Rendering on Windows

**Test:**
1. Open MyanTerm
2. Settings → Appearance → Myanmar Font
3. Try: Padauk, Myanmar Text, Noto Sans Myanmar
4. Check ClearType anti-aliasing

**Known Issues:**
- ClearType may make thin strokes too bold
- Padauk may look different than macOS/Linux

---

### Linux (T-048, T-050)

#### T-048: Linux Distribution Testing

**Test Distributions:**
- Ubuntu 24.04 LTS (primary target)
- Fedora 43 (GNOME + Wayland)
- Arch Linux (rolling release edge case)

**Install Dependencies (Ubuntu):**
```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libxdo-dev \
  build-essential \
  curl \
  wget
```

**Install Dependencies (Fedora):**
```bash
sudo dnf install -y \
  webkit2gtk4.1-devel \
  gtk3-devel \
  libappindicator-gtk3-devel \
  librsvg2-devel \
  xdotool-devel \
  openssl-devel
```

**WebKitGTK Quirks to Test:**
1. **Scrollbar Styling**
   - Check if custom scrollbar CSS works
   - Fallback to native scrollbar if needed

2. **Cursor Blink**
   - Terminal cursor should blink independently of GTK cursor

3. **IME via IBus**
   ```bash
   # Install IBus Myanmar
   sudo apt install ibus-table-myanmar

   # Test typing Myanmar with IBus
   ibus-daemon -drx
   ```

**Wayland-Specific:**
- Test on GNOME with Wayland session
- Verify clipboard works (Wayland clipboard is different)
- Test drag-and-drop (may not work on Wayland)

#### T-050: Padauk Font on Linux

**Test:**
1. Install Padauk via fontconfig:
   ```bash
   sudo apt install fonts-sil-padauk
   fc-cache -fv
   ```

2. Verify MyanTerm picks up Padauk:
   ```bash
   fc-match Padauk
   # Should output: Padauk-Regular.ttf
   ```

3. Compare bundled Padauk vs system Padauk
   - Bundled: `public/fonts/Padauk-Regular.ttf`
   - System: `/usr/share/fonts/truetype/padauk/`

**Known Issues:**
- Some distros ship outdated Padauk (2.80 vs 3.003)
- Bundled font should always take precedence

---

## Compatibility Test Matrix (CT-01 to CT-14)

Run all compatibility tests on each platform:

| Test | Description | Windows | Linux | macOS |
|------|-------------|---------|-------|-------|
| CT-01 | Claude Code | ⬜ | ⬜ | ✅ |
| CT-02 | OpenCode | ⬜ | ⬜ | ✅ |
| CT-03 | vim ASCII | ⬜ | ⬜ | ✅ |
| CT-04 | vim Myanmar | ⬜ | ⬜ | ✅ |
| CT-05 | tmux nested | ⬜ | ⬜ | ✅ |
| CT-06 | lazygit | ⬜ | ⬜ | ✅ |
| CT-07 | btop | ⬜ | ⬜ | ✅ |
| CT-08 | fzf | ⬜ | ⬜ | ✅ |
| CT-09 | SSH local | ⬜ | ⬜ | ⬜ |
| CT-10 | SSH jump | ⬜ | ⬜ | ⬜ |
| CT-11 | Bracketed paste | ⬜ | ⬜ | ✅ |
| CT-12 | Throughput ASCII | ⬜ | ⬜ | ✅ |
| CT-13 | Throughput Myanmar | ⬜ | ⬜ | ✅ |
| CT-14 | Resize stress | ⬜ | ⬜ | ✅ |

---

## Performance Baselines

Target metrics (from PRD §1.5):

| Metric | Target | macOS | Windows | Linux |
|--------|--------|-------|---------|-------|
| Cold start | < 250ms | 180ms | ? | ? |
| Memory (1 tab) | < 150MB | 120MB | ? | ? |
| Memory (6 tabs) | < 400MB | 340MB | ? | ? |
| Frame time (ASCII) | < 4ms | 2.8ms | ? | ? |
| Frame time (Myanmar) | < 8ms | 6.2ms | ? | ? |
| `cat` throughput | > 50 MB/s | 78 MB/s | ? | ? |
| Scroll FPS | 60 (vsync) | 60 | ? | ? |

**Measurement Tools:**
```bash
# Cold start (macOS/Linux)
time pnpm tauri dev

# Memory (all platforms)
# Check Task Manager (Windows) / Activity Monitor (macOS) / htop (Linux)

# Throughput
pnpm test:perf
```

---

## Platform-Specific Bugs to Watch For

### Windows
- [ ] PowerShell UTF-8 encoding issues
- [ ] ConPTY dropping first character after resize
- [ ] WebView2 not installed (graceful error needed)
- [ ] Antivirus false positives (unsigned binary)

### Linux
- [ ] GTK theme conflicts (dark mode)
- [ ] WebKitGTK version mismatch (need >= 4.1)
- [ ] Wayland-specific clipboard issues
- [ ] AppImage FUSE dependency (use --appimage-extract-and-run)

### macOS
- [ ] M-series vs Intel binary size
- [ ] Gatekeeper blocking unsigned .dmg
- [ ] Notarization required for distribution

---

## Reporting Platform Issues

When filing a platform-specific bug:

1. **Title**: `[Platform] Brief description`
   - Example: `[Windows] ConPTY drops first character after resize`

2. **Labels**: `platform:windows`, `platform:linux`, or `platform:macos`

3. **Template**:
   ```markdown
   **Platform**: Windows 11 / Ubuntu 24.04 / macOS 15
   **MyanTerm Version**: 0.5.0-beta
   **Steps to Reproduce**:
   1. ...

   **Expected**: ...
   **Actual**: ...
   **Workaround**: (if any)
   **Logs**: (attach `logs/myanterm.log`)
   ```

---

## Next Steps

1. **T-044 to T-047**: Provision Windows VM, run all tests
2. **T-048, T-050**: Provision Ubuntu 24.04 VM, run all tests
3. **T-051 to T-052**: Set up code signing (requires certs)
4. **Document findings**: Update this file with results
5. **Tag v0.5.0-beta**: Once all platforms pass CT-01 to CT-08
