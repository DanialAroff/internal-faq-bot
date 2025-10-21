import { validateConfig } from "./utils/config.js";
import { ask, takeAction } from "./ai/ai.js";
import { closeDb } from "./utils/db.js";

// Validate configuration before doing anything else
validateConfig();

const startTime = Date.now();
// const output = await ask("Tag this: E:\\Videos\\toroop\\1757670547554.jpg \n /no_think");
// const output = await ask("Tag this: C:\\Users\\User\\Downloads\\Q\\photo_2025-10-12_17-52-43.jpg \n /no_think");
// const output = await ask(`Tag this: D:\\Misc\\Memory \n\n/no_think`);
const output = await ask(`Re-tag this: D:\\Misc\\Memory \n\n/no_think`);
// const output = await ask(`Tag this: C:\\Users\\User\\Downloads \n\n/no_think`);
// const output = await ask(`Why the world is round? \n/no_think`);
// const output = await ask(`To restart the backend, run pm2 restart backend or systemctl restart backend.service. \n/no_think`);
await takeAction(output);

const endTime = Date.now();
console.log(`Finished in: ${(endTime - startTime) / 1000} seconds`);
closeDb();