// T-207 reproduction: one e2e flow under load of the kind the red run had.
//
// Maestro writes a screenshot and a view hierarchy into e2e/out/artifacts for
// some steps. This does the same, more often: while the flow runs, a .png and
// a .json go into e2e/out/artifacts/churn-<pid> every INTERVAL ms. On a config
// where Metro watches e2e/out each pair is a change, an HMR update-start, and
// the "Refreshing..." banner; on one where it does not, it is nothing.
//
//   node audit/evidence/T-207/churn-e2e.mjs [flow] [interval ms]
//
// Run from the root of the tree; the flow path is relative to
// rehearsal-calendar-native. The churn directory is removed at the end.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const app = path.resolve('rehearsal-calendar-native');
const flow = process.argv[2] ?? 'e2e/flows/30-sync-import-fails-export-runs.yaml';
const interval = Number(process.argv[3] ?? 700);
const dir = path.join(app, 'e2e', 'out', 'artifacts', `churn-${process.pid}`);

let written = 0;
const timer = setInterval(() => {
  fs.mkdirSync(dir, { recursive: true });
  const name = `step-${String(written).padStart(4, '0')}-churn`;
  fs.writeFileSync(path.join(dir, `${name}.png`), Buffer.from(`churn ${Date.now()}`));
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify({ at: Date.now() }));
  written++;
}, interval);

const child = spawn('npm', ['run', 'e2e', '--', flow], { cwd: app, stdio: 'inherit' });
child.on('exit', (code, signal) => {
  clearInterval(timer);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\n[churn] ${written} pairs written into ${path.relative(app, dir)} every ${interval} ms`);
  console.log(`[churn] e2e exit ${code ?? signal}`);
  process.exit(code ?? 1);
});
