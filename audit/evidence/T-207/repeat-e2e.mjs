// T-207: one flow N times in one e2e run, the same way on two configs.
//
// Copies the flow into e2e/flows as zz-t207-r<i>.yaml (name "... r<i>"), runs
// npm run e2e on the copies, removes them. Each copy signs in again with a
// cleared app, so the runs are alike; one setup serves them all.
//
//   node audit/evidence/T-207/repeat-e2e.mjs [times] [flow]
//
// Run from the root of the tree; the flow path is relative to
// rehearsal-calendar-native.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const app = path.resolve('rehearsal-calendar-native');
// Copies a killed run left behind ("clean" removes them and stops there).
const flowsDir = path.join(app, 'e2e', 'flows');
for (const f of fs.readdirSync(flowsDir)) if (/^zz-t207-r\d+\.yaml$/.test(f)) fs.rmSync(path.join(flowsDir, f));
if (process.argv[2] === 'clean') process.exit(0);
const times = Number(process.argv[2] ?? 3);
const flow = process.argv[3] ?? 'e2e/flows/30-sync-import-fails-export-runs.yaml';
const source = fs.readFileSync(path.join(app, flow), 'utf8');

const copies = [];
for (let i = 1; i <= times; i++) {
  const file = path.join(app, 'e2e', 'flows', `zz-t207-r${i}.yaml`);
  fs.writeFileSync(file, source.replace(/^name: (.*)$/m, `name: $1 r${i}`));
  copies.push(file);
}
try {
  const { status } = spawnSync('npm', ['run', 'e2e', '--', ...copies.map((f) => path.relative(app, f))],
    { cwd: app, stdio: 'inherit' });
  process.exitCode = status ?? 1;
} finally {
  for (const file of copies) fs.rmSync(file, { force: true });
}
