# Distribution Guide

How to package and distribute Artaka as a standalone executable.

---

## 🎯 Distribution Strategy

**Target audience:** Developers and documentation enthusiasts
**Distribution method:** Standalone executable (no Node.js required)
**Privacy:** 100% local, offline-first

---

## 📦 Building Executables

### Prerequisites

```bash
npm install
npm install -g pkg
```

### Build All Platforms

```bash
npm run build
```

This creates:
```
dist/
├── artaka-win.exe     (~50MB) - Windows 64-bit
├── artaka-macos       (~50MB) - macOS 64-bit
└── artaka-linux       (~50MB) - Linux 64-bit
```

### Build Single Platform

```bash
npm run build:win      # Windows only
npm run build:mac      # macOS only
npm run build:linux    # Linux only
```

---

## 📂 Creating Release Package

### Step 1: Build Executables

```bash
npm run build
```

### Step 2: Create Release Folder

```
artaka-v1.0.0/
├── artaka.exe (or artaka binary)
├── .env.example
├── README.md
├── LICENSE
├── QUICKSTART.md
└── db/
    └── .gitkeep (empty folder for database)
```

### Step 3: Create Quickstart Guide

`QUICKSTART.md`:
```markdown
# Artaka Quick Start

## 1. Setup

1. Copy `.env.example` to `.env`
2. Edit `.env` with your settings:
   - Set `LM_COMPL_URL` (LM Studio endpoint)
   - Set `DB_PATH=./db/file_data.db`
3. Start LM Studio with required models

## 2. First Run

```bash
# Windows
artaka.exe tag ./test-folder

# Mac/Linux
./artaka tag ./test-folder
```

## 3. Common Commands

```bash
artaka tag <path>           # Tag files
artaka search <query>       # Search
artaka save <note>          # Save knowledge
artaka help                 # Show help
```

See README.md for full documentation.
```

### Step 4: Zip for Distribution

```bash
# Windows
Compress-Archive -Path artaka-v1.0.0 -DestinationPath artaka-v1.0.0-win.zip

# Mac/Linux
tar -czf artaka-v1.0.0-macos.tar.gz artaka-v1.0.0/
tar -czf artaka-v1.0.0-linux.tar.gz artaka-v1.0.0/
```

---

## 🚀 Distribution Channels

### Option 1: GitHub Releases

1. Create GitHub repo
2. Tag version: `git tag v1.0.0`
3. Push tag: `git push origin v1.0.0`
4. Upload binaries to release
5. Write release notes

**Download links:**
```
https://github.com/yourusername/artaka/releases/download/v1.0.0/artaka-v1.0.0-win.zip
https://github.com/yourusername/artaka/releases/download/v1.0.0/artaka-v1.0.0-macos.tar.gz
```

### Option 2: Personal Website

Host downloads:
```
https://yoursite.com/downloads/artaka-v1.0.0-win.zip
https://yoursite.com/downloads/artaka-v1.0.0-macos.tar.gz
```

### Option 3: npm (CLI Tool)

For developers who prefer npm:
```bash
npm publish
```

Users install:
```bash
npm install -g artaka
```

---

## 🔐 Code Signing (Optional but Recommended)

### Windows

Sign the `.exe` to avoid SmartScreen warnings:

```bash
# Get a code signing certificate
# Use signtool.exe (from Windows SDK)
signtool sign /f certificate.pfx /p password /t http://timestamp.server artaka.exe
```

### macOS

Sign and notarize:

```bash
# Sign
codesign --force --deep --sign "Developer ID" artaka

# Notarize (submit to Apple)
xcrun notarytool submit artaka.zip --apple-id you@email.com --password app-specific-password --team-id TEAMID
```

---

## 📊 File Size Optimization

Current sizes (~50MB per platform) can be reduced:

### Option 1: UPX Compression

```bash
npm install -g upx

upx --best dist/artaka-win.exe
# Reduces to ~20-30MB
```

**Pros:** Much smaller
**Cons:** Slower startup, antivirus may flag it

### Option 2: Bundle Only Used Dependencies

Edit `package.json` `pkg.assets` to exclude unnecessary files.

### Option 3: Use Lighter Runtime

Use `node18-alpine` target (Linux only):
```bash
pkg . --targets node18-alpine-x64
```

---

## 🧪 Testing the Distribution

Before releasing, test on clean machines:

### Windows
1. Fresh VM or clean machine
2. No Node.js installed
3. Extract zip
4. Run `artaka.exe help`
5. Test basic commands

### macOS
1. Test on both Intel and M1 Macs
2. Check for security warnings
3. Verify all commands work

### Linux
1. Test on Ubuntu, Fedora, Arch
2. Check library dependencies:
   ```bash
   ldd artaka
   ```

---

## 📋 Release Checklist

Before each release:

- [ ] Update version in `package.json`
- [ ] Update version in `cli.js`
- [ ] Update CHANGELOG.md
- [ ] Test all commands work
- [ ] Build all platforms
- [ ] Test on clean machines
- [ ] Update README.md if needed
- [ ] Create GitHub release
- [ ] Upload binaries
- [ ] Write release notes
- [ ] Announce (Twitter, Reddit, etc.)

---

## 🎁 What Users Download

### Minimal Package (Recommended)

Users download:
- Executable (~50MB)
- `.env.example`
- README.md

They provide:
- LM Studio (or API key)
- Environment configuration

### Full Package (Optional)

Include everything:
- Executable
- Sample models (if small)
- Pre-configured .env
- Sample database

**Pros:** Works out of box
**Cons:** Much larger download (GB+)

---

## 🔄 Auto-Updates (Future)

Consider adding auto-update capability:

1. Check GitHub API for latest release
2. Prompt user to download
3. Or use `electron-updater` if switching to Electron

---

## 📈 Distribution Metrics

Track (privacy-respecting):
- GitHub release downloads
- npm package downloads
- Issues/questions frequency

**Do NOT track:**
- User data
- Usage patterns
- Personal information

---

## 💡 Marketing the Release

### GitHub
- Good README with GIFs/screenshots
- Clear installation instructions
- "Releases" section with binaries

### Community
- Share on: Reddit (r/programming, r/productivity)
- Hacker News (Show HN)
- Dev.to article
- Twitter/X announcement

### Documentation
- Video tutorial (YouTube)
- Blog post explaining use cases
- Comparison with alternatives

---

## 🆘 Support Strategy

### Self-Service
- Comprehensive README
- Quickstart guide
- FAQ section
- Troubleshooting guide

### Community Support
- GitHub Discussions enabled
- Issue templates
- Discord server (optional)

### Response Time
- Critical bugs: 24-48 hours
- Features: No SLA (open source)
- Questions: Best effort

---

## 🎉 Launch Announcement Template

```markdown
🚀 Introducing Artaka v1.0.0

AI-powered knowledge management that runs 100% locally.

✨ Features:
- Tag files automatically using AI
- Semantic search (find by meaning, not keywords)
- Save procedures and commands
- Privacy-first: your data never leaves your machine

📦 Download: [GitHub Releases](link)
📖 Docs: [README](link)
🔓 Open source, MIT license

Perfect for devs managing lots of docs, internal wikis, and notes.

Try it out and let me know what you think! 🙏
```

---

## 🔮 Future Distribution Improvements

- [ ] Homebrew formula (macOS)
- [ ] Chocolatey package (Windows)
- [ ] Snap/Flatpak (Linux)
- [ ] Docker image
- [ ] Web-based version
- [ ] Mobile apps (future)

---

**Remember:** The goal is to make it easy for users while respecting their privacy!
