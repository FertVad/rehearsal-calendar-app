// T-231: a heavy job started beside an e2e run, the way it happened on
// 2026-11-07, run either directly (as `npm run ios` ran expo before the fix)
// or through e2e/hold-lock.mjs (as `npm run ios` runs it now).
//
//   node audit/evidence/T-231/job-beside-run.mjs <flow.yaml> direct|locked
//
// Starts e2e/run.mjs with the flow; once its flows start, starts the job
// (starve-metro.mjs, a stand-in for the build: it stops the run's Metro for
// 75 s if one is running). Waits for both and prints when each ran. Exits
// with the e2e run's code.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(here, '../../../rehearsal-calendar-native');
const [flow, mode] = process.argv.slice(2);
if (!flow || !['direct', 'locked'].includes(mode)) {
  console.error('usage: job-beside-run.mjs <flow.yaml> direct|locked');
  process.exit(64);
}
const say = (text) => console.log(`[beside ${new Date().toISOString()}] ${text}`);
const JOB = [path.join(here, 'starve-metro.mjs'), '75'];

let job = null;
let jobDone = Promise.resolve(null);
const run = spawn(process.execPath, ['e2e/run.mjs', flow], { cwd: app, stdio: ['ignore', 'pipe', 'inherit'] });
run.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  if (job || !String(chunk).includes('[e2e] running the flows')) return;
  const args = mode === 'direct' ? JOB : [path.join(app, 'e2e', 'hold-lock.mjs'), process.execPath, ...JOB];
  say(`the e2e run's flows started; starting the job ${mode === 'direct' ? 'directly' : 'through e2e/hold-lock.mjs'}`);
  job = spawn(process.execPath, args, { cwd: app, stdio: ['ignore', 'inherit', 'inherit'] });
  jobDone = new Promise((resolve) => job.on('exit', resolve));
});
const runCode = await new Promise((resolve) => run.on('exit', resolve));
say(`e2e/run.mjs exited ${runCode}`);
say(`the job exited ${await jobDone}`);
process.exit(runCode ?? 1);
