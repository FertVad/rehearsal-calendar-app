// Copies the details' screenshot of a flow-71 run into this folder and prints
// what the details' ink checks answered (T-047 review).
// node copy-shots.mjs <artifacts dir> <name for the png>
import { copyFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [run, name] = process.argv.slice(2);
const flow = join(run, 'Nothing is blue, purple is doing and choosing');
copyFileSync(join(flow, 'takeScreenshot', '71-rehearsal-details.png'),
  join(dirname(fileURLToPath(import.meta.url)), name));
for (const step of JSON.parse(readFileSync(join(flow, 'commands.json'), 'utf8'))) {
  const script = step.command.runScriptCommand;
  if (script && script.env.SHOT === '71-rehearsal-details') {
    console.log(script.sourceDescription, JSON.stringify(script.env), step.metadata.status,
      step.metadata.error ? step.metadata.error.message : '');
  }
}
