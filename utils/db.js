import sqlite3 from "sqlite3";
import { open } from "sqlite";

let dbInstance = null;
let isInitialized = false;

async function initializeSchema(db) {
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        type TEXT,
        path TEXT,
        tags TEXT,
        description TEXT,
        content TEXT,
        embedding BLOB
      );
    `);

    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_path ON knowledge_items(path);
      CREATE INDEX IF NOT EXISTS idx_type ON knowledge_items(type);
    `);

    isInitialized = true;
  } catch (err) {
    console.error("❌ Failed to initialize database schema:", err.message);
    throw err;
  }
}

export async function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    if (!process.env.DB_PATH) {
      throw new Error("DB_PATH environment variable is not set");
    }

    dbInstance = await open({
      filename: process.env.DB_PATH,
      driver: sqlite3.Database,
    });

    if (!isInitialized) {
      await initializeSchema(dbInstance);
    }

    return dbInstance;
  } catch (err) {
    console.error("❌ Failed to connect to database:", err.message);
    throw err;
  }
}

export async function closeDb() {
  if (dbInstance) {
    try {
      await dbInstance.close();
      dbInstance = null;
      isInitialized = false;
    } catch (err) {
      console.error("❌ Failed to close database:", err.message);
      throw err;
    }
  }
}
