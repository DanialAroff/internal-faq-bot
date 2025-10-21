import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { createEmbedding } from "./embedding.js";
import { SYSTEM_PROMPTS } from "../data/prompts.js";
import { noThink } from "../data/rules.js";
import { sanitize, fromBuffer, cosineSim } from "../utils/utils.js";
import { getDb } from "../utils/db.js";
import { fetchWithRetry } from "../utils/retry.js";

const USE_LOCAL = process.env.USE_LOCAL === "true";
const TAGGER_ENDPOINT = (USE_LOCAL
  ? process.env.LM_COMPL_URL
  : process.env.OPEN_ROUTER_ENDPOINT) || "google/gemma-3-1b";
const TAGGER_MODEL = (USE_LOCAL
  ? process.env.TAGGER_MODEL
  : process.env.OR_TAGGER_MODEL) || "qwen/qwen3-1.7b";
const API_KEY = USE_LOCAL
  ? process.env.LM_AUTH_TOKEN
  : process.env.OPEN_ROUTER_API_KEY;

const KNOWLEDGE_DEDUP_THRESHOLD = parseFloat(process.env.KNOWLEDGE_DEDUP_THRESHOLD) || 0.9;

/**
 * Check for duplicate knowledge entries using two-stage approach:
 * Stage 1: Exact title match (fast)
 * Stage 2: Semantic similarity via embeddings (slower but accurate)
 *
 * @param {Object} db - Database instance
 * @param {string} title - Entry title
 * @param {Array<number>} embedding - Entry embedding vector
 * @returns {Promise<Object>} - Duplicate info or null
 */
async function checkDuplicate(db, title, embedding) {
  // Stage 1: Check exact title match
  const exactMatch = await db.get(
    "SELECT id, title, description FROM knowledge_items WHERE type = 'doc' AND LOWER(title) = LOWER(?)",
    [title]
  );

  if (exactMatch) {
    console.log("🔍 Exact title match found");
    return {
      isDuplicate: true,
      reason: 'exact_title',
      match: exactMatch,
      score: 1.0
    };
  }

  // Stage 2: Check semantic similarity
  const allDocs = await db.all(
    "SELECT id, title, description, embedding FROM knowledge_items WHERE type = 'doc' AND embedding IS NOT NULL"
  );

  for (const doc of allDocs) {
    try {
      const existingEmbedding = fromBuffer(doc.embedding);
      const similarity = cosineSim(embedding, existingEmbedding);

      if (similarity >= KNOWLEDGE_DEDUP_THRESHOLD) {
        console.log(`🔍 Semantic match found (similarity: ${similarity.toFixed(3)})`);
        return {
          isDuplicate: true,
          reason: 'semantic_similarity',
          match: doc,
          score: similarity
        };
      }
    } catch (err) {
      console.warn("⚠️  Skipping invalid embedding for:", doc.title);
    }
  }

  return { isDuplicate: false };
}

export async function saveKnowledgeEntry(entry) {
  const db = await getDb();

  if (!entry.title || !entry.description || !entry.tags) {
    const missing = [];
    if (!entry.title) missing.push("title");
    if (!entry.description) missing.push("description");
    if (!entry.tags) missing.push("tags");

    const prompt = `
    You are a tagging assistant. Fill in the missing fields for this knowledge entry.
    
    User's content: ${entry.content}
    Provide JSON with keys: title, description, tags.
    Currently missing keys: ${JSON.stringify(missing)}
    `;

    const response = await fetchWithRetry(() =>
      fetch(TAGGER_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: TAGGER_MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPTS.tagger },
            { role: "user", content: `${prompt}\n${noThink}` },
          ],
        }),
      })
    );

    const data = await response.json();
    const output = data.choices?.[0]?.message?.content.trim();
    if (!output) {
      console.warn("⚠️ No content returned by the model.");
      return;
    }

    const sanitizedOutput = JSON.parse(sanitize(output));
    entry = { ...entry, ...sanitizedOutput };
    console.log(entry);
  }

  const textToEmbed = `${entry.title}\n${entry.description}\n${entry.content}`;
  const embedding = await createEmbedding(textToEmbed);

  if (!embedding) {
    console.error("❌ Failed to generate embedding");
    return { success: false, reason: 'embedding_failed' };
  }

  const duplicate = await checkDuplicate(db, entry.title, embedding);
  if (duplicate.isDuplicate) {
    const reasonText = duplicate.reason === 'exact_title'
      ? 'Exact title match'
      : `Similar content (${(duplicate.score * 100).toFixed(0)}% match)`;

    console.warn("⚠️  Duplicate knowledge entry detected:");
    console.warn(`   Reason: ${reasonText}`);
    console.warn(`   Existing: "${duplicate.match.title}"`);
    console.warn(`   New: "${entry.title}"`);
    console.warn("   Skipping...");

    return {
      success: false,
      reason: 'duplicate',
      duplicate: {
        reason: duplicate.reason,
        score: duplicate.score,
        existing: duplicate.match
      }
    };
  }

  // No duplicate found, proceed with insert
  try {
    await db.run(
      `INSERT INTO knowledge_items (title, type, tags, description, content, embedding)
         VALUES (?, ?, ?, ?, ?, ?)`,
      [
        entry.title,
        entry.type || "doc",
        JSON.stringify(entry.tags || []),
        entry.description || "",
        entry.content || "",
        Buffer.from(new Float32Array(embedding).buffer),
      ]
    );

    console.log(`✓ Knowledge entry saved: "${entry.title}"`);
    return { success: true, message: "Knowledge saved successfully" };
  } catch (err) {
    console.error("❌ Failed to insert knowledge into DB:", err.message);
    return { success: false, reason: 'db_error', error: err.message };
  }
}
