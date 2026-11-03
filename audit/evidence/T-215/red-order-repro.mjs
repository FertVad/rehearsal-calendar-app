// T-215: the red run's file order, in one Jest run, while busy loops load the
// cores; the run's GC pauses are traced.
//
//   node audit/evidence/T-215/red-order-repro.mjs <in-band|one-worker> <burners-per-core> [deadline s]
//
// in-band runs Jest as npm test did before the fix (--runInBand), one-worker
// as it does after (--maxWorkers=1, with the configs' workerIdleMemoryLimit).
// The order comes from redOrderSequencer.cjs. The run, and with it every busy
// loop, is killed at the deadline (default 540 s), so nothing is left running.
import { spawn, spawnSync } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';

const app = fileURLToPath(new URL('../../../rehearsal-calendar-native/', import.meta.url));
const here = fileURLToPath(new URL('./', import.meta.url));
const [mode = 'in-band', perCore = '1', deadline = '540'] = process.argv.slice(2);
const workers = { 'in-band': '--runInBand', 'one-worker': '--maxWorkers=1' }[mode];
if (!workers) throw new Error(`unknown mode ${mode}`);

const git = (...args) => spawnSync('git', args, { cwd: app, encoding: 'utf8' }).stdout.trim();
console.log(`HEAD ${git('rev-parse', 'HEAD')}`);
console.log(`diff from HEAD: ${git('status', '--porcelain', '--', '.') || 'none'}`);
for (const f of ['jest.config.js', 'server/package.json', 'server/scripts/test.mjs',
  'server/__tests__/routes/membersAvailabilityRange.test.js']) console.log(`blob ${git('hash-object', f)} ${f}`);

const burners = Array.from({ length: availableParallelism() * Number(perCore) }, () =>
  spawn(process.execPath, ['-e', 'for(;;){}'], { stdio: 'ignore' }));
console.log(`mode ${mode} (${workers}), burners ${burners.length}, deadline ${deadline} s`);

const started = Date.now();
const jest = spawn(process.execPath, ['--trace-gc', '--experimental-vm-modules', 'node_modules/jest/bin/jest.js',
  workers, '--verbose', '--logHeapUsage', '--testSequencer', `${here}redOrderSequencer.cjs`], { cwd: app });
const filter = spawn(process.execPath, [`${here}gc-filter.mjs`, '300'], { stdio: ['pipe', 'inherit', 'inherit'] });
jest.stdout.pipe(filter.stdin, { end: false });
jest.stderr.pipe(filter.stdin, { end: false });
const timer = setTimeout(() => { console.log('=== deadline reached, run killed'); jest.kill('SIGKILL'); }, Number(deadline) * 1000);
jest.on('close', (code) => {
  clearTimeout(timer);
  for (const b of burners) b.kill('SIGKILL');
  filter.stdin.end();
  filter.on('close', () => console.log(`=== jest exit ${code}, ${((Date.now() - started) / 1000).toFixed(1)} s`));
});
