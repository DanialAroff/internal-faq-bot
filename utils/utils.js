export const sanitize = text =>
  text
  .replace(/```[a-z]*\n?/gi, '').replace(/```/g, '')
  .replace(/<think>[\s\S]*?<\/think>/gi, '')
  .trim();