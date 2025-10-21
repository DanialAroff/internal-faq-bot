import { getDb } from "../utils/db.js";
import { tagSingleFile } from "./tagger.js";
import { createEmbedding } from "./embedding.js";
import { sanitize } from "../utils/utils.js";

/**
 * Update tags and description for an existing file
 * Re-extracts content and regenerates embedding
 *
 * @param {string} filePath - Path to the file to update
 * @param {string} userDescription - Optional new description
 * @returns {Promise<Object>} - Update result
 */
export async function updateFile(filePath, userDescription = "") {
  const db = await getDb();

  // Check if file exists in database
  const existing = await db.get(
    "SELECT id, title, tags, description FROM knowledge_items WHERE type = 'file' AND path = ?",
    [filePath]
  );

  if (!existing) {
    console.warn("⚠️  File not found in database:", filePath);
    return { success: false, reason: 'not_found' };
  }

  console.log(`🔄 Updating tags for: ${filePath}`);
  console.log(`   Previous: ${existing.description}`);

  // Delete the old entry
  await db.run("DELETE FROM knowledge_items WHERE id = ?", [existing.id]);

  // Re-tag the file (will insert fresh entry)
  await tagSingleFile(filePath, db, userDescription);

  console.log("✓ File updated successfully");
  return { success: true, message: "File updated successfully" };
}

/**
 * Update an existing knowledge entry
 *
 * @param {number} id - Entry ID to update
 * @param {Object} updates - Fields to update (title, description, tags, content)
 * @returns {Promise<Object>} - Update result
 */
export async function updateKnowledge(id, updates) {
  const db = await getDb();

  // Check if entry exists
  const existing = await db.get(
    "SELECT * FROM knowledge_items WHERE type = 'doc' AND id = ?",
    [id]
  );

  if (!existing) {
    console.warn("⚠️  Knowledge entry not found:", id);
    return { success: false, reason: 'not_found' };
  }

  console.log(`🔄 Updating knowledge entry: "${existing.title}"`);

  // Merge updates with existing data
  const updated = {
    title: updates.title || existing.title,
    description: updates.description || existing.description,
    tags: updates.tags || JSON.parse(existing.tags),
    content: updates.content || existing.content
  };

  // Generate new embedding if content changed
  let embedding = existing.embedding;
  if (updates.content || updates.title || updates.description) {
    const textToEmbed = `${updated.title}\n${updated.description}\n${updated.content}`;
    const newEmbedding = await createEmbedding(textToEmbed);

    if (newEmbedding) {
      embedding = Buffer.from(new Float32Array(newEmbedding).buffer);
    } else {
      console.warn("⚠️  Failed to generate new embedding, keeping old one");
    }
  }

  // Update in database
  try {
    await db.run(
      `UPDATE knowledge_items
       SET title = ?, description = ?, tags = ?, content = ?, embedding = ?
       WHERE id = ?`,
      [
        updated.title,
        updated.description,
        JSON.stringify(updated.tags),
        updated.content,
        embedding,
        id
      ]
    );

    console.log("✓ Knowledge entry updated successfully");
    return { success: true, message: "Knowledge updated successfully" };
  } catch (err) {
    console.error("❌ Failed to update knowledge:", err.message);
    return { success: false, reason: 'db_error', error: err.message };
  }
}

/**
 * Update knowledge entry by title (instead of ID)
 *
 * @param {string} title - Entry title to find
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} - Update result
 */
export async function updateKnowledgeByTitle(title, updates) {
  const db = await getDb();

  const existing = await db.get(
    "SELECT id FROM knowledge_items WHERE type = 'doc' AND LOWER(title) = LOWER(?)",
    [title]
  );

  if (!existing) {
    console.warn("⚠️  Knowledge entry not found:", title);
    return { success: false, reason: 'not_found' };
  }

  return updateKnowledge(existing.id, updates);
}

/**
 * Batch update multiple files
 *
 * @param {Array<string>} filePaths - Array of file paths to update
 * @returns {Promise<Object>} - Batch update results
 */
export async function batchUpdateFiles(filePaths) {
  const results = {
    updated: [],
    failed: [],
    notFound: []
  };

  console.log(`🔄 Batch updating ${filePaths.length} file(s)...`);

  for (const filePath of filePaths) {
    const result = await updateFile(filePath);

    if (result.success) {
      results.updated.push(filePath);
    } else if (result.reason === 'not_found') {
      results.notFound.push(filePath);
    } else {
      results.failed.push(filePath);
    }
  }

  console.log(`✓ Batch update complete: ${results.updated.length} updated, ${results.failed.length} failed, ${results.notFound.length} not found`);

  return results;
}
