#!/usr/bin/env node
/**
 * Runs a heavy job on this Mac under the e2e lock (T-231):
 *
 *   node e2e/hold-lock.mjs <command> [args...]
 *   node e2e/hold-lock.mjs xcodebuild -workspace ios/Rehearsly.xcworkspace -configuration Release ...
 *
 * It waits for an e2e run that is going, holds the lock while the job runs,
 * and exits with the job's code. An e2e run started meanwhile waits for the
 * job, as for another run (e2e/run.mjs: takeLock).
 *
 * Why: on 2026-11-07 an iOS Release build on another simulator, from another
 * session, ran beside the full e2e run of 224a38a. For half an hour the Mac
 * was choked — an app install 3-5 minutes, Maestro's clearAppState 73 s, a
 * flow's launch that never ended — and Metro took 96 s over a bundle the app
 * had asked for at launch. iOS gives up on it at 60 s, the dev client drew
 * "Could not connect to development server", and flow 40 failed before its
 * first step of its own (docs/e2e.md, "Heavy jobs beside a run").
 *
 * The job runs in a process group of its own, which the lock names: if this
 * process is killed outright, the next e2e run stops the job before it starts,
 * as it stops a dead run's server and Metro.
 */
import { spawn } from 'node:child_process';
import { LOCK, takeLock } from './lock.mjs';

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('usage: node e2e/hold-lock.mjs <command> [args...]');
  process.exit(64);
}

const say = (text) => console.error(`[hold-lock] ${text}`);
const lock = await takeLock(process.env.REHEARSLY_E2E_LOCK || LOCK, { log: say, what: [command, ...args].join(' ') });
const job = spawn(command, args, { stdio: 'inherit', detached: true });
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
