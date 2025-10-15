import { SYSTEM_PROMPTS } from "../data/prompts.js";
import { noCodeFence, noThink } from "../data/rules.js";
import { getDb } from "../utils/db.js";
import { sanitize } from "../utils/utils.js";
import fs from "fs";
import path from "path";
import { extractFileContent } from "../utils/extractContent.js";

const LM_STUDIO_API = process.env.LM_API_URL;
const TAGGER_MODEL = process.env.TAGGER_MODEL;

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

  const content = await extractFileContent(filePath);
  const input = content
  ? `File path: ${filePath}\n\nHere is part of its content:\n${content}\n\nGenerate 5 short tags and a short description for what this file is about.`
  : `Generate 3 short tags and a short description for this file: ${filePath}`;

  try {
    const response = await fetch(LM_STUDIO_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: process.env.AUTH_TOKEN,
      },
      body: JSON.stringify({
        model: TAGGER_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPTS.tagger },
          { role: "user", content: `${input}\n\n${noCodeFence} ${noThink}`}
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
      const entry = ["file", path.basename(filePath), filePath, JSON.stringify(parsed.tags), parsed.description];
      console.log(entry);
      // await db.run(
      //   `INSERT INTO knowledge_items (type, title, path, tags, description)
      //    VALUES (?, ?, ?, ?, ?)`,
      //   entry
      // )
    } catch (err) {
      console.error("❌ Failed to insert into DB:", err.message);
      console.log("Raw output:", cleaned);
    }
  } catch (err) {
    console.error(err);
  }
}