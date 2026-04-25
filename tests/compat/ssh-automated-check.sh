#!/bin/bash
# Automated SSH connectivity check for MyanTerm
# Part of CT-09 and CT-10 acceptance testing

set -e

echo "==================================="
echo "MyanTerm SSH Compatibility Check"
echo "==================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test CT-09: SSH Localhost
echo "=== CT-09: SSH Localhost Connection ==="
echo ""

# Check if SSH server is running
if command -v systemctl &> /dev/null; then
    # Linux
    if systemctl is-active --quiet ssh || systemctl is-active --quiet sshd; then
        echo -e "${GREEN}✅${NC} SSH server is running (Linux)"
    else
        echo -e "${RED}❌${NC} SSH server not running. Start with: sudo systemctl start ssh"
        exit 1
    fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    if sudo systemsetup -getremotelogin | grep -q "On"; then
        echo -e "${GREEN}✅${NC} Remote Login is enabled (macOS)"
    else
        echo -e "${RED}❌${NC} Remote Login disabled. Enable in: System Settings → Sharing → Remote Login"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️${NC}  Cannot detect SSH server status on this OS"
fi

# Test SSH connection to localhost
echo ""
echo "Testing SSH connection to localhost..."
if ssh -o ConnectTimeout=5 -o BatchMode=yes localhost whoami &>/dev/null; then
    echo -e "${GREEN}✅${NC} SSH to localhost successful"
    SSH_USER=$(ssh -o ConnectTimeout=5 -o BatchMode=yes localhost whoami 2>/dev/null)
    echo "   Connected as: $SSH_USER"
else
    echo -e "${RED}❌${NC} SSH to localhost failed"
    echo ""
    echo "Possible fixes:"
    echo "1. Add your public key to authorized_keys:"
    echo "   cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys"
    echo "   chmod 600 ~/.ssh/authorized_keys"
    echo ""
    echo "2. Or generate and add a new key:"
    echo "   ssh-keygen -t ed25519 -f ~/.ssh/myanterm_test_key"
    echo "   cat ~/.ssh/myanterm_test_key.pub >> ~/.ssh/authorized_keys"
    exit 1
fi

# Check SSH keys exist
echo ""
echo "Checking SSH keys..."
if [ -f ~/.ssh/id_ed25519 ] || [ -f ~/.ssh/id_rsa ]; then
    echo -e "${GREEN}✅${NC} SSH keys found"
    ls -1 ~/.ssh/id_* 2>/dev/null | grep -v ".pub" | head -3
else
    echo -e "${YELLOW}⚠️${NC}  No SSH keys found in ~/.ssh/"
    echo "   Generate with: ssh-keygen -t ed25519"
fi

# Check authorized_keys
echo ""
echo "Checking authorized_keys..."
if [ -f ~/.ssh/authorized_keys ]; then
    KEY_COUNT=$(wc -l < ~/.ssh/authorized_keys)
    echo -e "${GREEN}✅${NC} authorized_keys exists ($KEY_COUNT keys)"
else
    echo -e "${YELLOW}⚠️${NC}  No authorized_keys file found"
fi

echo ""
echo "=== CT-10: SSH Jump Host Connection ==="
echo ""
echo -e "${YELLOW}⚠️${NC}  Jump host testing requires manual setup"
echo ""
echo "Prerequisites:"
echo "  1. Access to a jump host (bastion server)"
echo "  2. Access to a target host behind the jump"
echo "  3. SSH keys configured on both hosts"
echo ""
echo "Test manually with:"
echo "  ssh -J jump.example.com target.example.com whoami"
echo ""
echo "Then test in MyanTerm using the SSH profile manager."
echo ""

# Summary
echo "==================================="
echo "Summary"
echo "==================================="
echo ""
if ssh -o ConnectTimeout=5 -o BatchMode=yes localhost whoami &>/dev/null; then
    echo -e "${GREEN}✅ CT-09 Prerequisites: READY${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Launch MyanTerm: pnpm tauri:dev"
    echo "2. Open SSH profile manager (click 'SSH' button)"
    echo "3. Create profile for localhost"
    echo "4. Connect and run compatibility tests"
    echo "5. See tests/compat/ssh-tests.md for detailed test procedures"
else
    echo -e "${RED}❌ CT-09 Prerequisites: NOT READY${NC}"
    echo "Fix SSH issues above before testing in MyanTerm"
fi

echo ""
echo -e "${YELLOW}⚠️  CT-10 Prerequisites: MANUAL SETUP REQUIRED${NC}"
echo ""
