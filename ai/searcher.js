import { createEmbedding } from "./embedding.js";
import { fromBuffer } from "../utils/utils.js";
import { getDb } from "../utils/db.js";

function cosineSim(a, b) {
  let dot = 0,
    magA = 0,
    magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export async function searchSimilar(query, topK = 5) {
  const queryVector = await createEmbedding(query);
  if (!queryVector) {
    console.error("❌ Failed to create query embedding");
    return [];
  }

  const db = await getDb();
  const rows = await db.all("SELECT * FROM knowledge_items WHERE embedding IS NOT NULL");

  const results = []; // store results from computing cosine similarity
  for (const row of rows) {
    try {
      const storedVector = fromBuffer(row.embedding);
      const score = cosineSim(queryVector, storedVector);
      results.push({ ...row, score });
    } catch (err) {
      console.warn("⚠️ Skipping invalid embedding for:", row.path);
    }
  }

  results.sort((a, b) => b.score - a.score);
  console.log(results.slice(0, topK).filter(res => res.score > 0.4));
  return results.slice(0, topK);
}
