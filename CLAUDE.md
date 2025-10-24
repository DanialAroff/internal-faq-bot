# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Artaka is an AI-powered knowledge management system that tags, indexes, and searches files using embeddings and vector similarity. It uses a router-based architecture where user prompts are parsed to determine actions.

**Status:** All core features complete! ✅
- Tag files, search knowledge, save/update/delete entries
- Two-stage deduplication, retry logic, error handling
- CLI interface, distribution ready
- REST API in progress (error handling complete, endpoints pending)

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
# CLI interface (main entry point)
node index.js

# REST API server (in development)
node api/server.js

# The application uses LM Studio or OpenRouter for LLM inference
# Configure endpoints in .env file
```

## REST API (In Development)

The REST API provides programmatic access to Artaka's knowledge management features. Currently implemented:

### Status
- **Error Handler Middleware:** ✅ Complete (api/middleware/errorHandler.js)
- **Dependencies:** ✅ Express 5.1.0, CORS 2.8.5 installed
- **File Structure:** ✅ Route files created (skeleton)
- **Server Setup:** ⏳ Pending
- **Route Implementation:** ⏳ Pending
- **Validator Middleware:** ⏳ Pending

### Error Handler (api/middleware/errorHandler.js)

Complete error handling middleware with:

**ApiError Class:**
```javascript
throw new ApiError(404, 'FILE_NOT_FOUND', 'File does not exist in database');
```

**Error Response Format:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

**Supported Error Types:**
- Custom ApiError (any status code)
- Validation errors (400)
- Database errors (500)
- File system errors (404 ENOENT, 403 EACCES)
- JSON parsing errors (400)
- Generic errors (500)

**Helper Functions:**
- `createValidationError(message, details)` - For validator middleware
- `asyncHandler(fn)` - Wraps async routes to catch errors

### Planned API Endpoints

**Files Routes** (api/routes/files.js):
- `POST /api/files/tag` - Tag a file or directory
- `GET /api/files` - List tagged files
- `PUT /api/files/:id` - Update file tags
- `DELETE /api/files/:id` - Delete file from index

**Search Routes** (api/routes/search.js):
- `GET /api/search?query=...` - Semantic search
- `POST /api/search` - Search with body

**Knowledge Routes** (api/routes/knowledge.js):
- `POST /api/knowledge` - Save knowledge entry
- `GET /api/knowledge` - List knowledge entries
- `PUT /api/knowledge/:id` - Update knowledge entry
- `DELETE /api/knowledge/:id` - Delete knowledge entry

**Maintenance Routes** (api/routes/maintenance.js):
- `GET /api/health` - Health check
- `POST /api/cleanup` - Cleanup orphaned entries
- `POST /api/reindex` - Re-index database

### Integration with Core Modules

The REST API will call existing core modules:
- **Router (ai/ai.js)** - For natural language command parsing
- **Tagger (ai/tagger.js)** - For file tagging
- **Searcher (ai/searcher.js)** - For semantic search
- **SaveKnowledge (ai/saveknowledge.js)** - For storing knowledge
- **Updater (ai/updater.js)** - For update operations
- **Deleter (ai/deleter.js)** - For delete operations

## Architecture

### Core Workflow

1. **Router (ai/ai.js)**: Entry point that parses user prompts and routes to appropriate actions
   - Uses `ask()` to send prompts to router model
   - Uses `takeAction()` to dispatch to specific modules based on router output
   - Supports actions: `tag_files`, `search_knowledge`, `save_knowledge`, `update_file`, `update_knowledge`, `delete_file`, `delete_knowledge`, `cleanup_orphaned`

2. **Tagger (ai/tagger.js)**: Generates tags and descriptions for files
   - Processes files or directories recursively
   - Extracts content from various file types (txt, pdf, docx, xlsx, images)
   - Supports vision models for image tagging (VL_TAGGER_MODEL)
   - Generates embeddings and stores metadata in SQLite database
   - Includes deduplication check (skips if path already exists)

3. **Searcher (ai/searcher.js)**: Semantic search using cosine similarity
   - Converts search query to embedding
   - Computes cosine similarity against all stored embeddings
   - Returns top K results with similarity scores > 0.4

4. **Save Knowledge (ai/saveknowledge.js)**: Stores text-based knowledge entries
   - Auto-generates missing metadata (title, tags, description) using LLM
   - Creates embeddings from combined text
   - Stores in knowledge_items table
   - Two-stage deduplication (exact title match + semantic similarity check)

5. **Updater (ai/updater.js)**: Updates existing entries
   - `updateFile(id, updates)` - Update file metadata by ID
   - `updateKnowledge(id, updates)` - Update knowledge entry by ID
   - `updateKnowledgeByTitle(title, updates)` - Update by title
   - `batchUpdateFiles(updates)` - Update multiple files at once
   - Re-tags files when content changes (delete + re-tag)

6. **Deleter (ai/deleter.js)**: Removes entries from database
   - `deleteFile(id)` or `deleteFile(path)` - Delete file by ID or path
   - `deleteKnowledge(id)` or `deleteKnowledgeByTitle(title)` - Delete knowledge entry
   - `cleanupOrphaned()` - Remove files that no longer exist on disk
   - `batchDeleteFiles(ids)` - Delete multiple files at once

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
- Cosine similarity threshold defaults to 0.4 (configurable via SIMILARITY_THRESHOLD env var)
- Content truncation defaults to 2000 characters (configurable via TRUNCATION_LENGTH env var)
- Image files support base64 encoding for vision models (jpg, jpeg, png, webp)
- Tags must be single tokens with hyphens instead of spaces (enforced by tagger prompt)
- REST API in development (error handling complete, routes pending)
