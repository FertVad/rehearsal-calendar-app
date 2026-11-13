// T-253: copies the landing's (d3's) German runs of 10.11 and 12.11 out of
// ~/.maestro/tests into audit/evidence/T-253/d3: each run's maestro.log and
// the screenshots it took. The device-simulator.log files (0.3-4 MB each)
// are not copied; d3-touches.mjs --save cuts the lost touches out of them.
// Usage: node audit/evidence/T-253/d3-extract.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.join(os.homedir(), '.maestro', 'tests');
const out = path.join(path.dirname(new URL(import.meta.url).pathname), 'd3');
export const RUNS = [
  '2026-11-10_183616/planner', // 10.11, DE, the tap that did nothing
  '2026-11-10_183828/planner', // 10.11, DE, again: opened
  '2026-11-12_084658/form', // the form over Profil, closed at 50 %, 50 %
  '2026-11-12_084753/planner', // attempt 1, 08:48:04
  '2026-11-12_084815/sync', // sync on; its first tap (Profil) lost too
  '2026-11-12_084850/finish', // remove all: 50 %, 52 % then 50 %, 55 %; sync off
  '2026-11-12_085028/planner', // attempt 2, 08:50:40
  '2026-11-12_085110/planner-pt', // attempt 3, 08:51:22
  '2026-11-12_085203/probe', // Kalender, then Planner: both opened
  '2026-11-12_085243/probe2', // Profil -> Planner: opened
  '2026-11-12_085316/planner', // the planner shot again: opened
];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  for (const r of RUNS) {
    const [run] = r.split('/');
    const files = [path.join(root, run, 'maestro.log'),
      ...walk(path.join(root, r)).filter((f) => f.endsWith('.png') && f.includes('takeScreenshot'))];
    for (const f of files) {
      const dest = path.join(out, path.relative(root, f));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(f, dest);
    }
  }
  console.log('copied', RUNS.length, 'runs to', out);
}
