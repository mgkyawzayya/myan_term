# Code Signing Setup Guide — MyanTerm

This guide covers setting up code signing for MyanTerm releases across all three platforms.

## Overview

Code signing is required for:
- **macOS**: App notarization (required for Gatekeeper)
- **Windows**: SmartScreen trust (optional but recommended)
- **Linux**: No code signing (use GPG signatures for package repos)

---

## macOS Code Signing (T-051)

### Prerequisites

1. **Apple Developer Account** ($99/year)
   - Enroll at: https://developer.apple.com/programs/

2. **Developer ID Certificate**
   - Type: "Developer ID Application"
   - Used for: Signing apps distributed outside the Mac App Store

### Step 1: Generate Certificate

1. Log in to [Apple Developer Console](https://developer.apple.com/account/resources/certificates/list)
2. Click "+" to create new certificate
3. Select "Developer ID Application"
4. Follow CSR generation steps (use Keychain Access)
5. Download certificate, double-click to install in Keychain

### Step 2: Get Team ID

```bash
# List your teams
xcrun altool --list-providers -u "your-apple-id@example.com" -p "@keychain:AC_PASSWORD"

# Output will show:
# ProviderName       ProviderShortname   PublicID
# Your Name          TEAM123456         12345abcde-...

# Your Team ID is TEAM123456
```

### Step 3: Configure Tauri

Edit `src-tauri/tauri.conf.json`:

```json
{
  "bundle": {
    "macOS": {
      "signingIdentity": "Developer ID Application: Your Name (TEAM123456)",
      "entitlements": null,
      "exceptionDomain": "",
      "frameworks": [],
      "providerShortName": "TEAM123456",
      "signingIdentity": "Developer ID Application: Your Name (TEAM123456)"
    }
  }
}
```

### Step 4: Set Up App-Specific Password

1. Go to https://appleid.apple.com/account/manage
2. Generate an app-specific password
3. Label it "MyanTerm Notarization"
4. Store in Keychain:

```bash
xcrun notarytool store-credentials "myanterm-notary" \
  --apple-id "your-apple-id@example.com" \
  --team-id "TEAM123456" \
  --password "xxxx-xxxx-xxxx-xxxx"
```

### Step 5: Build & Notarize

```bash
# Build signed .dmg
pnpm tauri build

# Notarize (Tauri 2 does this automatically if credentials are set)
# Or manually:
xcrun notarytool submit \
  src-tauri/target/release/bundle/dmg/MyanTerm_0.5.0_aarch64.dmg \
  --keychain-profile "myanterm-notary" \
  --wait

# Staple notarization ticket
xcrun stapler staple src-tauri/target/release/bundle/dmg/MyanTerm_0.5.0_aarch64.dmg
```

### Step 6: CI Setup (GitHub Actions)

Add repository secrets:
- `APPLE_CERTIFICATE`: Base64-encoded .p12 file
- `APPLE_CERTIFICATE_PASSWORD`: Certificate password
- `APPLE_SIGNING_IDENTITY`: "Developer ID Application: Your Name (TEAM123456)"
- `APPLE_ID`: Your Apple ID email
- `APPLE_PASSWORD`: App-specific password
- `APPLE_TEAM_ID`: TEAM123456

Example workflow snippet:

```yaml
- name: Import certificate
  env:
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
    APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
  run: |
    echo $APPLE_CERTIFICATE | base64 --decode > certificate.p12
    security create-keychain -p actions temp.keychain
    security import certificate.p12 -k temp.keychain -P $APPLE_CERTIFICATE_PASSWORD -T /usr/bin/codesign
    security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k actions temp.keychain

- name: Build and notarize
  env:
    APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
  run: pnpm tauri build
```

### Verification

```bash
# Verify signature
codesign -dv --verbose=4 src-tauri/target/release/bundle/macos/MyanTerm.app

# Verify notarization
spctl -a -vv -t install src-tauri/target/release/bundle/dmg/MyanTerm_0.5.0_aarch64.dmg
```

**Expected output:**
```
source=Notarized Developer ID
accepted
```

---

## Windows Code Signing (T-052)

### Prerequisites

1. **Code Signing Certificate**
   - Options:
     - **Sectigo** ($84/year for individuals) — Recommended
     - **DigiCert** ($369/year)
     - **SSL.com** ($79/year)
   - Type: "Code Signing Certificate" (not EV)

2. **Certificate Format**
   - You'll receive a `.pfx` or `.p12` file + password

### Step 1: Purchase Certificate

1. Go to [Sectigo Code Signing](https://sectigo.com/ssl-certificates-tls/code-signing)
2. Select "Code Signing Certificate"
3. Complete validation (may take 1-3 business days)
4. Download certificate as `.pfx`

### Step 2: Configure Tauri

Edit `src-tauri/tauri.conf.json`:

```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.sectigo.com"
    }
  }
}
```

### Step 3: Sign Locally

```powershell
# Set environment variables
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -Path ".\certificate.pfx" -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "your-cert-password"

# Build signed installer
pnpm tauri build
```

**Alternative: Use signtool.exe directly**

```powershell
# Sign .exe
& "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe" sign `
  /f certificate.pfx `
  /p "your-password" `
  /tr http://timestamp.sectigo.com `
  /td SHA256 `
  /fd SHA256 `
  src-tauri\target\release\myanterm.exe

# Sign .msi
signtool.exe sign /f certificate.pfx /p "your-password" /tr http://timestamp.sectigo.com /td SHA256 /fd SHA256 src-tauri\target\release\bundle\msi\MyanTerm_0.5.0_x64_en-US.msi
```

### Step 4: CI Setup (GitHub Actions)

Add repository secrets:
- `WINDOWS_CERTIFICATE`: Base64-encoded .pfx file
- `WINDOWS_CERTIFICATE_PASSWORD`: Certificate password

Example workflow snippet:

```yaml
- name: Decode certificate
  run: |
    echo "${{ secrets.WINDOWS_CERTIFICATE }}" | base64 --decode > certificate.pfx

- name: Build and sign
  env:
    TAURI_SIGNING_PRIVATE_KEY: certificate.pfx
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}
  run: pnpm tauri build
```

### Verification

```powershell
# Verify signature
signtool.exe verify /pa /v src-tauri\target\release\myanterm.exe
```

**Expected output:**
```
Successfully verified: myanterm.exe
```

### SmartScreen Reputation

**Note**: Even with a valid signature, new certificates trigger SmartScreen warnings until the binary builds reputation. This takes time and downloads (Microsoft doesn't publish thresholds).

**Workaround for beta testers**:
1. Right-click installer → Properties → Unblock checkbox
2. Or: Run installer with `Start-Process -Wait .\installer.msi -ArgumentList '/quiet'`

---

## Linux "Code Signing" (T-049 extended)

Linux doesn't use code signing like macOS/Windows, but we should provide GPG signatures for package verification.

### Step 1: Generate GPG Key

```bash
# Generate key (if you don't have one)
gpg --full-generate-key
# Select: RSA, 4096 bits, no expiration
# Name: MyanTerm Release Key
# Email: release@myanterm.dev

# Export public key
gpg --armor --export release@myanterm.dev > myanterm-release.asc

# Publish to keyserver
gpg --keyserver keyserver.ubuntu.com --send-keys YOUR_KEY_ID
```

### Step 2: Sign Release Artifacts

```bash
# Sign .deb
dpkg-sig --sign builder myanterm_0.5.0_amd64.deb

# Sign .rpm
rpm --addsign myanterm-0.5.0-1.x86_64.rpm

# Sign .AppImage (GPG detached signature)
gpg --detach-sign --armor myanterm_0.5.0_amd64.AppImage
# Creates: myanterm_0.5.0_amd64.AppImage.asc
```

### Step 3: CI Setup

Add repository secret:
- `GPG_PRIVATE_KEY`: `gpg --armor --export-secret-keys YOUR_KEY_ID`
- `GPG_PASSPHRASE`: Key passphrase

Example workflow snippet:

```yaml
- name: Import GPG key
  run: |
    echo "${{ secrets.GPG_PRIVATE_KEY }}" | gpg --import
    echo "${{ secrets.GPG_PASSPHRASE }}" | gpg --batch --yes --passphrase-fd 0 --sign test.txt

- name: Sign Linux packages
  run: |
    for file in src-tauri/target/release/bundle/*/*.{deb,rpm,AppImage}; do
      gpg --detach-sign --armor "$file"
    done
```

### Verification

```bash
# Import public key
curl -sSL https://github.com/mgkyawzayya/myan_term/releases/download/myanterm-release.asc | gpg --import

# Verify signature
gpg --verify myanterm_0.5.0_amd64.AppImage.asc myanterm_0.5.0_amd64.AppImage
```

---

## Tauri Auto-Updater Signing (All Platforms)

MyanTerm uses `tauri-plugin-updater`, which requires Ed25519 signatures (separate from platform code signing).

### Already Configured

✅ The public key is already set in `src-tauri/tauri.conf.json`:

```json
{
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDI4OTY2MUIxOTU2MjJGNTcKUldSNDJDWStpYzNwZE00RlBQbGNFRW9KaUV3YnpVbFVxOTIrUnMzRGxDcitKbWU1SlFSNno1VFgK",
      "endpoints": [
        "https://github.com/mgkyawzayya/myan_term/releases/latest/download/latest.json"
      ]
    }
  }
}
```

### Signing Updates (Already Done in release.yml)

The release workflow already handles this:

```yaml
- name: Build and publish release
  uses: tauri-apps/tauri-action@v0
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
```

**Secrets Required:**
- `TAURI_SIGNING_PRIVATE_KEY`: Generated once with `pnpm tauri signer generate`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: Passphrase for the key

---

## Summary Checklist

### macOS (T-051)
- [ ] Enroll in Apple Developer Program ($99/year)
- [ ] Generate Developer ID Application certificate
- [ ] Store app-specific password in Keychain
- [ ] Add secrets to GitHub repo
- [ ] Test local build + notarization
- [ ] Verify CI workflow produces notarized .dmg

### Windows (T-052)
- [ ] Purchase code signing certificate ($84-369/year)
- [ ] Download .pfx file + password
- [ ] Add secrets to GitHub repo
- [ ] Test local build + signing
- [ ] Verify CI workflow produces signed .msi/.exe
- [ ] Accept SmartScreen reputation will take time

### Linux (T-049 extended)
- [ ] Generate GPG key for releases
- [ ] Publish public key to keyserver
- [ ] Add GPG secrets to GitHub repo
- [ ] Sign all package formats (.deb, .rpm, .AppImage)

### Tauri Updater (Already Done)
- [x] Ed25519 keypair generated
- [x] Public key in tauri.conf.json
- [x] Private key in GitHub secrets
- [x] Release workflow signs update manifests

---

## Cost Summary

| Item | Cost | Frequency | Required |
|------|------|-----------|----------|
| Apple Developer | $99 | Annual | Yes (for macOS) |
| Windows Cert (Sectigo) | $84 | Annual | Recommended |
| Linux GPG | Free | - | Optional |
| **Total (Year 1)** | **$183** | - | - |

**Note**: These are costs for the project owner. Contributors don't need certificates.

---

## Troubleshooting

### macOS: "Developer cannot be verified"

**Cause**: App not notarized or stapled.

**Fix**:
```bash
xcrun stapler staple MyanTerm.app
```

### Windows: "Windows protected your PC"

**Cause**: Unsigned binary OR new certificate without reputation.

**Fix**:
- If unsigned: Sign the binary
- If signed but new cert: Wait for reputation OR advise users to click "More info" → "Run anyway"

### Linux: "Signature verification failed"

**Cause**: Public key not imported OR wrong key used.

**Fix**:
```bash
gpg --keyserver keyserver.ubuntu.com --recv-keys YOUR_KEY_ID
gpg --verify file.asc file
```

---

## Next Steps

1. **T-051**: Set up Apple Developer account, generate certificate
2. **T-052**: Purchase Windows code signing cert, test signing
3. **Update CI**: Add all secrets to GitHub repo settings
4. **Test Release**: Create a draft release, verify all artifacts are signed
5. **Document**: Update README with verification instructions for users
