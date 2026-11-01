// T-215: the red run's file order in one Jest run, quiet until the run nears
// the failing file, then busy loops on every core, as the red run had the
// machine loaded around it. Quiet, the run reaches the file in about 465 s, so
// the load starts late enough that the whole command fits in 10 minutes.
//
//   node audit/evidence/T-215/late-load-repro.mjs <in-band|one-worker> <burners-per-core> <files-before-target> [deadline s] [repeat]
//
// in-band runs Jest as npm test did before the fix (--runInBand), one-worker
// as it does after (--maxWorkers=1, with the configs' workerIdleMemoryLimit).
// The order comes from redOrderSequencer.cjs (red-run-checks.log). With
// repeat n, n byte-identical copies of membersAvailabilityRange.test.js run
// right after it (membersAvailabilityRange.repeat<i>.test.js beside it, made
// here and removed when the run ends): the same test again, in the same
// process, on the heap the red order left. The busy loops start once the
// result line of the file <files-before-target> places before the target is
// printed; with 0, once liveReporter.cjs says the target has started.
//
// Prints the commit, the blobs of the files the fix touches, each result line,
// GC pauses of 300 ms and more, liveReporter.cjs's lines (the first test of
// the target and of each copy, and any of their tests that failed) and a count.
// Jest and every busy loop are killed at the deadline.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { availableParallelism } from 'node:os';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const app = fileURLToPath(new URL('../../../rehearsal-calendar-native/', import.meta.url));
const here = fileURLToPath(new URL('./', import.meta.url));
const [mode = 'in-band', perCore = '2', before = '12', deadline = '580', repeat = '0'] = process.argv.slice(2);
const workers = { 'in-band': '--runInBand', 'one-worker': '--maxWorkers=1' }[mode];
if (!workers) throw new Error(`unknown mode ${mode}`);

const target = 'server/__tests__/routes/membersAvailabilityRange.test.js';
process.env.T215_REPEAT = repeat;
const { order } = createRequire(import.meta.url)('./redOrderSequencer.cjs');
const trigger = order[order.indexOf(target) - Number(before)];
const copies = order.slice(order.indexOf(target) + 1).map((p) => `${app}${p}`);
for (const copy of copies) copyFileSync(`${app}${target}`, copy);
const removeCopies = () => { for (const copy of copies) rmSync(copy, { force: true }); };
process.on('exit', removeCopies);

const git = (...args) => spawnSync('git', args, { cwd: app, encoding: 'utf8' }).stdout.trim();
console.log(`HEAD ${git('rev-parse', 'HEAD')}`);
console.log(`diff from HEAD: ${git('status', '--porcelain', '--', 'jest.config.js', 'server') || 'none'}`);
for (const f of ['jest.config.js', 'server/package.json', 'server/scripts/test.mjs', target,
  ...copies.map((c) => c.slice(app.length))]) console.log(`blob ${git('hash-object', f)} ${f}`);
console.log(`mode ${mode} (${workers}), ${order.length} files (${copies.length} copies of the target), ` +
  `load ${perCore} busy loops per core from after ${trigger} (${before} files before the target), deadline ${deadline} s`);

const started = Date.now();
const at = () => `${((Date.now() - started) / 1000).toFixed(1)} s`;
let burners = [];
const stopBurners = () => { for (const b of burners) b.kill('SIGKILL'); burners = []; };

const jest = spawn(process.execPath, ['--trace-gc', '--experimental-vm-modules', 'node_modules/jest/bin/jest.js',
  workers, '--logHeapUsage', '--testSequencer', `${here}redOrderSequencer.cjs`,
  '--reporters', 'default', '--reporters', `${here}liveReporter.cjs`], { cwd: app });

let pauses = 0;
let total = 0;
let firstPassed = 0;
let firstFailed = 0;
let otherFailed = 0;
const read = (stream) => createInterface({ input: stream }).on('line', (raw) => {
  const line = raw.trim();
  const gc = line.match(/(\d+) ms: (Mark-Compact|Scavenge|Mark-Compact \(reduce\)|Minor Mark-Sweep)[^,]*?([\d.]+) \([\d.]+\) -> ([\d.]+).*?MB, .*?([\d.]+) \/ [\d.]+ ms/);
  if (gc) {
    const pause = Number(gc[5]);
    total += pause;
    if (pause >= 300) {
      pauses += 1;
      console.log(`  GC at ${at()}: ${gc[2]} ${gc[3]} -> ${gc[4]} MB, pause ${pause} ms`);
    }
    return;
  }
  if (/^LIVE /.test(line)) {
    console.log(line);
    const first = line.includes('"says whether');
    if (/\] passed /.test(line) && first) firstPassed += 1;
    if (/\] failed /.test(line)) { if (first) firstFailed += 1; else otherFailed += 1; }
  } else if (/^(PASS|FAIL) /.test(line)) {
    console.log(`[${at()}] ${line}`);
  } else {
    if (/Exceeded timeout|^Tests:|^Time:/.test(line)) console.log(line);
    return;
  }
  if (burners.length === 0 && line.includes(trigger) && !/^LIVE .*\] (passed|failed) /.test(line)) {
    burners = Array.from({ length: availableParallelism() * Number(perCore) }, () =>
      spawn(process.execPath, ['-e', 'for(;;){}'], { stdio: 'ignore' }));
    console.log(`=== ${burners.length} busy loops started at ${at()}`);
  }
});
read(jest.stdout);
read(jest.stderr);

// Killed from outside (a terminal's own time limit): the same cleanup.
for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
  process.on(signal, () => { jest.kill('SIGKILL'); stopBurners(); process.exit(130); });
}

const timer = setTimeout(() => { console.log(`=== deadline reached at ${at()}, run killed`); jest.kill('SIGKILL'); },
  Number(deadline) * 1000);
jest.on('close', (code) => {
  clearTimeout(timer);
  stopBurners();
  removeCopies();
  console.log(`=== "says whether they have ever recorded anything": ${firstFailed} failed, ${firstPassed} passed; ` +
    `other tests of the target and its copies failed: ${otherFailed}`);
  console.log(`=== ${pauses} pauses of 300 ms or more; all pauses together ${(total / 1000).toFixed(1)} s`);
  console.log(`=== jest exit ${code}, ${at()}`);
});
