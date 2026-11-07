// Copies the screenshots of the latest e2e run into this folder, under
// <label>/: node audit/evidence/T-032/copy-shots.mjs <label>
// The flow's own (takeScreenshot/) and, for a run that failed, Maestro's shot
// of the step it failed on (screenshots/, the last one), which on the old code
// is the planner with its "←" (T-032).
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
  const dir = path.join(artifacts, run, flow);
  if (!fs.statSync(dir).isDirectory()) continue;
  const shots = path.join(dir, 'takeScreenshot');
  if (fs.existsSync(shots)) {
    for (const shot of fs.readdirSync(shots)) {
      fs.copyFileSync(path.join(shots, shot), path.join(into, shot));
      console.log(`${run}/${flow}/takeScreenshot/${shot} -> ${label}/${shot}`);
    }
  }
  const failed = path.join(dir, 'screenshots');
  if (fs.existsSync(failed)) {
    const last = fs.readdirSync(failed).filter((name) => name.endsWith('.png')).sort().at(-1);
    if (last) {
      const name = `failed-at-${last.replace(/[^\w.-]/g, '')}`;
      fs.copyFileSync(path.join(failed, last), path.join(into, name));
      console.log(`${run}/${flow}/screenshots/${last} -> ${label}/${name}`);
    }
  }
}
