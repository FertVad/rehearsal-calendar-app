// Copies the screenshots a flow took in the latest e2e run into this folder,
// under <label>/: node audit/evidence/T-036/copy-shots.mjs <label>
// (T-036: "before" on the card of 203 pt, "after" on the row of 88 pt).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const label = process.argv[2];
if (!label) throw new Error('usage: copy-shots.mjs <label>');
const artifacts = path.join(here, '..', '..', '..', 'rehearsal-calendar-native', 'e2e', 'out', 'artifacts');
const run = fs.readdirSync(artifacts).filter((name) => /^\d{4}-/.test(name)).sort().at(-1);
const into = path.join(here, label);
fs.mkdirSync(into, { recursive: true });
for (const flow of fs.readdirSync(path.join(artifacts, run))) {
  const shots = path.join(artifacts, run, flow, 'takeScreenshot');
  if (!fs.existsSync(shots)) continue;
  for (const shot of fs.readdirSync(shots)) {
    fs.copyFileSync(path.join(shots, shot), path.join(into, shot));
    console.log(`${run}/${flow}/${shot} -> ${label}/${shot}`);
  }
}
