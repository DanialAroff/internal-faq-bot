import { getDb } from "../utils/db.js";
import fs from "fs";

/**
 * Delete file entry from database by path
 *
 * @param {string} filePath - Path to file to remove
 * @returns {Promise<Object>} - Delete result
 */
export async function deleteFile(filePath) {
  const db = await getDb();

  // Check if file exists in database
  const existing = await db.get(
    "SELECT id, title FROM knowledge_items WHERE type = 'file' AND path = ?",
    [filePath]
  );

  if (!existing) {
    console.warn("⚠️  File not found in database:", filePath);
    return { success: false, reason: 'not_found' };
  }

  try {
    await db.run("DELETE FROM knowledge_items WHERE id = ?", [existing.id]);

    console.log(`✓ Deleted file from index: ${existing.title}`);
    return { success: true, message: "File deleted successfully" };
  } catch (err) {
    console.error("❌ Failed to delete file:", err.message);
    return { success: false, reason: 'db_error', error: err.message };
  }
}

/**
 * Delete knowledge entry by ID
 *
 * @param {number} id - Entry ID
 * @returns {Promise<Object>} - Delete result
 */
export async function deleteKnowledge(id) {
  const db = await getDb();

  // Check if entry exists
  const existing = await db.get(
    "SELECT id, title FROM knowledge_items WHERE type = 'doc' AND id = ?",
    [id]
  );

  if (!existing) {
    console.warn("⚠️  Knowledge entry not found:", id);
    return { success: false, reason: 'not_found' };
  }

  try {
    await db.run("DELETE FROM knowledge_items WHERE id = ?", [id]);

    console.log(`✓ Deleted knowledge entry: "${existing.title}"`);
    return { success: true, message: "Knowledge deleted successfully" };
  } catch (err) {
    console.error("❌ Failed to delete knowledge:", err.message);
    return { success: false, reason: 'db_error', error: err.message };
  }
}

/**
 * Delete knowledge entry by title
 *
 * @param {string} title - Entry title
 * @returns {Promise<Object>} - Delete result
 */
export async function deleteKnowledgeByTitle(title) {
  const db = await getDb();

  const existing = await db.get(
    "SELECT id FROM knowledge_items WHERE type = 'doc' AND LOWER(title) = LOWER(?)",
    [title]
  );

  if (!existing) {
    console.warn("⚠️  Knowledge entry not found:", title);
    return { success: false, reason: 'not_found' };
  }

  return deleteKnowledge(existing.id);
}

/**
 * Clean up orphaned file entries (files that no longer exist on disk)
 *
 * @returns {Promise<Object>} - Cleanup results
 */
export async function cleanupOrphaned() {
  const db = await getDb();

  // Get all file entries
  const files = await db.all(
    "SELECT id, path, title FROM knowledge_items WHERE type = 'file' AND path IS NOT NULL"
  );

  const results = {
    checked: files.length,
    deleted: [],
    kept: [],
    errors: []
  };

  console.log(`🔍 Checking ${files.length} file(s) for orphaned entries...`);

  for (const file of files) {
    try {
      if (!fs.existsSync(file.path)) {
        // File no longer exists, delete from database
        await db.run("DELETE FROM knowledge_items WHERE id = ?", [file.id]);
        results.deleted.push(file.path);
        console.log(`🗑️  Removed orphaned: ${file.title}`);
      } else {
        results.kept.push(file.path);
      }
    } catch (err) {
      results.errors.push({ path: file.path, error: err.message });
      console.error(`❌ Error checking ${file.path}:`, err.message);
    }
  }

  console.log(`✓ Cleanup complete: ${results.deleted.length} deleted, ${results.kept.length} kept`);

  return {
    success: true,
    message: "Cleanup complete",
    results
  };
}

/**
 * Delete all entries (with confirmation required)
 * WARNING: This deletes everything!
 *
 * @param {boolean} confirm - Must be true to proceed
 * @returns {Promise<Object>} - Delete result
 */
export async function deleteAll(confirm = false) {
  if (!confirm) {
    console.error("❌ Confirmation required. Call with confirm=true");
    return {
      success: false,
      reason: 'not_confirmed',
      message: "Confirmation required to delete all entries"
    };
  }

  const db = await getDb();

  try {
    const count = await db.get("SELECT COUNT(*) as count FROM knowledge_items");

    await db.run("DELETE FROM knowledge_items");

    console.log(`✓ Deleted all ${count.count} entries from database`);
    return {
      success: true,
      message: `Deleted ${count.count} entries`,
      count: count.count
    };
  } catch (err) {
    console.error("❌ Failed to delete all entries:", err.message);
    return { success: false, reason: 'db_error', error: err.message };
  }
}

/**
 * Batch delete multiple files
 *
 * @param {Array<string>} filePaths - Array of file paths
 * @returns {Promise<Object>} - Batch delete results
 */
export async function batchDeleteFiles(filePaths) {
  const results = {
    deleted: [],
    notFound: [],
    failed: []
  };

  console.log(`🗑️  Batch deleting ${filePaths.length} file(s)...`);

  for (const filePath of filePaths) {
    const result = await deleteFile(filePath);

    if (result.success) {
      results.deleted.push(filePath);
    } else if (result.reason === 'not_found') {
      results.notFound.push(filePath);
    } else {
      results.failed.push(filePath);
    }
  }

  console.log(`✓ Batch delete complete: ${results.deleted.length} deleted, ${results.notFound.length} not found, ${results.failed.length} failed`);

  return {
    success: true,
    message: "Batch delete complete",
    results
  };
}
