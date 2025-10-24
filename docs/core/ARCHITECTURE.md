# Architecture Overview

Complete system architecture and data flow for Artaka.

---

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     User Input                          │
│              (CLI or Direct Script)                     │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                  Router (ai/ai.js)                      │
│  - Parses intent using LLM                             │
│  - Returns JSON action                                  │
└──────────────────────┬──────────────────────────────────┘
                       │
         ┌─────────────┴─────────────┬──────────────┬──────────────┐
         ▼                           ▼              ▼              ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  ┌──────────────┐
│  Tag Files       │  │  Search          │  │  Save        │  │  Update      │
│  (tagger.js)     │  │  (searcher.js)   │  │  (save       │  │  (updater.js)│
│                  │  │                  │  │  knowledge)  │  │              │
└────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘  └──────┬───────┘
         │                     │                    │                 │
         │  ┌──────────────────┴────────────────────┴─────────────────┘
         │  │
         ▼  ▼
┌─────────────────────────────────────────────────────────┐
│                 Embedding API                           │
│           (embedding.js + retry.js)                     │
│  - Generates vector embeddings                         │
│  - Retry logic with backoff                            │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              SQLite Database (db.js)                    │
│  - Singleton pattern (single connection)               │
│  - Auto-initializes schema                             │
│  - Stores: files, knowledge, embeddings                │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow

### 1. Tag Files Flow

```
User: "Tag D:\Documents"
         │
         ▼
    Router (ai.js)
    ┌─────────────────────────────────┐
    │ LLM parses:                     │
    │ {"action":"tag_files",          │
    │  "target":"D:\\Documents",      │
    │  "type":"directory"}            │
    └─────────────┬───────────────────┘
                  ▼
    Tagger (tagger.js)
    ┌─────────────────────────────────┐
    │ 1. List files in directory      │
    │ 2. For each file:               │
    │    - Check if already tagged    │
    │    - Extract content            │
    │    - Generate tags (LLM)        │
    │    - Create embedding           │
    │    - Insert into DB             │
    └─────────────┬───────────────────┘
                  ▼
    Database
    ┌─────────────────────────────────┐
    │ INSERT INTO knowledge_items     │
    │ (type='file', path, tags,       │
    │  description, embedding)        │
    └─────────────────────────────────┘
```

### 2. Search Flow

```
User: "Find deployment docs"
         │
         ▼
    Router (ai.js)
    ┌─────────────────────────────────┐
    │ {"action":"search_knowledge",   │
    │  "query":"deployment docs"}     │
    └─────────────┬───────────────────┘
                  ▼
    Searcher (searcher.js)
    ┌─────────────────────────────────┐
    │ 1. Generate query embedding     │
    │ 2. Load all stored embeddings   │
    │ 3. Calculate cosine similarity  │
    │ 4. Sort by score                │
    │ 5. Filter by threshold (0.4)    │
    │ 6. Return top K results         │
    └─────────────┬───────────────────┘
                  ▼
    Results
    ┌─────────────────────────────────┐
    │ [                               │
    │   {title, description,          │
    │    score: 0.87},                │
    │   {title, description,          │
    │    score: 0.65}                 │
    │ ]                               │
    └─────────────────────────────────┘
```

### 3. Save Knowledge Flow

```
User: "Save: Deploy with npm run build"
         │
         ▼
    Router (ai.js)
    ┌─────────────────────────────────┐
    │ {"action":"save_knowledge",     │
    │  "entry":{                      │
    │    "content":"Deploy with..."}} │
    └─────────────┬───────────────────┘
                  ▼
    SaveKnowledge (saveknowledge.js)
    ┌─────────────────────────────────┐
    │ 1. Auto-generate missing fields │
    │    (title, tags, description)   │
    │ 2. Create embedding             │
    │ 3. Check duplicates:            │
    │    ├─ Stage 1: Exact title      │
    │    └─ Stage 2: Semantic (0.9)   │
    │ 4. Insert if no duplicate       │
    └─────────────┬───────────────────┘
                  ▼
    Database
    ┌─────────────────────────────────┐
    │ INSERT INTO knowledge_items     │
    │ (type='doc', title, content,    │
    │  tags, description, embedding)  │
    └─────────────────────────────────┘
```

### 4. Update Flow

```
User: "Update D:\document.pdf"
         │
         ▼
    Router (ai.js)
    ┌─────────────────────────────────┐
    │ {"action":"update_file",        │
    │  "target":"D:\\document.pdf"}   │
    └─────────────┬───────────────────┘
                  ▼
    Updater (updater.js)
    ┌─────────────────────────────────┐
    │ 1. Find existing entry          │
    │ 2. DELETE old entry             │
    │ 3. Re-tag file (fresh)          │
    │ 4. INSERT new entry             │
    └─────────────┬───────────────────┘
                  ▼
    Database
    ┌─────────────────────────────────┐
    │ DELETE WHERE path = ?           │
    │ INSERT new tags + embedding     │
    └─────────────────────────────────┘
```

---

## 🗄️ Database Schema

### knowledge_items Table

```sql
CREATE TABLE knowledge_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,                    -- Entry title or filename
    type TEXT,                     -- "file" or "doc"
    path TEXT,                     -- File path (NULL for docs)
    tags TEXT,                     -- JSON array: ["tag1", "tag2"]
    description TEXT,              -- Short summary
    content TEXT,                  -- Full text (NULL for files)
    embedding BLOB                 -- Float32Array as buffer
);

CREATE INDEX idx_path ON knowledge_items(path);
CREATE INDEX idx_type ON knowledge_items(type);
```

### Data Examples

**File Entry:**
```javascript
{
  id: 1,
  title: "README.md",
  type: "file",
  path: "D:\\Projects\\README.md",
  tags: '["documentation", "readme", "project-info"]',
  description: "Project documentation and setup instructions",
  content: null,
  embedding: <Buffer ...>
}
```

**Knowledge Entry:**
```javascript
{
  id: 2,
  title: "Deployment Steps",
  type: "doc",
  path: null,
  tags: '["deployment", "devops", "production"]',
  description: "How to deploy the application to production",
  content: "1. Run npm build\n2. Upload to S3\n3. Restart server",
  embedding: <Buffer ...>
}
```

---

## 🧠 Embedding System

### How Embeddings Work

```
Text Input
    │
    ▼
LLM Embedding API
    │
    ▼
Vector (Float32Array)
[0.23, 0.45, 0.12, -0.34, ...]
    │        (300-1536 dimensions)
    ▼
Convert to Buffer
    │
    ▼
Store in SQLite BLOB
```

### Similarity Calculation

```javascript
// When searching:
query = "deployment steps"
queryVector = embed(query)  // [0.1, 0.5, ...]

// For each stored item:
storedVector = fromBuffer(item.embedding)
similarity = cosineSim(queryVector, storedVector)

// Results ranked by similarity:
// 0.87 - "Deployment Guide"     ← Most similar
// 0.65 - "Production Setup"
// 0.42 - "Server Configuration"
// 0.15 - "Database Backup"       ← Least similar
```

### Cosine Similarity Formula

```
similarity = (A · B) / (||A|| × ||B||)

Where:
- A · B = dot product
- ||A|| = magnitude of A
- ||B|| = magnitude of B

Result: 0.0 to 1.0
- 1.0 = identical vectors
- 0.0 = completely different
```

---

## 🎯 Router System

### Router Prompt Structure

Located in `prompts/router.md`:

```markdown
# Router - Parse Commands to JSON

## Actions Supported:
1. tag_files    - Tag files/directories
2. search_knowledge - Search by meaning
3. save_knowledge - Store notes
4. update_file  - Re-tag existing files
5. update_knowledge - Update entries

## Examples:
Input: Tag D:\Documents
Output: {"action":"tag_files","target":"D:\\Documents","type":"directory"}
```

### Router Output Format

Always JSON:
```javascript
{
  "action": "tag_files" | "search_knowledge" | "save_knowledge" | "update_file" | "update_knowledge",
  // Action-specific fields:
  "target": "path",           // For tag_files, update_file
  "query": "search terms",    // For search_knowledge
  "entry": {...},             // For save_knowledge
  "title": "...",             // For update_knowledge
  "updates": {...}            // For update_knowledge
}
```

---

## 🔄 Retry System

### Exponential Backoff Strategy

```
Attempt 1: Immediate
    │ (fails)
    ▼
Wait 1 second
    │
Attempt 2
    │ (fails)
    ▼
Wait 2 seconds
    │
Attempt 3
    │ (fails)
    ▼
Wait 4 seconds
    │
Attempt 4
    │ (fails)
    ▼
Throw error
```

### When to Retry

**Retry:**
- 5xx server errors
- Network timeouts
- Connection refused
- 429 rate limiting

**Don't Retry:**
- 4xx client errors (bad request, unauthorized)
- JSON parse errors (malformed response)
- Authentication failures

---

## 🔐 Deduplication System

### File Deduplication (Simple)

```
Stage 1: Exact Path Match
    ↓
SELECT id FROM knowledge_items
WHERE path = 'D:\document.pdf'
    ↓
Found? → Skip
Not found? → Insert
```

### Knowledge Deduplication (Two-Stage)

```
New Entry: "How to deploy backend"
    │
    ▼
┌─────────────────────────────────────┐
│ Stage 1: Exact Title Match          │
│                                     │
│ SELECT * WHERE                      │
│ LOWER(title) = LOWER('How to...')  │
│                                     │
│ Match? → Skip                       │
│ No match? → Stage 2                 │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ Stage 2: Semantic Similarity        │
│                                     │
│ For each doc:                       │
│   similarity = cosineSim(           │
│     newEmbedding,                   │
│     docEmbedding                    │
│   )                                 │
│                                     │
│   if similarity >= 0.9:             │
│     → Skip (duplicate)              │
│                                     │
│ No match? → Insert                  │
└─────────────────────────────────────┘
```

**Why Two Stages?**
1. Exact match is **fast** (SQL query)
2. Semantic check is **slow** (iterate all docs)
3. Most duplicates caught by Stage 1
4. Only run expensive Stage 2 when needed

**Thresholds:**
- Stage 2: 0.9 (very strict)
- Search: 0.4 (lenient)
- Different thresholds for different purposes

---

## 🏛️ Design Patterns Used

### 1. Singleton Pattern (Database)

```javascript
// utils/db.js
let dbInstance = null;

export async function getDb() {
  if (dbInstance) return dbInstance;  // Reuse

  dbInstance = await open(...);       // Create once
  await initializeSchema(dbInstance);
  return dbInstance;
}
```

**Why:**
- SQLite has limited concurrency
- Creating connections is expensive
- Prevents connection leaks
- Memory efficient

---

### 2. Centralized Utilities (DRY)

**Problem:**
```javascript
// searcher.js - has cosineSim()
// saveknowledge.js - needs cosineSim() too
// Solution: Duplicate code? NO!
```

**Solution:**
```javascript
// utils/utils.js
export function cosineSim(a, b) { ... }

// Both files import:
import { cosineSim } from "../utils/utils.js";
```

**Benefits:**
- Write once, use everywhere
- Fix bugs in one place
- Consistent behavior

---

### 3. Retry with Backoff

```javascript
// utils/retry.js
export async function fetchWithRetry(fetchFn, options) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetchFn();
    } catch (err) {
      const delay = delayMs * Math.pow(2, attempt);
      await sleep(delay);
    }
  }
}
```

**Used by:**
- ai.js (router)
- tagger.js (tagging)
- saveknowledge.js (auto-generate)
- embedding.js (embeddings)

---

### 4. Validate Early, Return Early

```javascript
// Instead of nested if-else:
export async function saveKnowledgeEntry(entry) {
  if (!entry) {
    console.error("No entry");
    return { success: false };  // Return early
  }

  if (!embedding) {
    console.error("No embedding");
    return { success: false };  // Return early
  }

  // Happy path here (not nested)
  await db.run(...);
  return { success: true };
}
```

**Benefits:**
- Cleaner code
- Less nesting
- Easier to read

---

## 📊 Module Dependencies

```
cli.js
  ├─ utils/config.js (validateConfig)
  └─ ai/ai.js
       ├─ ai/tagger.js
       │    ├─ utils/db.js
       │    ├─ utils/extractContent.js
       │    └─ ai/embedding.js
       │         └─ utils/retry.js
       ├─ ai/searcher.js
       │    ├─ utils/db.js
       │    ├─ utils/utils.js (cosineSim)
       │    └─ ai/embedding.js
       ├─ ai/saveknowledge.js
       │    ├─ utils/db.js
       │    ├─ utils/utils.js (cosineSim, sanitize)
       │    ├─ ai/embedding.js
       │    └─ utils/retry.js
       └─ ai/updater.js
            ├─ utils/db.js
            ├─ ai/tagger.js
            └─ ai/embedding.js
```

**No circular dependencies!**

---

## 🔧 Configuration Flow

```
Startup
  ├─ Load .env (dotenv)
  ├─ Validate required vars (utils/config.js)
  ├─ Fail fast if missing critical config
  └─ Continue if valid
```

**Environment Variables:**
- LLM endpoints (LM_COMPL_URL, LM_EMBEDDING_URL)
- Model names (ROUTER_MODEL, TAGGER_MODEL, etc.)
- Database path (DB_PATH)
- Thresholds (SIMILARITY_THRESHOLD, KNOWLEDGE_DEDUP_THRESHOLD)
- Retry config (MAX_RETRIES, RETRY_DELAY_MS)

---

## 🚀 Performance Considerations

### 1. Database Indexes

```sql
CREATE INDEX idx_path ON knowledge_items(path);
CREATE INDEX idx_type ON knowledge_items(type);
```

**Why:**
- Path lookups are common (deduplication)
- Type filtering for search (type='doc')
- Speeds up queries 10-100x

---

### 2. Embedding Caching

**Current:** Generate fresh embedding every time

**Future Optimization:**
- Cache query embeddings
- TTL: 5 minutes
- Reduces API calls for repeated searches

---

### 3. Content Truncation

```javascript
// Extract max 2000 characters
const content = fs.readFileSync(file).slice(0, 2000);
```

**Why:**
- LLMs have context limits
- Large files → expensive API calls
- 2000 chars usually sufficient for tags

---

### 4. Batch Processing

**Current:** Sequential file processing

**Future:**
```javascript
// Process 10 files in parallel
await Promise.all(
  fileBatch.map(file => tagSingleFile(file))
);
```

**Benefits:**
- Faster for large directories
- Better API utilization

---

## 🔒 Privacy & Security

### Data Storage

```
100% Local:
  ├─ Database: ./db/file_data.db (local SQLite)
  ├─ Embeddings: Stored in database (not sent anywhere)
  └─ File content: Extracted locally

External API Calls:
  ├─ LLM API (tagging, router)
  │   └─ Can use local LM Studio (no network)
  └─ Embedding API
      └─ Can use local LM Studio (no network)
```

**Privacy Modes:**

**Fully Offline (LM Studio):**
```bash
USE_LOCAL=true
LM_COMPL_URL=http://127.0.0.1:1234/v1/chat/completions
```
→ Zero data leaves your machine

**Cloud API (OpenRouter):**
```bash
USE_LOCAL=false
OPENROUTER_API_KEY=sk-or-v1-...
```
→ File content sent to API (encrypted in transit)

---

## 📈 Scalability

### Current Limits

| Resource | Current | Scales To |
|----------|---------|-----------|
| **Files** | Unlimited | Millions (SQLite limit: 281TB) |
| **Search** | O(n) linear scan | ~10K items before slow |
| **Embeddings** | 300-1536 dimensions | Memory dependent |
| **Database** | SQLite file | Gigabytes easily |

### Future Optimizations

**For Large Databases (10K+ items):**
1. Vector index (FAISS, Annoy)
2. Approximate nearest neighbors
3. Embedding dimension reduction
4. Batch operations

**For Multi-User:**
1. PostgreSQL instead of SQLite
2. API server layer
3. Authentication
4. Rate limiting

---

## 🎨 Code Organization Principles

### 1. Separation of Concerns

```
ai/        - Business logic (tagging, search, save)
utils/     - Reusable utilities (db, config, retry)
prompts/   - LLM instructions
data/      - System prompts, rules
docs/      - Documentation
```

### 2. Single Responsibility

Each module has **one job**:
- `tagger.js` → Tag files
- `searcher.js` → Search
- `db.js` → Database management
- `retry.js` → Retry logic

### 3. DRY (Don't Repeat Yourself)

Shared code in `utils/`:
- `cosineSim()` - Used by searcher & saveknowledge
- `sanitize()` - Used by all AI modules
- `fetchWithRetry()` - Used by all API calls

---

## 🔮 Future Architecture

### Potential Additions

**1. Cache Layer:**
```
User Query
  ↓
Cache (Redis)
  ├─ Hit → Return cached results
  └─ Miss → Database → Cache → Return
```

**2. Message Queue:**
```
User: "Tag 10,000 files"
  ↓
Job Queue (Bull, BullMQ)
  ↓
Workers process in background
  ↓
Notify user when complete
```

**3. Web API:**
```
HTTP REST API
  ├─ POST /api/tag
  ├─ GET  /api/search?q=...
  ├─ POST /api/save
  └─ PUT  /api/update/:id
```

**4. Multi-Model Support:**
```
Router
  ├─ Model A (fast, cheap)
  ├─ Model B (accurate, expensive)
  └─ Fallback models
```

---

*Last updated: 2025-10-21*
