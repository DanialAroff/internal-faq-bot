# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Artaka is an AI-powered knowledge management system that tags, indexes, and searches files using embeddings and vector similarity. It uses a router-based architecture where user prompts are parsed to determine actions.

**Status:** All core features complete! ✅
- Tag files, search knowledge, save/update/delete entries
- Two-stage deduplication, retry logic, error handling
- CLI interface, distribution ready

## 📚 Documentation Structure

**For comprehensive information, check these first (in docs/core/):**

1. **API.md** - Complete function reference
   - All modules and functions documented
   - Parameters, returns, examples
   - Environment variables reference
   - **Use this for:** Function signatures, what modules do

2. **ARCHITECTURE.md** - System design and data flow
   - High-level architecture diagrams
   - How each operation flows through the system
   - Database schema, embedding system
   - Design patterns used
   - **Use this for:** Understanding how things connect

3. **DECISIONS.md** - Why things are built this way
   - 12+ architecture decisions documented
   - Rationale, trade-offs, alternatives considered
   - **Use this for:** Understanding "why" not just "what"

4. **DISTRIBUTION.md** - How to package and distribute
   - Build executables, release process
   - **Use this for:** Packaging and deployment

**Only read code files when:**
- Docs don't have the answer
- Checking implementation details
- Making code changes
- Debugging specific issues

## Running the Application

```bash
# Main entry point
node index.js

# The application uses LM Studio or OpenRouter for LLM inference
# Configure endpoints in .env file
```

## Architecture

### Core Workflow

1. **Router (ai/ai.js)**: Entry point that parses user prompts and routes to appropriate actions
   - Uses `ask()` to send prompts to router model
   - Uses `takeAction()` to dispatch to specific modules based on router output
   - Supports three actions: `tag_files`, `search_knowledge`, `save_knowledge`

2. **Tagger (ai/tagger.js)**: Generates tags and descriptions for files
   - Processes files or directories recursively
   - Extracts content from various file types (txt, pdf, docx, xlsx, images)
   - Supports vision models for image tagging (VL_TAGGER_MODEL)
   - Generates embeddings and stores metadata in SQLite database
   - Currently has INSERT commented out (line 133-137)

3. **Searcher (ai/searcher.js)**: Semantic search using cosine similarity
   - Converts search query to embedding
   - Computes cosine similarity against all stored embeddings
   - Returns top K results with similarity scores > 0.4

4. **Save Knowledge (ai/saveknowledge.js)**: Stores text-based knowledge entries
   - Auto-generates missing metadata (title, tags, description) using LLM
   - Creates embeddings from combined text
   - Stores in knowledge_items table

### Database Schema

SQLite database at path specified in `.env` (DB_PATH):

```sql
CREATE TABLE knowledge_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    type TEXT,           -- "file" or "doc"
    path TEXT,           -- file path (for tagged files)
    tags TEXT,           -- JSON array of tags
    description TEXT,    -- short description
    content TEXT,        -- text content (for knowledge entries)
    embedding BLOB       -- Float32Array stored as buffer
)
```

### Utilities

- **utils/db.js**: Database connection and schema creation
- **utils/extractContent.js**: File content extraction for multiple formats (txt, md, csv, pdf, docx, xlsx)
- **utils/utils.js**:
  - `sanitize()`: Removes code fences and think tags from LLM output
  - `extension()`: Extracts file extension
  - `toBuffer()/fromBuffer()`: Convert embeddings between array and buffer formats

### Prompts

System prompts are stored as markdown files and loaded from:
- **prompts/router.md**: Router model instructions for parsing user intent
- **prompts/tagger.md**: Tagger model instructions for generating tags/descriptions

## Environment Configuration

Key environment variables in `.env`:

```bash
# LLM Endpoints
LM_COMPL_URL=http://127.0.0.1:1234/v1/chat/completions  # LM Studio chat endpoint
LM_EMBEDDING_URL=http://127.0.0.1:1234/v1/embeddings    # LM Studio embeddings

# Model Selection
ROUTER_MODEL=google/gemma-3-1b      # Lightweight router model
TAGGER_MODEL=qwen/qwen3-1.7b        # Text tagging model
VL_TAGGER_MODEL=google/gemma-3-4b   # Vision-language model for images
EMBEDDING_MODEL=text-embedding-embeddinggemma-300m

# Database
DB_PATH=./db/file_data.db

# Toggle between local LM Studio and OpenRouter API
USE_LOCAL=true
```

## Key Implementation Details

### Router Output Format

The router returns JSON with one of these structures:

```json
{"action": "tag_files", "target": "D:\\path\\to\\file", "type": "file|directory", "description": "optional"}
{"action": "search_knowledge", "query": "search terms"}
{"action": "save_knowledge", "entry": {"content": "...", "title": "...", "tags": [...], "description": "..."}}
{"action": "unknown", "reason": "..."}
```

### Path Handling

- Windows paths must escape backslashes: `D:\\Users` not `D:\Users`
- Router determines file vs directory by: extension presence, trailing slash, or defaults to directory
- Router has special `/no_think` flag that gets removed for non-qwen models

### Embedding Storage

Embeddings are stored as BLOBs using:
```javascript
Buffer.from(new Float32Array(embedding).buffer)
```

And retrieved using:
```javascript
Array.from(new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / Float32Array.BYTES_PER_ELEMENT))
```

### Content Truncation

All extracted file content is truncated to 2000 characters before being sent to LLM for tagging (utils/extractContent.js).

## Development Notes

- The project uses ES modules (`"type": "module"` in package.json)
- Database inserts in tagger.js are currently commented out (testing mode)
- Cosine similarity threshold is hardcoded to 0.4 in searcher.js
- Image files support base64 encoding for vision models (jpg, jpeg, png, webp)
- Tags must be single tokens with hyphens instead of spaces (enforced by tagger prompt)
