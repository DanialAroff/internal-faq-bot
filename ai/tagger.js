import { SYSTEM_PROMPTS } from "../data/prompts.js";
import { noCodeFence, noThink } from "../data/rules.js";
import { getDb } from "../utils/db.js";
import { sanitize } from "../utils/utils.js";
import fs from "fs";
import path from "path";

const LM_STUDIO_API = "http://127.0.0.1:1234/v1/chat/completions";
const MODEL = "qwen3-0.6b";

export async function tagItem(item) {
  const db = await getDb();
  let filesToTag = [];

  if (Array.isArray(item)) {
    filesToTag = item.filter(fs.existsSync);
  } else if (fs.existsSync(item)) {
    const stat = fs.statSync(item);

    if (stat.isDirectory()) {
      const entries = fs.readdirSync(item);
      filesToTag = entries
        .map(entry => path.join(item, entry))
        .filter(file => fs.statSync(file).isFile());
    } else {
      // If a single file then just insert whole item into an array
      filesToTag = [item];
    }
  } else {
    console.warn("⚠️ Target does not exist:", item);
    return;
  }

  console.log(`📁 Found ${filesToTag.length} file(s) to tag`);
  for (const file of filesToTag) {
    await tagSingleFile(file, db);
  }

  await db.close();
}

export async function tagSingleFile(filePath, db) {
  console.log(`🔍 Generating tags for: ${filePath}`);

  const exists = await db.get("SELECT id FROM knowledge_items WHERE path = ?", [filePath]);
  if (exists) {
    console.log(`Skipped (already in Database): ${filePath}`);
    return;
  }

  const response = await fetch(LM_STUDIO_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer lm-studio",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.tagger },
        { role: "user", content: `Generate 3 tags and a short description for this file: ${filePath}\n\n${noCodeFence} ${noThink}`}
      ],
    }),
  });

  const data = await response.json();
  const output = data.choices?.[0]?.message?.content.trim();
  if (!output) {
    console.warn("⚠️ No content returned by the model.");
    return;
  }

  const cleaned = sanitize(output);

  try {
    const parsed = JSON.parse(cleaned);
    console.log(parsed);
    const ent = ["file", path.basename(filePath), filePath, JSON.stringify(parsed.tags), parsed.description];
    console.log(ent);
    await db.run(
      `INSERT INTO knowledge_items (type, title, path, tags, description)
       VALUES (?, ?, ?, ?, ?)`,
      ent
    )
  } catch (err) {
    console.error("❌ Failed to insert into DB:", err.message);
    console.log("Raw output:", cleaned);
  }
}