import { fetchWithRetry } from "../utils/retry.js";

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL;
const EMBEDDING_ENDPOINTS = process.env.LM_EMBEDDING_URL;

export async function createEmbedding(text) {
  try {
    const response = await fetchWithRetry(() =>
      fetch(EMBEDDING_ENDPOINTS, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: process.env.AUTH_TOKEN,
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: text,
        }),
      })
    );

    const data = await response.json();
    if (data.data && data.data.length > 0) {
      return data.data[0]?.embedding;
    }

    console.error("❌ No embedding data in response");
    return null;

  } catch (err) {
    console.error("❌ Failed to generate embedding after retries:", err.message);
    return null;
  }
}
