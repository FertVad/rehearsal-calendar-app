// Copies a run's screenshots into this folder (T-241).
// node audit/evidence/T-241/copy-shots.mjs <artifacts run dir> <flow name> <dest subdir>
import fs from 'node:fs';
import path from 'node:path';

const [run, flow, dest] = process.argv.slice(2);
const from = path.join(run, flow, 'takeScreenshot');
const to = path.join(path.dirname(new URL(import.meta.url).pathname), dest);
fs.mkdirSync(to, { recursive: true });
for (const name of fs.readdirSync(from).filter((n) => n.endsWith('.png'))) {
  fs.copyFileSync(path.join(from, name), path.join(to, name));
  console.log(path.join(dest, name));
}
