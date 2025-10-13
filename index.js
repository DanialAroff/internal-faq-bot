import { ask, takeAction } from "./ai/ai.js";

const startTime = Date.now();
// const output = await ask("Tag this: E:\\Videos\\toroop\\1757670547554.jpg /no_think");
// await ask("Hey, I want to do a file search function using you. What kind of functions or backend API I need? Using NodeJS. /no_think");
const output = await ask(`Tag this: C:\\DH /no_think`);
// await ask("Find 1757670547554.jpg /no_think");
// console.log(`[${i + 1}] ${await ask("What you can do?")}`);
await takeAction(output);

const endTime = Date.now();
console.log(`Finished in: ${(endTime - startTime) / 1000} seconds`);