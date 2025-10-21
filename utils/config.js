import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const REQUIRED_VARS = [
  'LM_COMPL_URL',
  'LM_EMBEDDING_URL',
  'ROUTER_MODEL',
  'TAGGER_MODEL',
  'EMBEDDING_MODEL',
  'DB_PATH',
  'USE_LOCAL'
];

const OPTIONAL_VARS = {
  'VL_TAGGER_MODEL': null,  // Only needed for image tagging
  'OPENROUTER_API_KEY': null  // Only needed if USE_LOCAL=false
};

export function validateConfig() {
  const missing = [];
  const warnings = [];

  for (const varName of REQUIRED_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  // Check conditional requirements
  if (process.env.USE_LOCAL === 'false' && !process.env.OPENROUTER_API_KEY) {
    missing.push('OPENROUTER_API_KEY (required when USE_LOCAL=false)');
  }

  // Check for empty values
  for (const varName of REQUIRED_VARS) {
    if (process.env[varName] === '') {
      warnings.push(`${varName} is empty`);
    }
  }

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    console.error('\nPlease create a .env file with these variables.');
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn('⚠️  Environment variable warnings:');
    warnings.forEach(w => console.warn(`   - ${w}`));
  }

  console.log('✓ Environment configuration validated');
}

export function getConfig() {
  return {
    lmComplUrl: process.env.LM_COMPL_URL,
    lmEmbeddingUrl: process.env.LM_EMBEDDING_URL,
    routerModel: process.env.ROUTER_MODEL,
    taggerModel: process.env.TAGGER_MODEL,
    vlTaggerModel: process.env.VL_TAGGER_MODEL,
    embeddingModel: process.env.EMBEDDING_MODEL,
    dbPath: process.env.DB_PATH,
    useLocal: process.env.USE_LOCAL === 'true',
    openrouterApiKey: process.env.OPENROUTER_API_KEY
  };
}
