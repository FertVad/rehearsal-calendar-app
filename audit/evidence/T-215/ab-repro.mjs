// T-215: the test before and after the fix, alternately, under the same load.
//
//   node audit/evidence/T-215/ab-repro.mjs <base sha> <pairs> <burners-per-core>
//
// As T-210's: the "before" file is the test as it is in <base sha>, written
// next to the working-tree one (so its imports resolve) and removed afterwards.
// Each pair runs both, each one in-band Jest run, while busy loops keep every
// core loaded. Each run prints how long its first test and the slowest of the
// others took, as Jest reports them.
import { spawn, spawnSync } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const server = fileURLToPath(new URL('../../../rehearsal-calendar-native/server/', import.meta.url));
const test = '__tests__/routes/membersAvailabilityRange.test.js';
const before = '__tests__/routes/membersAvailabilityRangeBefore.test.js';
const [base, pairs = '10', perCore = '10'] = process.argv.slice(2);
const git = (...args) => spawnSync('git', args, { cwd: server, encoding: 'utf8' }).stdout.trim();

const baseSha = git('rev-parse', `${base}^{commit}`);
if (!baseSha) throw new Error(`unknown commit ${base}`);
writeFileSync(`${server}${before}`, git('show', `${baseSha}:./${test}`) + '\n');
console.log(`HEAD ${git('rev-parse', 'HEAD')}`);
const diff = git('status', '--porcelain', '--', '.').split('\n').filter((l) => l && !l.endsWith(before));
console.log(`diff from HEAD: ${diff.join('; ') || 'none'}`);
console.log(`before: ${before} = ${base} (${baseSha}):${test}, blob ${git('hash-object', before)}`);
console.log(`after:  ${test} as on disk, blob ${git('hash-object', test)}`);

const cores = availableParallelism();
const burners = Array.from({ length: cores * Number(perCore) }, () =>
  spawn(process.execPath, ['-e', 'for(;;){}'], { stdio: 'ignore' }));
console.log(`cores ${cores}, burners ${burners.length}, pairs ${pairs}`);

const red = { before: 0, after: 0 };
const firsts = { before: [], after: [] };
const run = (label, file) => {
  const started = Date.now();
  const result = spawnSync(process.execPath, [
    '--experimental-vm-modules', 'node_modules/jest/bin/jest.js', '--runInBand', '--verbose', '--runTestsByPath', file,
  ], { cwd: server, encoding: 'utf8' });
  const out = `${result.stdout}${result.stderr}`;
  const times = [...out.matchAll(/^\s*[✓✕] .*?(?:\((\d+) ms\))?$/gm)].map((m) => Number(m[1] ?? 0));
  const failed = out.split('\n').filter((l) => l.trim().startsWith('●')).length;
  const timedOut = out.includes('Exceeded timeout of 5000 ms for a test') ? ', test timed out' : '';
  if (result.status !== 0) red[label] += 1;
  firsts[label].push(times[0]);
  console.log(`${label.padEnd(6)} exit ${result.status}, ${((Date.now() - started) / 1000).toFixed(1)} s, ` +
    `first test ${times[0]} ms, slowest other ${Math.max(...times.slice(1))} ms, ${failed} failed${timedOut}`);
};
try {
  for (let pair = 1; pair <= Number(pairs); pair += 1) {
    // Odd pairs start with before, even ones with after.
    console.log(`--- pair ${pair}`);
    if (pair % 2) { run('before', before); run('after', test); } else { run('after', test); run('before', before); }
  }
} finally {
  for (const b of burners) b.kill('SIGKILL');
  rmSync(`${server}${before}`, { force: true });
}
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
for (const side of ['before', 'after']) {
  console.log(`=== ${side}: red ${red[side]} of ${pairs}, first test median ${median(firsts[side])} ms, max ${Math.max(...firsts[side])} ms`);
}
