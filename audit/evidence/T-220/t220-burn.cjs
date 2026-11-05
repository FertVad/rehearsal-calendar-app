// T-220 scratch: the red check under load, in the foreground —
// `node t220-burn.cjs <threads> <flow.yaml>…` keeps that many threads spinning
// while `npm run e2e -- <flows>` runs, and stops them when it ends.
const { Worker, isMainThread, workerData } = require('worker_threads');
const { spawn } = require('child_process');
if (isMainThread) {
  const [threads, ...flows] = process.argv.slice(2);
  const stop = new Int32Array(new SharedArrayBuffer(4));
  console.log(`[t220-burn] ${threads} threads spinning while the flows run`);
  for (let i = 0; i < Number(threads); i++) new Worker(__filename, { workerData: stop });
  const run = spawn('npm', ['run', 'e2e', '--', ...flows], { stdio: 'inherit' });
  run.on('exit', (code) => {
    Atomics.store(stop, 0, 1);
    console.log(`[t220-burn] e2e exited ${code}; load stopped`);
    process.exit(code ?? 1);
  });
} else {
  let x = 0;
  while (Atomics.load(workerData, 0) === 0) { for (let i = 0; i < 1e6; i++) x = (x * 31 + i) % 1000003; }
}
