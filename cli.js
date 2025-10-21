#!/usr/bin/env node

/**
 * Artaka CLI - AI-powered knowledge management
 * Tag files, search knowledge, save notes
 */

import { validateConfig } from "./utils/config.js";
import { ask, takeAction } from "./ai/ai.js";

const VERSION = "1.0.0";

function showHelp() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    ARTAKA v${VERSION}                         ║
║           AI-Powered Knowledge Management                 ║
╚═══════════════════════════════════════════════════════════╝

USAGE:
  artaka <command> [arguments]

COMMANDS:
  tag <path>              Tag files or directories
  search <query>          Search your knowledge base
  save <content>          Save a knowledge entry
  update <path>           Update tags for a file
  delete <path>           Delete from index
  help                    Show this help message
  version                 Show version

EXAMPLES:
  artaka tag ./documents
  artaka tag "D:\\Projects\\README.md"
  artaka search "deployment steps"
  artaka save "Deploy with: npm run build && pm2 restart app"
  artaka update "./document.pdf"

CONFIGURATION:
  Create a .env file with your settings (see .env.example)
  Required: LM_COMPL_URL, DB_PATH, ROUTER_MODEL, etc.

PRIVACY:
  All data stays local. No cloud, no tracking.
  Your knowledge base is stored in: ./db/file_data.db

DOCUMENTATION:
  https://github.com/yourusername/artaka
`);
}

function showVersion() {
  console.log(`Artaka v${VERSION}`);
}

async function main() {
  const args = process.argv.slice(2);

  // Handle special commands
  if (args.length === 0 || args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
    showHelp();
    process.exit(0);
  }

  if (args[0] === "version" || args[0] === "--version" || args[0] === "-v") {
    showVersion();
    process.exit(0);
  }

  // Validate configuration before processing
  try {
    validateConfig();
  } catch (err) {
    console.error("❌ Configuration error:", err.message);
    console.error("\nPlease create a .env file with required settings.");
    console.error("See .env.example for reference.");
    process.exit(1);
  }

  // Build command string from arguments
  const command = args.join(" ");

  console.log(`\n🤖 Processing: "${command}"\n`);

  try {
    // Get router response
    const output = await ask(command);

    if (!output) {
      console.error("❌ No response from router");
      process.exit(1);
    }

    // Execute action
    await takeAction(output);

    console.log("\n✓ Done!");

  } catch (err) {
    console.error("\n❌ Error:", err.message);
    if (process.env.NODE_ENV === 'development') {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

// Run CLI
main().catch(err => {
  console.error("❌ Fatal error:", err.message);
  process.exit(1);
});
