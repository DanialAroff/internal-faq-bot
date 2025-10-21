export const sanitize = (text) =>
  text
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/```/g, "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();

export const extension = (filePath) => filePath.split(".").pop().toLowerCase();

// Remove /no_think so model like gemma3-1b does not mistake it as part of directory
export const removeNoThink = (text) =>
  text.replace(/\/?no_think\b/g, "").trim();

export function toBuffer(array) {
  return Buffer.from(new Float32Array(array).buffer);
}

export function fromBuffer(buffer) {
  return Array.from(
    new Float32Array(
      buffer.buffer,
      buffer.byteOffse,
      buffer.byteLength / Float32Array.BYTES_PER_ELEMENT
    )
  );
}

/**
 * Calculate cosine similarity between two vectors
 * @param {Array<number>} a - First vector
 * @param {Array<number>} b - Second vector
 * @returns {number} - Similarity score between 0 and 1
 */
export function cosineSim(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
