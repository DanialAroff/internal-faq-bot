import { SYSTEM_PROMPTS } from "../data/prompts.js";
import { noCodeFence } from "../data/rules.js";
import { removeNoThink, sanitize } from "../utils/utils.js";
import dotenv from "dotenv";

dotenv.config();

const LM_STUDIO_API = process.env.LM_API_URL;
const MODEL_8B = "qwen/qwen3-8b";
const ROUTER_MODEL = process.env.ROUTER_MODEL || "qwen3-0.6b";
const ROUTER_ENDPOINT = "http://127.0.0.1:8080/v1/chat/completions"

export async function ask(prompt) {
  if (!ROUTER_MODEL.includes('qwen')) {
    prompt = removeNoThink(prompt);
  }
  console.log(prompt);
  const response = await fetch(ROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
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
  console.log(data.choices?.[0]);
  if (!output) {
    console.warn("No content returned by the model.");
    return { action: null };
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
      const { searchSimilar } = await import("./searcher.js");
      await searchSimilar(info.query);
      break;
    case 'save_knowledge':
      // const { saveKnowledgeEntry } = await import("./saveknowledge.js");
      // await saveKnowledgeEntry();
      break;
    default:
      console.warn("⚠️  Unknown action:", info.action);
      break;
  }
}