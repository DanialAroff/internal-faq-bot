# Artaka

> AI-powered knowledge management for developers and documentation enthusiasts. Tag files, search semantically, save procedures. **100% local, privacy-first.**

---

## 🎯 What is Artaka?

Artaka helps you manage large collections of documents, code, and notes using AI:

- **Tag files automatically** - Extract meaningful tags from PDFs, docs, images, code
- **Semantic search** - Find information by meaning, not just keywords
- **Save knowledge** - Store deployment steps, commands, procedures
- **Update & delete** - Keep your knowledge base fresh
- **100% offline** - Your data never leaves your machine

Perfect for:
- Developers with lots of documentation
- Teams maintaining internal wikis
- Anyone drowning in PDFs and notes
- Privacy-conscious users

---

## 🚀 Quick Start

### Option 1: Download Executable (No Node.js Required)

1. Download the latest release for your platform:
   - Windows: `artaka-win.exe`
   - macOS: `artaka-macos`
   - Linux: `artaka-linux`

2. Create a `.env` file (copy from `.env.example`)

3. Start LM Studio or configure OpenRouter API

4. Run commands:
   ```bash
   artaka tag ./documents
   artaka search "deployment steps"
   ```

### Option 2: Install via npm (Requires Node.js)

```bash
npm install -g artaka
artaka help
```

---

## 📖 Usage

### Tag Files

```bash
# Tag a single file
artaka tag ./document.pdf

# Tag a directory
artaka tag ./my-documents

# Tag with description
artaka tag ./readme.md "Project documentation"
```

### Search Knowledge

```bash
# Search by meaning
artaka search "how to deploy backend"

# Find specific info
artaka search "database backup procedure"
```

### Save Knowledge

```bash
# Save a quick note
artaka save "Deploy frontend: npm run build && upload to S3"

# Save with explicit title
artaka save "Title: Restart Server. Command: pm2 restart all"
```

### Update Entries

```bash
# Update file tags
artaka update ./document.pdf

# Update knowledge entry
artaka update "Deployment Steps" with new content
```

### Delete Entries

```bash
# Delete file from index
artaka delete ./old-file.pdf

# Delete knowledge entry
artaka delete "Outdated Procedure"
```

---

## ⚙️ Configuration

### 1. Create `.env` File

Copy `.env.example` to `.env` and configure:

```bash
# LLM Settings (using LM Studio)
LM_COMPL_URL=http://127.0.0.1:1234/v1/chat/completions
LM_EMBEDDING_URL=http://127.0.0.1:1234/v1/embeddings
ROUTER_MODEL=qwen3-0.6b
TAGGER_MODEL=qwen/qwen3-1.7b
EMBEDDING_MODEL=text-embedding-embeddinggemma-300m

# Database
DB_PATH=./db/file_data.db

# Local or API
USE_LOCAL=true

# Thresholds
SIMILARITY_THRESHOLD=0.4
KNOWLEDGE_DEDUP_THRESHOLD=0.9
TRUNCATION_LENGTH=2000

# Retry
MAX_RETRIES=3
RETRY_DELAY_MS=1000
```

### 2. Choose LLM Backend

**Option A: LM Studio (Recommended - Free & Local)**

1. Download [LM Studio](https://lmstudio.ai/)
2. Load models:
   - Router: `qwen3-0.6b` or similar small model
   - Tagger: `qwen3-1.7b` or `gemma-3-1b`
   - Embeddings: `text-embedding-embeddinggemma-300m`
3. Start local server (port 1234)

**Option B: OpenRouter API**

1. Get API key from [OpenRouter](https://openrouter.ai/)
2. Set in `.env`:
   ```bash
   USE_LOCAL=false
   OPENROUTER_API_KEY=sk-or-v1-...
   OR_TAGGER_MODEL=qwen/qwen3-4b:free
   ```

---

## 🏗️ Architecture

```
User Input
    ↓
Router (classifies intent)
    ↓
┌─────────┬──────────┬──────────┬──────────┐
│   Tag   │  Search  │   Save   │  Update  │
└─────────┴──────────┴──────────┴──────────┘
    ↓           ↓          ↓         ↓
Extract    Embedding  Embedding  Re-tag
Content    Search     Storage    & Save
    ↓           ↓          ↓         ↓
Generate   SQLite    SQLite    SQLite
Tags       Database  Database  Database
```

### Key Features:

- **Two-stage deduplication**: Exact title match + semantic similarity
- **Retry logic**: Automatic retries with exponential backoff
- **Singleton DB**: Single database connection, reused everywhere
- **Configurable thresholds**: All via environment variables
- **Error handling**: Graceful failures, detailed logging

---

## 📁 Supported File Types

- **Text**: .txt, .md, .csv
- **Documents**: .pdf, .docx
- **Spreadsheets**: .xlsx, .xls
- **Images**: .jpg, .jpeg, .png, .webp (requires vision model)
- **Code**: Any text-based file

---

## 🔒 Privacy & Security

- **100% local**: No data sent to cloud (when using LM Studio)
- **No tracking**: No analytics, no telemetry
- **Your data, your control**: Database stored locally
- **Open source**: Audit the code yourself

If using OpenRouter, data is sent to their API (encrypted in transit).

---

## 🛠️ Development

### Build from Source

```bash
# Clone repo
git clone https://github.com/yourusername/artaka.git
cd artaka

# Install dependencies
npm install

# Run in development
node cli.js tag ./test

# Build executables
npm run build          # All platforms
npm run build:win      # Windows only
npm run build:mac      # macOS only
npm run build:linux    # Linux only
```

### Project Structure

```
artaka/
├── ai/
│   ├── ai.js           # Router & action dispatcher
│   ├── tagger.js       # File tagging
│   ├── searcher.js     # Semantic search
│   ├── saveknowledge.js # Save entries
│   ├── updater.js      # Update operations
│   ├── deleter.js      # Delete operations
│   └── embedding.js    # Generate embeddings
├── utils/
│   ├── db.js           # Database singleton
│   ├── config.js       # Config validation
│   ├── retry.js        # Retry logic
│   ├── utils.js        # Helpers
│   └── extractContent.js # File extraction
├── prompts/
│   └── router.md       # Router instructions
├── cli.js              # CLI interface
└── index.js            # Direct script usage
```

---

## 🤝 Contributing

Contributions welcome! Areas for improvement:

- [ ] Web UI frontend
- [ ] More file type support
- [ ] Advanced search filters
- [ ] Export/import functionality
- [ ] Batch operations
- [ ] Tests

---

## 📄 License

MIT License - see LICENSE file

---

## 🙏 Credits

Built with:
- [LM Studio](https://lmstudio.ai/) - Local LLM inference
- [sqlite3](https://github.com/TryGhost/node-sqlite3) - Database
- [mammoth](https://github.com/mwilliamson/mammoth.js) - DOCX parsing
- [pdf-parse](https://github.com/modesty/pdf-parse) - PDF extraction

---

## 📞 Support

- Issues: [GitHub Issues](https://github.com/yourusername/artaka/issues)
- Docs: See `docs/` folder
- Examples: See `.env.example` and usage section

---

**Artaka** - Your personal AI knowledge companion. Made with ❤️ by Danial Harith.
