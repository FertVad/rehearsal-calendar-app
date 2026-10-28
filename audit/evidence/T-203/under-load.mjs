#!/usr/bin/env node
// T-203: runs one e2e flow while every core of the Mac is kept busy, the way
// the supervisor's machine was when "From the planner to a rehearsal" failed.
//
//   node audit/evidence/T-203/under-load.mjs [flow.yaml] [burners]
//
// The burners are children of this process and are killed when the flow ends.
import { spawn, spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../rehearsal-calendar-native');
const flow = process.argv[2] || 'e2e/flows/06-planner-to-rehearsal.yaml';
const count = Number(process.argv[3] || os.cpus().length);

const burners = Array.from({ length: count }, () =>
  spawn(process.execPath, ['-e', 'for(;;){}'], { stdio: 'ignore' }));
const stop = () => { for (const b of burners) { try { b.kill('SIGKILL'); } catch { /* gone */ } } };
process.on('exit', stop);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stop(); process.exit(130); });

console.log(`[T-203] ${count} burners on ${os.cpus().length} cores; running ${flow}`);
const started = Date.now();
const run = spawnSync('npm', ['run', 'e2e', '--', flow], { cwd: ROOT, stdio: 'inherit' });
console.log(`[T-203] exit ${run.status} after ${Math.round((Date.now() - started) / 1000)}s`);
stop();
process.exitCode = run.status ?? 1;
