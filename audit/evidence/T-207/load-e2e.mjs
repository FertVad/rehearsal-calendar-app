// T-207: repeat-e2e.mjs with the host's CPU kept busy.
//
// A lost tap is backboardd registering XCTest's per-tap virtual digitizer late:
// the first touch event comes in before the service is matched, the touch down
// and the lift go to two different touch states, and the touch is cancelled.
// Late means busy, so this keeps every core busy while the flows run.
//
//   node audit/evidence/T-207/load-e2e.mjs [workers] [times] [flow]
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';

const workers = Number(process.argv[2] ?? os.availableParallelism());
const rest = process.argv.slice(3);
console.log(`[load] ${workers} busy workers on ${os.availableParallelism()} cores`);
const busy = Array.from({ length: workers }, () =>
  new Worker('for (;;) { Math.sqrt(Math.random()); }', { eval: true }));

const { status } = spawnSync(process.execPath,
  [path.join(path.dirname(new URL(import.meta.url).pathname), 'repeat-e2e.mjs'), ...rest], { stdio: 'inherit' });
await Promise.all(busy.map((w) => w.terminate()));
process.exitCode = status ?? 1;
