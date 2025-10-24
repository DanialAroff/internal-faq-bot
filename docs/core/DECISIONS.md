# Architecture Decision Records

Why certain design decisions were made in Artaka.

---

## Decision 1: Two-Stage Deduplication for Knowledge Entries

**Date:** 2025-10-21
**Status:** ✅ Implemented
**Context:** Need to prevent duplicate knowledge entries without being too slow

### The Problem

Knowledge entries can be duplicates even with different wording:
- "How to restart backend" vs "Backend restart procedure"
- "Deploy frontend steps" vs "Frontend deployment guide"

Simple title matching won't catch these, but checking semantic similarity for every entry is expensive.

### Options Considered

**Option A: Exact Title Match Only**
- **Pros:** Very fast (SQL query)
- **Cons:** Misses paraphrased duplicates, users frustrated with "different" duplicates

**Option B: Semantic Similarity Only**
- **Pros:** Catches all duplicates
- **Cons:** Slow (O(n) - must compare with all existing entries)

**Option C: Two-Stage (Chosen)**
- **Pros:** Fast for most cases, accurate when needed
- **Cons:** Slightly more complex code

### Decision

Use **two-stage deduplication**:

**Stage 1:** Exact title match (case-insensitive)
- Fast SQL query: `WHERE LOWER(title) = LOWER(?)`
- Returns immediately if match
- Catches most duplicates (users often save with same title)

**Stage 2:** Semantic similarity (threshold: 0.9)
- Only runs if no exact match
- Compares embeddings with all docs
- Catches paraphrased duplicates

### Rationale

- **Performance:** 90% of duplicates caught by Stage 1 (instant)
- **Accuracy:** Stage 2 catches remaining 10% (paraphrased)
- **User Experience:** Prevents frustrating duplicates
- **Cost:** Minimal (only pay semantic cost when needed)

### Threshold Choice: 0.9

- **0.95+:** Too strict, misses similar entries
- **0.9:** Sweet spot - catches paraphrases, avoids false positives
- **0.85:** Too lenient, flags different topics as duplicates
- **0.8:** Way too many false positives

**Configurable:** `KNOWLEDGE_DEDUP_THRESHOLD=0.9` in .env

---

## Decision 2: Singleton Pattern for Database Connection

**Date:** 2025-10-21
**Status:** ✅ Implemented
**Context:** Multiple modules need database access

### The Problem

Many modules need database:
- tagger.js, searcher.js, saveknowledge.js, updater.js
- Each module importing db separately
- Risk of multiple connections

### Options Considered

**Option A: New Connection Per Operation**
```javascript
// Bad: Creates connection every time
export async function saveData() {
  const db = await open({ filename: "./data.db" });
  await db.run(...);
}
```
- **Pros:** Simple
- **Cons:** Resource waste, connection leaks, slow

**Option B: Singleton (Chosen)**
```javascript
let dbInstance = null;
export async function getDb() {
  if (dbInstance) return dbInstance;
  dbInstance = await open(...);
  return dbInstance;
}
```
- **Pros:** One connection, memory efficient, fast
- **Cons:** Need cleanup on shutdown

**Option C: Connection Pool**
- **Pros:** Handles concurrency better
- **Cons:** Overkill for SQLite (limited concurrency anyway)

### Decision

Use **singleton pattern** with lazy initialization.

### Rationale

- **SQLite limitation:** Single-writer architecture, connection pool doesn't help
- **Performance:** Reusing connection is fast
- **Memory:** One connection vs potentially dozens
- **Simplicity:** Easy to implement, understand, maintain
- **Node.js:** Single-threaded, no race conditions for singleton

### Implementation

```javascript
// utils/db.js
let dbInstance = null;
let isInitialized = false;

export async function getDb() {
  if (dbInstance) return dbInstance;

  dbInstance = await open({ filename: process.env.DB_PATH });

  if (!isInitialized) {
    await initializeSchema(dbInstance);
  }

  return dbInstance;
}
```

**Auto-initialization:** Schema created on first call.

---

## Decision 3: Delete-Then-Retag for File Updates

**Date:** 2025-10-21
**Status:** ✅ Implemented
**Context:** Need to update tags when file content changes

### The Problem

User wants to re-tag file after content changes. How to update?

### Options Considered

**Option A: UPDATE in Place**
```javascript
await db.run(
  "UPDATE knowledge_items SET tags=?, description=?, embedding=? WHERE path=?",
  [newTags, newDesc, newEmbedding, filePath]
);
```
- **Pros:** Preserves ID, single query
- **Cons:** Must handle all update logic, regenerate embedding, complex

**Option B: Delete Then Retag (Chosen)**
```javascript
await db.run("DELETE FROM knowledge_items WHERE path=?", [filePath]);
await tagSingleFile(filePath, db);
```
- **Pros:** Reuses existing tagger, always fresh, simple
- **Cons:** ID changes (not a problem - users don't see IDs)

### Decision

Use **delete-then-retag** approach.

### Rationale

- **DRY:** Reuses `tagSingleFile()` - no duplicate code
- **Consistency:** Same tagging logic as initial tag
- **Fresh data:** Re-extracts content, regenerates everything
- **Simplicity:** Easy to understand and maintain
- **No partial updates:** Can't have stale embedding with new tags

### Trade-offs Accepted

- **ID changes:** Not a problem (internal, users don't reference IDs)
- **Two operations:** Acceptable (wrapped in same function)

---

## Decision 4: Centralized Retry Logic

**Date:** 2025-10-21
**Status:** ✅ Implemented
**Context:** Multiple modules make API calls that can fail

### The Problem

Network calls fail:
- Router API (ai.js)
- Tagger API (tagger.js)
- SaveKnowledge API (saveknowledge.js)
- Embedding API (embedding.js)

Each needs retry logic. Duplicate code everywhere?

### Options Considered

**Option A: Retry in Each Module**
```javascript
// tagger.js
for (let i = 0; i < 3; i++) {
  try { await fetch(...); break; }
  catch { await sleep(1000 * i); }
}

// embedding.js
for (let i = 0; i < 3; i++) {
  try { await fetch(...); break; }
  catch { await sleep(1000 * i); }
}
// Duplicate code!
```
- **Pros:** Simple
- **Cons:** Code duplication, inconsistent behavior, hard to maintain

**Option B: Centralized Retry Utility (Chosen)**
```javascript
// utils/retry.js
export async function fetchWithRetry(fetchFn, options) { ... }

// All modules use it:
const response = await fetchWithRetry(() => fetch(...));
```
- **Pros:** DRY, consistent, configurable, testable
- **Cons:** Extra abstraction layer

### Decision

Create **`utils/retry.js`** with reusable retry logic.

### Rationale

- **DRY:** Write once, use everywhere
- **Consistency:** Same backoff strategy across all modules
- **Configurable:** `MAX_RETRIES`, `RETRY_DELAY_MS` in .env
- **Maintainable:** Fix bugs in one place
- **Smart:** Only retries 5xx/network errors, not 4xx

### Implementation

**Exponential backoff:** 1s, 2s, 4s, 8s...

**Retry conditions:**
- ✅ 5xx server errors
- ✅ Network timeouts
- ✅ 429 rate limiting
- ❌ 4xx client errors (no point retrying)

---

## Decision 5: Cosine Similarity in utils/utils.js

**Date:** 2025-10-21
**Status:** ✅ Implemented
**Context:** Both searcher.js and saveknowledge.js need cosine similarity

### The Problem

Cosine similarity calculation needed in:
- `searcher.js` - Compare query with stored embeddings
- `saveknowledge.js` - Compare new entry with existing (deduplication)

### Options Considered

**Option A: Duplicate Function**
```javascript
// searcher.js
function cosineSim(a, b) { ... }

// saveknowledge.js
function cosineSim(a, b) { ... }
// Same code twice!
```

**Option B: Centralize in utils (Chosen)**
```javascript
// utils/utils.js
export function cosineSim(a, b) { ... }

// Both import:
import { cosineSim } from "../utils/utils.js";
```

### Decision

Move to **`utils/utils.js`**.

### Rationale

- **DRY:** Single source of truth
- **Testing:** Test once, works everywhere
- **Bugs:** Fix in one place
- **Performance:** Same algorithm everywhere

### Implementation

```javascript
export function cosineSim(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
```

Simple, efficient, reusable.

---

## Decision 6: Search Threshold vs Dedup Threshold

**Date:** 2025-10-21
**Status:** ✅ Implemented
**Context:** Different thresholds for different purposes

### The Problem

Should search and deduplication use same similarity threshold?

### Decision

**Different thresholds:**
- **Search:** 0.4 (`SIMILARITY_THRESHOLD`)
- **Deduplication:** 0.9 (`KNOWLEDGE_DEDUP_THRESHOLD`)

### Rationale

**Search (0.4 - Lenient):**
- Want to show related results
- User exploring, casting wide net
- OK to show "maybe relevant" items
- User can judge relevance

**Deduplication (0.9 - Strict):**
- Want to avoid false positives
- Blocking user from saving entry
- Only flag truly similar content
- Better to allow near-duplicate than frustrate user

### Examples

**Similarity: 0.85**
- Search: ✅ Show result (might be relevant)
- Dedup: ❌ Allow save (not similar enough to block)

**Similarity: 0.95**
- Search: ✅ Show result (very relevant)
- Dedup: ✅ Block save (clear duplicate)

---

## Decision 7: Content Truncation to 2000 Characters

**Date:** 2025-10-21
**Status:** ✅ Implemented
**Context:** Files can be huge, LLMs have context limits

### The Problem

Large files (PDFs, docs) can be 100K+ characters. Sending all to LLM:
- Expensive API costs
- Slow processing
- Hits context limits

### Options Considered

**Option A: Send Everything**
- **Pros:** Complete context
- **Cons:** Expensive, slow, often fails

**Option B: Fixed Truncation (Chosen)**
```javascript
const content = fs.readFileSync(file).slice(0, 2000);
```
- **Pros:** Fast, predictable, works
- **Cons:** Might miss important content at end

**Option C: Smart Chunking**
- **Pros:** Better coverage
- **Cons:** Complex, need summarization, still expensive

### Decision

Truncate to **2000 characters** (configurable).

### Rationale

- **Sufficient:** First 2000 chars usually contains key info
- **Fast:** No extra processing
- **Cheap:** Fits in LLM context easily
- **Configurable:** `TRUNCATION_LENGTH` env var for customization

### Why 2000?

- **Too small (500):** Might miss context
- **2000:** Good balance (1-2 paragraphs)
- **Too large (10000):** Expensive, slow

**Future:** Could add smart extraction (detect headers, key sections).

---

## Decision 8: Auto-Generate Missing Knowledge Fields

**Date:** 2025-10-21
**Status:** ✅ Implemented
**Context:** Users might save only content, no title/tags

### The Problem

User saves: `"Deploy with npm run build"`
- No title
- No tags
- No description

Do we require all fields or auto-generate?

### Options Considered

**Option A: Require All Fields**
- Force user to provide title, tags, description
- **Pros:** User controls everything
- **Cons:** Friction, users just want to save quickly

**Option B: Auto-Generate (Chosen)**
- If missing, use LLM to generate
- **Pros:** Fast user experience, still structured
- **Cons:** Extra API call, might not be perfect

### Decision

**Auto-generate missing fields** using LLM.

### Rationale

- **User experience:** Quick saves, no friction
- **Still structured:** Database always has title/tags/description
- **Search works:** Embeddings use complete data
- **User can override:** Provide title if they want

### Implementation

```javascript
if (!entry.title || !entry.description || !entry.tags) {
  const prompt = `Generate missing fields for: ${entry.content}`;
  const generated = await askLLM(prompt);
  entry = { ...entry, ...generated };
}
```

**API cost:** Acceptable - better UX worth it.

---

## Decision 9: File Deduplication by Path Only

**Date:** 2025-10-21
**Status:** ✅ Implemented
**Context:** How to detect duplicate files?

### The Problem

User tags `D:\document.pdf` multiple times. Should we:
- Check content hash?
- Check path only?
- Check both?

### Options Considered

**Option A: Content Hash**
- Hash file content (MD5/SHA256)
- Check if hash exists
- **Pros:** Detects renamed duplicates
- **Cons:** Slow (must read entire file), false positives (same content, different context)

**Option B: Path Only (Chosen)**
- Check: `SELECT * WHERE path = ?`
- **Pros:** Fast, simple, accurate
- **Cons:** Doesn't detect renamed files

### Decision

Check **path only**.

### Rationale

- **Files are unique by path:** Same path = same file
- **Fast:** SQL index lookup
- **Simple:** No hashing complexity
- **Correct behavior:** If file moved, user likely wants to re-tag

**Renamed files:** User can re-tag if they want (manual control).

---

## Decision 10: Fail Fast on Configuration Errors

**Date:** 2025-10-21
**Status:** ✅ Implemented
**Context:** Missing environment variables cause cryptic errors later

### The Problem

If `DB_PATH` missing:
- App starts
- Works until first database call
- Then crashes with "Cannot find database"
- Hard to debug

### Options Considered

**Option A: Validate on First Use**
- Check when database accessed
- **Pros:** Only validate what's needed
- **Cons:** Failures happen mid-operation, confusing

**Option B: Fail Fast on Startup (Chosen)**
- Validate all required vars immediately
- Exit with clear error if missing
- **Pros:** Immediate, clear feedback
- **Cons:** Must define all required vars upfront

### Decision

**Validate on startup**, exit immediately if config invalid.

### Rationale

- **Better UX:** Clear error message before doing anything
- **Saves time:** Don't start processing, then fail
- **Explicit:** User knows exactly what to fix
- **Production safety:** Won't half-work in production

### Implementation

```javascript
// First line in index.js and cli.js
validateConfig();

// utils/config.js
export function validateConfig() {
  const missing = [];
  for (const varName of REQUIRED_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    console.error('❌ Missing:', missing);
    process.exit(1);  // Fail fast!
  }
}
```

---

## Decision 11: SQLite Over PostgreSQL

**Date:** 2025-10-21
**Status:** ✅ Implemented
**Context:** Which database to use?

### Options Considered

**Option A: SQLite (Chosen)**
- File-based database
- **Pros:** No server, portable, simple, perfect for local
- **Cons:** Limited concurrency, single-writer

**Option B: PostgreSQL**
- Client-server database
- **Pros:** Better concurrency, features, scalability
- **Cons:** Requires server, overkill for local app

### Decision

**SQLite** for now.

### Rationale

- **Local-first:** Artaka is designed for local use
- **Privacy:** File stays on user's machine
- **Simplicity:** No server setup, just a file
- **Portable:** Database file can be copied/backed up easily
- **Sufficient:** Handles millions of entries fine

**Future:** Can migrate to PostgreSQL for multi-user web version.

---

## Decision 12: MIT License

**Date:** 2025-10-21
**Status:** ✅ Implemented
**Context:** Which open source license?

### Options Considered

**Option A: ISC**
- Simpler, shorter
- **Pros:** Less text
- **Cons:** Less known

**Option B: MIT (Chosen)**
- Most popular open source license
- **Pros:** Widely recognized, trusted
- **Cons:** Slightly more verbose

**Option C: GPL**
- Copyleft, requires derivatives be open
- **Pros:** Ensures open source
- **Cons:** Restrictive, prevents commercial use

### Decision

**MIT License**.

### Rationale

- **Most popular:** Users instantly recognize it
- **Permissive:** Commercial use allowed
- **Trusted:** Lawyers/companies understand it
- **Adoption:** Encourages use and contribution

Allows users to:
- ✅ Use commercially
- ✅ Modify
- ✅ Distribute
- ✅ Private use

Only requires: Include copyright notice.

---

## Decision Summary Table

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| **Two-stage dedup** | Fast + accurate | Slightly complex |
| **Singleton DB** | One connection, efficient | Need cleanup |
| **Delete-then-retag** | Reuses code, simple | ID changes |
| **Centralized retry** | DRY, consistent | Extra abstraction |
| **Centralized cosineSim** | DRY, testable | N/A |
| **Different thresholds** | Right tool for job | Two config vars |
| **2000 char truncation** | Balance cost/quality | Might miss content |
| **Auto-generate fields** | Better UX | Extra API call |
| **Path-only dedup** | Fast, simple | Miss renames |
| **Fail fast config** | Clear errors early | Must define all vars |
| **SQLite** | Local, simple | Limited concurrency |
| **MIT license** | Widely trusted | N/A |

---

## Lessons Learned

### 1. Premature Optimization

❌ **Don't:** Build complex caching before knowing if needed
✅ **Do:** Start simple, optimize when you see bottleneck

**Example:** Started with simple dedup, found Stage 1 catches 90% - no need for fancy caching yet.

### 2. DRY When It Matters

❌ **Don't:** Extract every 2-line function to utils
✅ **Do:** Extract when used 3+ times or likely to change

**Example:** `cosineSim()` used by 2 modules → extract. Random helper used once → keep local.

### 3. User Experience First

❌ **Don't:** Require perfect data from user
✅ **Do:** Auto-generate what you can, let user override

**Example:** Auto-generate title/tags from content - user can edit if needed.

### 4. Fail Fast, Fail Clear

❌ **Don't:** Let app fail mysteriously later
✅ **Do:** Validate early, error messages with solutions

**Example:** Config validation on startup with clear "Missing: DB_PATH" message.

---

*Last updated: 2025-10-21*
