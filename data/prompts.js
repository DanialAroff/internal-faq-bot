import fs from "fs";

const routerPrompt = fs.readFileSync("./prompts/router.md", "utf-8");
const taggerPrompt = fs.readFileSync("./prompts/tagger.md", "utf-8");

// reuse across API calls
export const SYSTEM_PROMPTS = {
  router: routerPrompt,
  tagger: taggerPrompt,
};