import { SYSTEM_PROMPTS } from "../data/prompts.js";
import { noCodeFence } from "../data/rules.js";
import { sanitize } from "../utils/utils.js";

const LM_STUDIO_API = "http://127.0.0.1:1234/v1/chat/completions";
const MODEL_8B = "qwen/qwen3-8b";
// const MODEL = "qwen/qwen3-4b-2507";
const MODEL = "qwen3-1.7b";
// const MODEL = "qwen3-0.6b";

export async function ask(prompt) {
  const response = await fetch(LM_STUDIO_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer lm-studio",
    },
    body: JSON.stringify({
      model: MODEL,
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
  console.log(sanitize(output));
  return output ? sanitize(output) : null;
}

export async function takeAction(output) {
  const info = JSON.parse(output);
  // console.log(info);

  switch (info.action) {
    case 'tag_files':
      import("./tagger.js").then(({ tagItem }) => tagItem(info.target));
      break;
    case 'search_knowledge':
      import("./searcher.js").then(({ searchKnowledge }) => searchKnowledge(info.query));
      break;
    default:
      console.warn("⚠️ Unknown action:", info.action);
      break;
  }
}

export async function tagItem(item) {
  const response = await fetch(LM_STUDIO_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer lm-studio",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that generate tags for files.",
        },
        {
          role: "user",
          content: `Generate 3 short tags and a short description for this file ${item}
          \n
          Return a .json output without the code fence.
          Example format:
          {
            "tags": ["tag1", "tag2", "tag3"],
            "description": "This is a short description"
          }
          \n\n${noCodeFence}`,
        },
      ],
    }),
  });

  const data = await response.json();
  if (data.error) {
    console.error(data.error.message);
    return null;
  }

  const output = data.choices?.[0]?.message?.content?.trim();
  if (!output) {
    console.warn("No content returned by the model.");
    return null;
  }

  console.log(output);
}
