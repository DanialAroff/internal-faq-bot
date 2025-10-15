import { SYSTEM_PROMPTS } from "../data/prompts.js";
import { noCodeFence } from "../data/rules.js";
import { removeNoThink, sanitize } from "../utils/utils.js";
import dotenv from "dotenv";

dotenv.config();

const LM_STUDIO_API = process.env.LM_API_URL;
const MODEL_8B = "qwen/qwen3-8b";
const ROUTER_MODEL = process.env.ROUTER_MODEL || "qwen3-0.6b";

export async function ask(prompt) {
  if (!ROUTER_MODEL.includes('qwen')) {
    prompt = removeNoThink(prompt);
  }
  console.log(prompt);
  const response = await fetch(LM_STUDIO_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: process.env.AUTH_TOKEN,
    },
    body: JSON.stringify({
      model: ROUTER_MODEL,
      messages: [
        {
          role: "system",
          content:
            `${SYSTEM_PROMPTS.router}`
        },
        {
          role: "user",
          content: `${prompt}\n\n${noCodeFence}`,
        },
      ],
      temperature: 0,
    }),
  });

  // console.log("Determining action to be taken...");
  const data = await response.json();
  if (data.error) {
    console.log(data.error.message);
    return;
  }

  const output = data.choices?.[0]?.message?.content?.trim();
  if (!output) {
    console.warn("No content returned by the model.");
    return null;
  }
  const sanitizedOutput = sanitize(output);
  console.log(sanitizedOutput);
  return output ? sanitizedOutput : null;
}

export async function takeAction(output) {
  const info = JSON.parse(output);

  switch (info.action) {
    case 'tag_files':
      const { tagItem } = await import("./tagger.js");
      await tagItem(info.target, info.description);
      break;
    case 'search_knowledge':
      const { searchKnowledge } = await import("./searcher.js");
      await searchKnowledge(info.query);
      break;
    default:
      console.warn("⚠️  Unknown action:", info.action);
      break;
  }
}