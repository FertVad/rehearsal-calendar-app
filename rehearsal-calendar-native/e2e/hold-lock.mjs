#!/usr/bin/env node
/**
 * Runs a heavy job on this Mac under the e2e lock (T-231):
 *
 *   node e2e/hold-lock.mjs <command> [args...]
 *   node e2e/hold-lock.mjs xcodebuild -workspace ios/Rehearsly.xcworkspace … archive
 *   npm run ios -- --configuration Release      (package.json runs expo through it)
 *
 * It waits for an e2e run that is going, holds the lock while the job runs,
 * and exits with the job's code. An e2e run started meanwhile waits for the
 * job, as for another run (e2e/run.mjs: takeLock).
 *
 * Why: on 2026-11-07 an interactive Claude session ran xcodebuild by hand — a
 * Release build for a simulator, then an `archive` — beside the full e2e run
 * of 224a38a (`npm run ios` was not run). For half an hour the Mac was
 * choked — an app install 3-5 minutes, Maestro's clearAppState 73 s, a flow's
 * launch that never ended — and Metro took 96 s over a bundle the app had
 * asked for at launch. iOS gives up on it at 60 s, the dev client drew
 * "Could not connect to development server", and flow 40 failed before its
 * first step of its own (docs/e2e.md, "Heavy jobs beside a run").
 *
 * The job runs through watchdog.mjs, whose group the lock names, with a pipe
 * from this process on the watchdog's fd 3; its stdin, stdout and stderr stay
 * the terminal, so expo can still ask which device. If this process is killed
 * outright the system closes the pipe and the watchdog takes the job's whole
 * group down, its children too — no `ps` needed, which the developer's sandbox
 * denies — and exits only once that group is empty. The next run waits for
 * the watchdog's group to end before it takes the lock (lock.mjs:
 * clearLeftovers), so no part of the job runs beside it.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCK, takeLock } from './lock.mjs';

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('usage: node e2e/hold-lock.mjs <command> [args...]');
  process.exit(64);
}

const WATCHDOG = path.join(path.dirname(fileURLToPath(import.meta.url)), 'watchdog.mjs');
const say = (text) => console.error(`[hold-lock] ${text}`);
let lock;
try {
  lock = await takeLock(process.env.REHEARSLY_E2E_LOCK || LOCK, { log: say, what: [command, ...args].join(' ') });
} catch (error) {
  say(error.message);
  process.exit(75);
}
// The terminal stays the job's: fd 3 is the pipe the watchdog watches.
const job = spawn(process.execPath, [WATCHDOG, command, ...args], { stdio: ['inherit', 'inherit', 'inherit', 'pipe'], detached: true });
job.once('spawn', () => lock.record('job', job.pid));
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => { try { process.kill(-job.pid, signal); } catch { /* gone */ } });
}
job.once('error', (error) => {
  lock.release();
  say(`${command}: ${error.message}`);
  process.exit(127);
});
job.once('exit', (code, signal) => {
  lock.release();
  process.exit(code ?? (signal ? 128 + ({ SIGINT: 2, SIGTERM: 15, SIGHUP: 1, SIGKILL: 9 }[signal] ?? 0) : 1));
});
