// T-231: a stand-in for a heavy job beside an e2e run. The real one (an iOS
// Release build, 2026-11-07) choked the Mac for half an hour, and in it Metro
// took 96 s over the bundle the app asked for at launch. This does only that
// part: if an e2e run holds the lock, it waits for the app's bundle request in
// that run's metro.log and stops its Metro for PAUSE_S seconds (SIGSTOP,
// SIGCONT). If none does, there is nothing beside it to starve.
//
//   node audit/evidence/T-231/starve-metro.mjs [PAUSE_S=75]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCK = '/tmp/rehearsly-e2e.lock';
const metroLog = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../rehearsal-calendar-native/e2e/out/metro.log');
const pauseMs = Number(process.argv[2] ?? 75) * 1000;
const say = (text) => console.log(`[job ${new Date().toISOString()}] ${text}`);

let metro = null;
try { metro = JSON.parse(fs.readFileSync(LOCK, 'utf8')).groups?.find((group) => group.name === 'metro') ?? null; } catch { /* no lock */ }
if (!metro) {
  say('started; no e2e run\'s Metro is running: nothing to starve');
  process.exit(0);
}
say(`started beside an e2e run (Metro group ${metro.pgid}); waiting for the app's bundle request`);
let offset = fs.existsSync(metroLog) ? fs.statSync(metroLog).size : 0;
let stopped = false;
const resume = () => { if (!stopped) return; stopped = false; try { process.kill(-metro.pgid, 'SIGCONT'); } catch { /* gone */ } say('SIGCONT to Metro'); };
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { resume(); process.exit(1); });
const timer = setInterval(() => {
  const size = fs.existsSync(metroLog) ? fs.statSync(metroLog).size : 0;
  if (size <= offset) return;
  const fd = fs.openSync(metroLog, 'r');
  const buffer = Buffer.alloc(size - offset);
  fs.readSync(fd, buffer, 0, buffer.length, offset);
  fs.closeSync(fd);
  offset = size;
  if (!buffer.toString('utf8').includes('iOS ./index.ts')) return;
  clearInterval(timer);
  try { process.kill(-metro.pgid, 'SIGSTOP'); } catch (error) { say(`SIGSTOP: ${error.message}`); process.exit(1); }
  stopped = true;
  say(`the app asked Metro for its bundle: SIGSTOP to Metro for ${pauseMs / 1000} s`);
  setTimeout(() => { resume(); process.exit(0); }, pauseMs);
}, 100);
// The run ended without asking: nothing more to do beside it.
setTimeout(() => { clearInterval(timer); say('no bundle request in 10 min'); process.exit(0); }, 10 * 60 * 1000).unref();
