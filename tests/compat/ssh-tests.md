# SSH Compatibility Tests (CT-09, CT-10)

These are manual tests to verify SSH functionality works correctly in MyanTerm.

## Prerequisites

1. **Local SSH Server** (for CT-09)
   - macOS/Linux: SSH server should be enabled
   - macOS: System Settings → General → Sharing → Remote Login
   - Linux: `sudo systemctl start ssh`

2. **Jump Host Setup** (for CT-10)
   - Requires access to two SSH servers where one can act as jump host
   - Or use AWS/cloud VMs for testing

3. **SSH Keys**
   - Generate test key: `ssh-keygen -t ed25519 -f ~/.ssh/myanterm_test_key`
   - Add to authorized_keys on target hosts

## CT-09: SSH Local Connection

**Objective**: Verify MyanTerm can establish SSH connection to localhost and run all compatibility tests over SSH.

### Setup

```bash
# Enable SSH on localhost
# macOS: System Settings → Sharing → Remote Login
# Linux: sudo systemctl start ssh

# Add your public key to authorized_keys
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Test SSH works from terminal first
ssh localhost whoami
```

### Test Procedure

1. **Launch MyanTerm**
   ```bash
   pnpm tauri:dev
   ```

2. **Create SSH Profile**
   - Click "SSH" button (bottom right)
   - Click "Add Profile"
   - Fill in:
     - Name: "Localhost Test"
     - Host: "localhost"
     - User: (your username)
     - Port: 22
     - Identity File: `~/.ssh/id_ed25519` (or your key path)
   - Save

3. **Quick Connect**
   - Click "Localhost Test" profile
   - Click "Connect" or double-click profile
   - New tab should open with SSH session

4. **Verify Connection**
   ```bash
   # Should show your username
   whoami

   # Should show remote hostname
   hostname

   # Should show SSH connection in environment
   echo $SSH_CONNECTION
   ```

5. **Run Compatibility Tests Over SSH**

   **CT-01: Claude Code**
   ```bash
   # If claude is installed
   claude
   # Type Myanmar text in prompt
   # Paste 50-line code block
   # Verify: renders correctly, paste arrives as one block
   ```

   **CT-02: OpenCode**
   ```bash
   # If opencode is installed
   opencode
   # Complete a task
   ```

   **CT-03: vim ASCII**
   ```bash
   vim test.txt
   # Edit some text
   # Verify: colors work, cursor shape changes, alt screen works
   :q
   ```

   **CT-04: vim Myanmar**
   ```bash
   # Create test file with Myanmar text
   echo "မြန်မာဘာသာစာ" > myanmar.txt
   vim myanmar.txt
   # Navigate with hjkl
   # Verify: cursor lands on syllable boundaries, no corruption
   :q
   ```

   **CT-05: tmux nested**
   ```bash
   tmux new
   # Inside tmux, run:
   vim test.txt
   # Exit vim, then:
   lazygit  # if installed
   htop
   # Verify all work inside tmux
   ```

   **CT-06: lazygit**
   ```bash
   cd /path/to/git/repo
   lazygit
   # Scroll diff, stage hunks
   # Verify: mouse works, colors correct, no flicker
   q
   ```

   **CT-07: btop**
   ```bash
   btop
   # Let run for 60 seconds
   # Verify: smooth refresh, gradients render, mouse works
   q
   ```

   **CT-08: fzf**
   ```bash
   find . | fzf
   # Type to filter
   # Verify: type-ahead responsive, alt screen restored on exit
   ESC
   ```

   **CT-11: Bracketed paste**
   ```bash
   # Copy 1000 lines of code
   # Paste into bash
   # Verify: arrives as paste event, not executed line-by-line
   ```

   **CT-12: Throughput ASCII**
   ```bash
   # Generate large ASCII file
   seq 1 1000000 > large.txt
   time cat large.txt
   # Verify: completes < 5s, no dropped frames
   ```

   **CT-13: Throughput Myanmar**
   ```bash
   # Generate Myanmar text file
   python3 -c "print('မြန်မာဘာသာစာ ' * 100000)" > myanmar_large.txt
   time cat myanmar_large.txt
   # Verify: completes < 1s, smooth scroll
   ```

   **CT-14: Resize stress**
   ```bash
   vim
   # Drag window to resize rapidly for 30s
   # Verify: no crash, reflow correct, no orphaned cells
   ```

### Acceptance Criteria

- ✅ SSH connection established successfully
- ✅ SSH environment variables present ($SSH_CONNECTION)
- ✅ All CT-01 to CT-08, CT-11 to CT-14 pass over SSH
- ✅ No visual corruption or crashes
- ✅ Performance matches local terminal

### Known Issues

Document any issues found:
- [ ] Issue 1: ...
- [ ] Issue 2: ...

---

## CT-10: SSH Jump Host

**Objective**: Verify MyanTerm can connect through a jump host (ProxyCommand/ProxyJump).

### Setup

You need two SSH servers:
- **Jump Host**: Intermediate server you can SSH to
- **Target Host**: Final destination behind jump host

```bash
# Test jump connection works from regular terminal first
ssh -J jump.example.com target.example.com whoami

# Or using ProxyCommand
ssh -o ProxyCommand="ssh -W %h:%p jump.example.com" target.example.com whoami
```

### Test Procedure

1. **Launch MyanTerm**
   ```bash
   pnpm tauri:dev
   ```

2. **Create Jump Host Profile**
   - Click "SSH" button
   - Click "Add Profile"
   - Fill in:
     - Name: "Target via Jump"
     - Host: "target.example.com"
     - User: (your username)
     - Jump Host: "jump.example.com"
     - Identity File: `~/.ssh/id_ed25519`
   - Save

3. **Quick Connect**
   - Click profile
   - Click "Connect"
   - Should see two authentication prompts (jump, then target)
   - New tab opens with SSH session on target

4. **Verify Connection**
   ```bash
   # Should show target hostname (not jump host)
   hostname

   # Should show you're connected via SSH
   echo $SSH_CONNECTION

   # Verify you're on the target host
   whoami
   ```

5. **Run Basic Tests**
   - Run CT-03 (vim ASCII)
   - Run CT-04 (vim Myanmar)
   - Run CT-08 (fzf)
   - Verify performance is acceptable (some latency expected)

### Alternative: Using ~/.ssh/config

If you have jump host configured in `~/.ssh/config`:

```
# ~/.ssh/config
Host target-via-jump
    HostName target.example.com
    User youruser
    ProxyJump jump.example.com
    IdentityFile ~/.ssh/id_ed25519
```

In MyanTerm:
1. Create profile with Host: "target-via-jump"
2. MyanTerm should read ~/.ssh/config and autocomplete
3. Connect normally

### Acceptance Criteria

- ✅ Jump host connection established
- ✅ Final connection reaches target host (not jump)
- ✅ vim and fzf work through jump connection
- ✅ Myanmar text renders correctly through jump
- ✅ No authentication errors or connection drops

### Known Issues

Document any issues found:
- [ ] Issue 1: ...
- [ ] Issue 2: ...

---

## Test Results Summary

| Test | Local | Jump | Status | Notes |
|------|-------|------|--------|-------|
| CT-01: Claude Code | ⬜ | ⬜ | | |
| CT-02: OpenCode | ⬜ | ⬜ | | |
| CT-03: vim ASCII | ⬜ | ⬜ | | |
| CT-04: vim Myanmar | ⬜ | ⬜ | | |
| CT-05: tmux nested | ⬜ | N/A | | |
| CT-06: lazygit | ⬜ | N/A | | |
| CT-07: btop | ⬜ | N/A | | |
| CT-08: fzf | ⬜ | ⬜ | | |
| CT-11: Bracketed paste | ⬜ | N/A | | |
| CT-12: Throughput ASCII | ⬜ | N/A | | |
| CT-13: Throughput Myanmar | ⬜ | N/A | | |
| CT-14: Resize stress | ⬜ | N/A | | |

## Automated Test Script

While these tests are primarily manual, you can automate the connection verification:

```bash
#!/bin/bash
# tests/compat/ssh-automated-check.sh

set -e

echo "=== CT-09: SSH Localhost Test ==="

# Test SSH works from terminal
if ! ssh -o ConnectTimeout=5 localhost whoami &>/dev/null; then
    echo "❌ SSH to localhost failed. Enable SSH server first."
    exit 1
fi
echo "✅ SSH to localhost works from terminal"

# TODO: Add MyanTerm-specific tests when automation API available
# For now, these must be run manually in the MyanTerm UI

echo ""
echo "=== CT-10: SSH Jump Host Test ==="
echo "⚠️  Requires manual setup with jump host credentials"
echo "See ssh-tests.md for detailed instructions"

echo ""
echo "✅ Automated checks passed. Continue with manual testing."
```

Make executable:
```bash
chmod +x tests/compat/ssh-automated-check.sh
```

## Troubleshooting

### Connection Refused
```bash
# Check SSH server is running
# macOS:
sudo systemsetup -getremotelogin

# Linux:
sudo systemctl status ssh
```

### Authentication Failed
```bash
# Verify key is added to authorized_keys
cat ~/.ssh/authorized_keys | grep "$(cat ~/.ssh/id_ed25519.pub)"

# Check permissions
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
chmod 600 ~/.ssh/id_ed25519
```

### Jump Host Not Working
```bash
# Test jump manually first
ssh -J jump.example.com target.example.com echo "Jump works"

# Check ~/.ssh/config syntax
ssh -G target-via-jump
```

### Myanmar Text Not Rendering
- Check Padauk font is installed
- Verify Myanmar IME is enabled
- Test in local terminal first to isolate issue

## Next Steps After CT-09/CT-10 Pass

1. Mark T-038 as complete in TASKS.md
2. Document any issues found in GitHub issues
3. Proceed to T-043: Tag v0.5.0-beta
4. Update Phase 2 completion to 100%
