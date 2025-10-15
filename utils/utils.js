export const sanitize = text =>
  text
  .replace(/```[a-z]*\n?/gi, '').replace(/```/g, '')
  .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();

// Remove /no_think so model like gemma3-1b does not mistake it as part of directory
export const removeNoThink = text =>
  text
    .replace(/\/?no_think\b/g, '')
    .trim();

export function toBuffer(array) {
  return Buffer.from(new Float32Array(array).buffer);
}
export function fromBuffer(buffer) {
  return Array.from(new Float32Array(buffer.buffer, buffer.byteOffse, buffer.byteLength / Float32Array.BYTES_PER_ELEMENT));
}