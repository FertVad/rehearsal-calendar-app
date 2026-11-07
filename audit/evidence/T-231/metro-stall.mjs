// T-231 probe: one e2e run in which Metro does not answer the app's bundle
// request for a while — what the red run of 224a38a showed (metro.log
// "iOS Bundled 96576ms index.ts (1 module)" while iOS gave up on the
// request at 60 s, NSURLErrorDomain -1001, and the dev client drew "Could not
// connect to development server").
//
// The stall there came from the machine (Maestro's clearAppState 73 s, an app
// install 3-5 min). Load on demand never got a run as far as the step that
// failed (T-203). So this stalls Metro alone, the one process whose silence
// the failure shows: once the flows run, at the first bundle request Metro
// logs, its process group gets SIGSTOP, and SIGCONT after PAUSE_S seconds.
//
//   node audit/evidence/T-231/metro-stall.mjs <flow.yaml> [PAUSE_S=75]
//
// Runs e2e/run.mjs with the flow in the foreground, its output passed through,
// and exits with its code.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../rehearsal-calendar-native');
const [flow, pauseArg] = process.argv.slice(2);
const pauseMs = Number(pauseArg ?? 75) * 1000;
const metroLog = path.join(app, 'e2e', 'out', 'metro.log');
const LOCK = '/tmp/rehearsly-e2e.lock';
const say = (text) => console.log(`[probe ${new Date().toISOString()}] ${text}`);

let stopped = null;
const resume = () => {
  if (!stopped) return;
  try { process.kill(-stopped, 'SIGCONT'); say(`SIGCONT to Metro's group ${stopped}`); } catch (error) { say(`SIGCONT: ${error.message}`); }
  stopped = null;
};

const child = spawn(process.execPath, ['e2e/run.mjs', flow], { cwd: app, stdio: ['ignore', 'pipe', 'pipe'] });
child.stderr.pipe(process.stderr);
let flowsRunning = false;
let offset = 0;
let done = false;
child.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  if (!flowsRunning && String(chunk).includes('[e2e] running the flows')) {
    flowsRunning = true;
    offset = fs.existsSync(metroLog) ? fs.statSync(metroLog).size : 0;
    say(`flows started; watching metro.log from byte ${offset} for the app's bundle request`);
  }
});

const timer = setInterval(() => {
  if (!flowsRunning || done || !fs.existsSync(metroLog)) return;
  const size = fs.statSync(metroLog).size;
  if (size <= offset) return;
  const fd = fs.openSync(metroLog, 'r');
  const buffer = Buffer.alloc(size - offset);
  fs.readSync(fd, buffer, 0, buffer.length, offset);
  fs.closeSync(fd);
  offset = size;
  if (!buffer.toString('utf8').includes('iOS ./index.ts')) return;
  done = true;
  const lock = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
  const metro = lock.groups.find((group) => group.name === 'metro');
  process.kill(-metro.pgid, 'SIGSTOP');
  stopped = metro.pgid;
  say(`the app asked Metro for its bundle: SIGSTOP to Metro's group ${metro.pgid} for ${pauseMs / 1000} s`);
  setTimeout(resume, pauseMs);
}, 100);

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { resume(); child.kill(signal); });
child.on('exit', (code) => {
  clearInterval(timer);
  resume();
  say(`e2e/run.mjs exited ${code}${done ? '' : ' (Metro was never stopped: no bundle request seen)'}`);
  process.exit(code ?? 1);
});
