# API Reference

Complete reference for all Artaka functions and modules.

---

## 📁 Module Overview

| Module | File | Purpose |
|--------|------|---------|
| **Router** | ai/ai.js | Parse commands and route to actions |
| **Tagger** | ai/tagger.js | Generate tags for files |
| **Searcher** | ai/searcher.js | Semantic search using embeddings |
| **SaveKnowledge** | ai/saveknowledge.js | Store knowledge entries with deduplication |
| **Updater** | ai/updater.js | Update existing files/knowledge |
| **Embedding** | ai/embedding.js | Generate vector embeddings |
| **Database** | utils/db.js | Database singleton |
| **Config** | utils/config.js | Environment variable validation |
| **Retry** | utils/retry.js | API retry logic with backoff |
| **Utils** | utils/utils.js | Helper functions |
| **ExtractContent** | utils/extractContent.js | File content extraction |

---

## 🤖 ai/ai.js - Router & Action Dispatcher

### `ask(prompt)`

Parse user prompt and determine action.

**Signature:**
```javascript
async function ask(prompt)
```

**Parameters:**
- `prompt` (string) - User command

**Returns:**
- (string) - JSON string with action details

**Process:**
1. Removes `/no_think` flag for non-qwen models
2. Sends to router LLM with system prompt
3. Returns sanitized JSON output

**Example:**
```javascript
const output = await ask("Tag this: D:\\Documents");
// Returns: {"action":"tag_files","target":"D:\\Documents","type":"directory"}
```

---

### `takeAction(output)`

Execute the action determined by router.

**Signature:**
```javascript
async function takeAction(output)
```

**Parameters:**
- `output` (string) - JSON output from `ask()`

**Process:**
1. Validates output exists
2. Parses JSON (with error handling)
3. Validates action structure
4. Dispatches to appropriate module

**Actions:**
- `tag_files` → `tagItem()`
- `search_knowledge` → `searchSimilar()`
- `save_knowledge` → `saveKnowledgeEntry()`
- `update_file` → `updateFile()`
- `update_knowledge` → `updateKnowledgeByTitle()`

**Error Handling:**
- JSON parse errors logged, returns gracefully
- Action execution errors caught and logged

---

## 🏷️ ai/tagger.js - File Tagging

### `tagItem(item, userDescription)`

Tag files or directories.

**Signature:**
```javascript
async function tagItem(item, userDescription = "")
```

**Parameters:**
- `item` (string | Array) - File path, directory path, or array of paths
- `userDescription` (string) - Optional user-provided description

**Process:**
1. Validates path exists
2. If directory: reads all files
3. For each file: calls `tagSingleFile()`
4. Logs progress

**Returns:**
- (void)

**Example:**
```javascript
await tagItem("D:\\Documents", "Work files");
```

---

### `tagSingleFile(filePath, db, userDescription)`

Tag a single file.

**Signature:**
```javascript
async function tagSingleFile(filePath, db, userDescription = "")
```

**Parameters:**
- `filePath` (string) - Path to file
- `db` (Object) - Database instance
- `userDescription` (string) - Optional description

**Process:**
1. Checks if already tagged (deduplication)
2. Extracts file content
3. Generates tags using LLM (or vision model for images)
4. Creates embedding
5. Inserts into database

**Deduplication:**
- Checks: `SELECT id FROM knowledge_items WHERE path = ?`
- Skips if already exists

**Image Support:**
- Detects: .jpg, .jpeg, .png, .webp
- Uses: VL_TAGGER_MODEL
- Encodes: base64

**Tags Generated:**
- 5 tags if content available
- 3 tags if filename only

**Returns:**
- (void) - Logs success/failure

---

## 🔍 ai/searcher.js - Semantic Search

### `searchSimilar(query, topK)`

Search knowledge base using semantic similarity.

**Signature:**
```javascript
async function searchSimilar(query, topK = 5)
```

**Parameters:**
- `query` (string) - Search query
- `topK` (number) - Number of results (default: 5)

**Process:**
1. Generates embedding for query
2. Loads all items with embeddings
3. Calculates cosine similarity for each
4. Sorts by score (descending)
5. Filters by SIMILARITY_THRESHOLD
6. Returns top K results

**Returns:**
- (Array) - Array of results with scores

**Example:**
```javascript
const results = await searchSimilar("deployment steps", 5);
// Returns: [{id, title, description, score: 0.87}, ...]
```

**Threshold:**
- Default: 0.4 (SIMILARITY_THRESHOLD env var)
- Only returns results > threshold

---

## 💾 ai/saveknowledge.js - Save Knowledge Entries

### `saveKnowledgeEntry(entry)`

Save knowledge entry with deduplication.

**Signature:**
```javascript
async function saveKnowledgeEntry(entry)
```

**Parameters:**
- `entry` (Object):
  - `content` (string) - Required
  - `title` (string) - Optional (auto-generated if missing)
  - `description` (string) - Optional (auto-generated)
  - `tags` (Array) - Optional (auto-generated)
  - `type` (string) - Default: "doc"

**Process:**
1. Auto-generates missing fields (title, description, tags) using LLM
2. Creates embedding from title + description + content
3. Checks for duplicates (two-stage)
4. Inserts if no duplicate found

**Two-Stage Deduplication:**

**Stage 1: Exact Title Match**
- SQL: `SELECT * WHERE LOWER(title) = LOWER(?)`
- Fast, case-insensitive
- Returns immediately if match

**Stage 2: Semantic Similarity**
- Compares embeddings with all docs
- Uses cosine similarity
- Threshold: 0.9 (KNOWLEDGE_DEDUP_THRESHOLD)
- Only runs if no exact match

**Returns:**
- `{success: true, message: "Knowledge saved successfully"}` - Success
- `{success: false, reason: 'duplicate', duplicate: {...}}` - Duplicate found
- `{success: false, reason: 'embedding_failed'}` - Embedding error
- `{success: false, reason: 'db_error', error: string}` - Database error

**Example:**
```javascript
const result = await saveKnowledgeEntry({
  content: "Deploy with: npm run build && pm2 restart",
  title: "Deployment Steps"
});
```

---

### `checkDuplicate(db, title, embedding)`

Internal function for duplicate detection.

**Signature:**
```javascript
async function checkDuplicate(db, title, embedding)
```

**Returns:**
- `{isDuplicate: false}` - No duplicate
- `{isDuplicate: true, reason: 'exact_title', match: {...}, score: 1.0}` - Exact match
- `{isDuplicate: true, reason: 'semantic_similarity', match: {...}, score: 0.92}` - Similar

---

## 🔄 ai/updater.js - Update Operations

### `updateFile(filePath, userDescription)`

Re-tag existing file.

**Signature:**
```javascript
async function updateFile(filePath, userDescription = "")
```

**Parameters:**
- `filePath` (string) - File path
- `userDescription` (string) - Optional new description

**Process:**
1. Checks if file exists in database
2. Deletes old entry
3. Re-runs tagSingleFile() with fresh content
4. Generates new embedding

**Returns:**
- `{success: true, message: "File updated successfully"}`
- `{success: false, reason: 'not_found'}` - File not in DB

**Example:**
```javascript
await updateFile("D:\\document.pdf", "Updated description");
```

---

### `updateKnowledge(id, updates)`

Update knowledge entry by ID.

**Signature:**
```javascript
async function updateKnowledge(id, updates)
```

**Parameters:**
- `id` (number) - Entry ID
- `updates` (Object) - Fields to update:
  - `title` (string)
  - `description` (string)
  - `tags` (Array)
  - `content` (string)

**Process:**
1. Fetches existing entry
2. Merges updates with existing data
3. Regenerates embedding if content/title/description changed
4. Updates database

**Returns:**
- `{success: true, message: "Knowledge updated successfully"}`
- `{success: false, reason: 'not_found'}` - Entry not found
- `{success: false, reason: 'db_error', error: string}` - Update failed

---

### `updateKnowledgeByTitle(title, updates)`

Update knowledge entry by title.

**Signature:**
```javascript
async function updateKnowledgeByTitle(title, updates)
```

**Process:**
1. Finds entry by title (case-insensitive)
2. Calls `updateKnowledge()` with found ID

**Returns:**
- Same as `updateKnowledge()`

---

### `batchUpdateFiles(filePaths)`

Update multiple files.

**Signature:**
```javascript
async function batchUpdateFiles(filePaths)
```

**Parameters:**
- `filePaths` (Array<string>) - Array of file paths

**Returns:**
```javascript
{
  updated: ["path1", "path2"],    // Successfully updated
  failed: ["path3"],              // Update failed
  notFound: ["path4"]             // Not in database
}
```

---

## 🧮 ai/embedding.js - Generate Embeddings

### `createEmbedding(text)`

Generate vector embedding for text.

**Signature:**
```javascript
async function createEmbedding(text)
```

**Parameters:**
- `text` (string) - Text to embed

**Process:**
1. Sends to embedding API (with retry logic)
2. Extracts embedding array
3. Returns Float32Array

**Returns:**
- (Array<number>) - Embedding vector (e.g., 300 dimensions)
- (null) - If failed after retries

**Uses:**
- Retry logic from utils/retry.js
- Exponential backoff on failures

---

## 🗄️ utils/db.js - Database Singleton

### `getDb()`

Get database instance (singleton pattern).

**Signature:**
```javascript
async function getDb()
```

**Process:**
1. Returns existing instance if available
2. Otherwise, opens database connection
3. Initializes schema if first run
4. Returns instance

**Returns:**
- (Object) - SQLite database instance

**Schema Created:**
```sql
CREATE TABLE IF NOT EXISTS knowledge_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  type TEXT,           -- "file" or "doc"
  path TEXT,
  tags TEXT,           -- JSON array
  description TEXT,
  content TEXT,
  embedding BLOB       -- Float32Array buffer
)
```

**Indexes:**
- `idx_path ON knowledge_items(path)`
- `idx_type ON knowledge_items(type)`

**Singleton Benefits:**
- Single connection reused
- No connection leaks
- Memory efficient

---

### `closeDb()`

Close database connection.

**Signature:**
```javascript
async function closeDb()
```

**Process:**
1. Closes connection if exists
2. Resets singleton instance
3. Resets initialization flag

---

## ✅ utils/config.js - Configuration Validation

### `validateConfig()`

Validate environment variables on startup.

**Signature:**
```javascript
function validateConfig()
```

**Validates:**

**Required:**
- LM_COMPL_URL
- LM_EMBEDDING_URL
- ROUTER_MODEL
- TAGGER_MODEL
- EMBEDDING_MODEL
- DB_PATH
- USE_LOCAL

**Conditional:**
- OPENROUTER_API_KEY (required if USE_LOCAL=false)

**Process:**
1. Checks all required vars exist
2. Checks conditional requirements
3. Warns about empty values
4. Exits with error if critical vars missing

**Returns:**
- (void) - Exits process if validation fails

---

### `getConfig()`

Get configuration object.

**Signature:**
```javascript
function getConfig()
```

**Returns:**
```javascript
{
  lmComplUrl: string,
  lmEmbeddingUrl: string,
  routerModel: string,
  taggerModel: string,
  vlTaggerModel: string,
  embeddingModel: string,
  dbPath: string,
  useLocal: boolean,
  openrouterApiKey: string
}
```

---

## 🔁 utils/retry.js - Retry Logic

### `fetchWithRetry(fetchFn, options)`

Retry fetch requests with exponential backoff.

**Signature:**
```javascript
async function fetchWithRetry(fetchFn, options = {})
```

**Parameters:**
- `fetchFn` (Function) - Function returning fetch promise
- `options` (Object):
  - `maxRetries` (number) - Default: 3
  - `delayMs` (number) - Initial delay (default: 1000)
  - `exponentialBackoff` (boolean) - Default: true
  - `onRetry` (Function) - Callback on retry

**Process:**
1. Attempts fetch
2. On 5xx or network error: retry with backoff
3. On 4xx: returns immediately (no retry)
4. On 429 rate limit: retry with delay
5. Delays: 1s, 2s, 4s, 8s... (exponential)

**Returns:**
- (Response) - Fetch response
- (throws Error) - After max retries exhausted

**Example:**
```javascript
const response = await fetchWithRetry(() =>
  fetch(url, { method: 'POST', body: data }),
  { maxRetries: 5 }
);
```

---

### `retryOperation(operation, options)`

Retry any async operation (not just fetch).

**Signature:**
```javascript
async function retryOperation(operation, options = {})
```

**Use Cases:**
- Database operations
- File I/O
- Any Promise-based code

**Example:**
```javascript
await retryOperation(
  async () => await db.run("INSERT ..."),
  { maxRetries: 3 }
);
```

---

## 🛠️ utils/utils.js - Helper Functions

### `sanitize(text)`

Remove code fences and think tags from LLM output.

**Signature:**
```javascript
function sanitize(text)
```

**Removes:**
- \`\`\`json, \`\`\`javascript (code fences)
- `<think>...</think>` tags

**Returns:**
- (string) - Cleaned text

---

### `extension(filePath)`

Extract file extension.

**Signature:**
```javascript
function extension(filePath)
```

**Returns:**
- (string) - Extension (lowercase, no dot)

**Example:**
```javascript
extension("document.PDF") // returns "pdf"
```

---

### `removeNoThink(text)`

Remove `/no_think` flag from text.

**Signature:**
```javascript
function removeNoThink(text)
```

**Purpose:**
- Router prompt uses `/no_think` for qwen models
- Other models don't understand it
- Removes before sending to non-qwen models

---

### `toBuffer(array)`

Convert Float32Array to Buffer.

**Signature:**
```javascript
function toBuffer(array)
```

**Returns:**
- (Buffer) - For storing in SQLite BLOB

---

### `fromBuffer(buffer)`

Convert Buffer back to Float32Array.

**Signature:**
```javascript
function fromBuffer(buffer)
```

**Returns:**
- (Array<number>) - Embedding vector

---

### `cosineSim(a, b)`

Calculate cosine similarity between two vectors.

**Signature:**
```javascript
function cosineSim(a, b)
```

**Parameters:**
- `a` (Array<number>) - First vector
- `b` (Array<number>) - Second vector

**Returns:**
- (number) - Similarity score (0 to 1)
  - 1.0 = identical
  - 0.0 = completely different
  - 0.9+ = very similar
  - 0.4-0.8 = somewhat similar

**Formula:**
```
cosine_sim = (a · b) / (||a|| × ||b||)
```

**Used By:**
- ai/searcher.js (search results)
- ai/saveknowledge.js (deduplication)

---

## 📄 utils/extractContent.js - File Extraction

### `extractFileContent(filePath)`

Extract text content from various file types.

**Signature:**
```javascript
async function extractFileContent(filePath)
```

**Supported Formats:**
- Text: .txt, .md, .csv
- Documents: .pdf, .docx
- Spreadsheets: .xlsx, .xls

**Process:**
1. Detects file extension
2. Uses appropriate parser
3. Truncates to TRUNCATION_LENGTH (default: 2000)

**Returns:**
- (string) - File content (truncated)
- (null) - If unsupported format or error

**Error Handling:**
- Try-catch around all parsers
- Logs error, returns null
- Lets caller decide how to handle

**Truncation:**
- Configurable via TRUNCATION_LENGTH env var
- Default: 2000 characters
- Prevents overwhelming LLM context

---

## 🔧 Environment Variables

| Variable | Default | Used By | Purpose |
|----------|---------|---------|---------|
| `ROUTER_MODEL` | qwen3-0.6b | ai.js | Parse user commands |
| `TAGGER_MODEL` | - | tagger.js | Generate tags |
| `VL_TAGGER_MODEL` | - | tagger.js | Vision model for images |
| `EMBEDDING_MODEL` | - | embedding.js | Generate embeddings |
| `LM_COMPL_URL` | - | All | LLM API endpoint |
| `LM_EMBEDDING_URL` | - | embedding.js | Embedding API endpoint |
| `DB_PATH` | - | db.js | Database file path |
| `USE_LOCAL` | true | All | Use local vs API |
| `SIMILARITY_THRESHOLD` | 0.4 | searcher.js | Search filter |
| `KNOWLEDGE_DEDUP_THRESHOLD` | 0.9 | saveknowledge.js | Dedup threshold |
| `TRUNCATION_LENGTH` | 2000 | extractContent.js | Content limit |
| `MAX_RETRIES` | 3 | retry.js | Retry attempts |
| `RETRY_DELAY_MS` | 1000 | retry.js | Initial delay |

---

## 📊 Return Value Patterns

### Success
```javascript
{ success: true, message: "Operation completed" }
```

### Failure
```javascript
{ success: false, reason: 'not_found' | 'duplicate' | 'db_error' | 'embedding_failed' }
```

### With Details
```javascript
{
  success: false,
  reason: 'duplicate',
  duplicate: {
    reason: 'exact_title' | 'semantic_similarity',
    score: 0.92,
    existing: { id, title, description }
  }
}
```

---

## 🚨 Error Handling Patterns

All modules follow these patterns:

1. **Try-catch around I/O**
   - Network calls
   - File operations
   - Database queries
   - JSON parsing

2. **Validate inputs early**
   - Check paths exist
   - Check required fields
   - Return early on invalid

3. **Log with context**
   - Include file paths, IDs
   - Use emoji prefixes (✓ ⚠️ ❌)
   - Stack traces in development

4. **Return gracefully**
   - Don't throw unless critical
   - Return error objects
   - Let caller decide how to handle

---

## 📚 Usage Examples

See `cli.js` and `index.js` for complete usage examples.

**Basic Flow:**
```javascript
import { validateConfig } from "./utils/config.js";
import { ask, takeAction } from "./ai/ai.js";

validateConfig();

const output = await ask("Tag D:\\Documents");
await takeAction(output);
```

---

*Last updated: 2025-10-21*
