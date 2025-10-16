import { SYSTEM_PROMPTS } from "../data/prompts.js";
import { noCodeFence, noThink } from "../data/rules.js";
import { getDb } from "../utils/db.js";
import { extension, sanitize } from "../utils/utils.js";
import fs from "fs";
import path from "path";
import { extractFileContent } from "../utils/extractContent.js";
import { createEmbedding } from "./embedding.js";

const LM_STUDIO_API = process.env.LM_API_URL;
const TAGGER_MODEL = process.env.TAGGER_MODEL;
const VL_TAGGER_MODEL = process.env.VL_TAGGER_MODEL;
const NO_OF_TAGS_READ_CONTENT = 5;
const NO_OF_TAGS_NAME_ONLY = 3; // if tags are to be generated based on file name only

export async function tagItem(item, userDescription = "") {
  const db = await getDb();
  let filesToTag = [];
  let isDirectory = true;

  if (Array.isArray(item)) {
    filesToTag = item.filter(fs.existsSync);
  } else if (fs.existsSync(item)) {
    const stat = fs.statSync(item);

    if (stat.isDirectory()) {
      const entries = fs.readdirSync(item);
      filesToTag = entries
        .map((entry) => path.join(item, entry))
        .filter((file) => fs.statSync(file).isFile());
    } else {
      // If a single file then just insert whole item into an array
      isDirectory = false;
      filesToTag = [item];
    }
  } else {
    console.warn("⚠️ Target does not exist:", item);
    return;
  }

  console.log(`📁 Found ${filesToTag.length} file(s) to tag`);
  for (const file of filesToTag) {
    isDirectory
      ? await tagSingleFile(file, db)
      : await tagSingleFile(file, db, userDescription);
  }

  await db.close();
}

export async function tagSingleFile(filePath, db, userDescription = "") {
  console.log(`🔍 Generating tags for: ${filePath}`);

  const exists = await db.get("SELECT id FROM knowledge_items WHERE path = ?", [
    filePath,
  ]);
  if (exists) {
    console.log(`Skipped (already in Database): ${filePath}`);
    return;
  }

  const content = await extractFileContent(filePath);

  const ext = extension(filePath);
  const isImage = ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp";
  const imageBase64 = isImage ? fs.readFileSync(filePath).toString("base64") : null;

  const hasDesc = Boolean(userDescription && userDescription.trim());
  const baseInput = content
    ? `File path: ${filePath}\n\nHere is part of its content:\n${content}\n\nBased on above content:\n- Generate ${NO_OF_TAGS_READ_CONTENT} short tags`
    : `File path: ${filePath}\n\n- Generate ${NO_OF_TAGS_NAME_ONLY} short tags`;
  const input = hasDesc
    ? `${baseInput}\n- Include ${userDescription} as the "description"`
    : `${baseInput}\n- Generate a short description of what this file about.`;

  try {
    const response = await fetch(LM_STUDIO_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: process.env.AUTH_TOKEN,
      },
      body: JSON.stringify({
        model: isImage ? VL_TAGGER_MODEL : TAGGER_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPTS.tagger },
          { 
            role: "user",
            content: isImage ? [
              { type: "text", text: `${input}\n\n${noThink}`},
              { type: "image_url", image_url: { url : `data:image/jpeg;base64,${imageBase64}`} }
            ] : `${input}\n\n${noCodeFence} ${noThink}` },
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
      const embedding = await createEmbedding(parsed.description);
      const entry = [
        "file",
        path.basename(filePath),
        filePath,
        JSON.stringify(parsed.tags),
        parsed.description,
        Buffer.from(new Float32Array(embedding).buffer),
      ];
      // console.log(entry);
      // await db.run(
      //   `INSERT INTO knowledge_items (type, title, path, tags, description, embedding)
      //    VALUES (?, ?, ?, ?, ?, ?)`,
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
