const LM_STUDIO_API = process.env.LM_EMBEDDING_URL;
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL;

export async function createEmbedding(text) {
  try {
    const response = await fetch(LM_STUDIO_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: process.env.AUTH_TOKEN,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text,
      }),
    });

    const data = await response.json();
    if (data.data && data.data.length > 0) {
      return data.data[0]?.embedding;
    }
  } catch (err) {
    console.error("[Embedding] Failed to generate embedding:", err.message);
    return null;
  }
}
