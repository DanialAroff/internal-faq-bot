import { SYSTEM_PROMPTS } from "../data/prompts.js";
import { noCodeFence } from "../data/rules.js";
import { fetchWithRetry } from "../utils/retry.js";
import { removeNoThink, sanitize } from "../utils/utils.js";

const ROUTER_MODEL = process.env.ROUTER_MODEL || "qwen3-0.6b";
const ROUTER_ENDPOINT = process.env.LM_COMPL_URL;

export async function ask(prompt) {
  if (!ROUTER_MODEL.includes("qwen")) {
    prompt = removeNoThink(prompt);
  }
  console.log("Prompt:", prompt);

  const response = await fetchWithRetry(() =>
    fetch(ROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ROUTER_MODEL,
        messages: [
          {
            role: "system",
            content: `${SYSTEM_PROMPTS.router}`,
          },
          {
            role: "user",
            content: `${prompt}\n\n${noCodeFence}`,
          },
        ],
        temperature: 0,
      }),
    })
  );

  const data = await response.json();
  if (data.error) {
    console.error(data.error.message);
    return;
  }

  const output = data.choices?.[0]?.message?.content?.trim();
  if (!output) {
    console.warn("No content returned by the model.");
    return { action: null };
  }
  const sanitizedOutput = sanitize(output);
  return output ? sanitizedOutput : null;
}

export async function takeAction(output) {
  if (!output) {
    console.error("❌ No output provided to take action.");
    return;
  }

  let info;
  try {
    info = JSON.parse(output);
  } catch (err) {
    console.error("❌ Failed to parse router output as JSON:", err.message);
    console.error("Raw output", output);
    return;
  }

  // Validate info has required action property
  if (!info || !info.action) {
    console.warn("⚠️ Invalid action structure:", info);
    return;
  }

  try {
    switch (info.action) {
      case "tag_files":
        const { tagItem } = await import("./tagger.js");
        await tagItem(info.target, info.description);
        break;
      case "search_knowledge":
        const { searchSimilar } = await import("./searcher.js");
        await searchSimilar(info.query);
        break;
      case "save_knowledge":
        const { saveKnowledgeEntry } = await import("./saveknowledge.js");
        await saveKnowledgeEntry(info.entry);
        break;
      case "update_file":
        const { updateFile } = await import("./updater.js");
        await updateFile(info.target, info.description);
        break;
      case "update_knowledge":
        const { updateKnowledgeByTitle } = await import("./updater.js");
        await updateKnowledgeByTitle(info.title, info.updates);
        break;
      default:
        console.warn("⚠️  Unknown action:", info.action);
        break;
    }
  } catch (err) {
    console.error("❌ Error executing action:", err.message);
    console.error(err.stack);
  }
}
