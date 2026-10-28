// T-210: run Jest files repeatedly while every core is kept busy.
//
//   node audit/evidence/T-210/load-repro.mjs <rounds> <burners-per-core> <test file>...
//
// Burners are plain busy loops in child processes; they are killed when the
// rounds end. Each round is one in-band Jest run of the given files, as the
// checks run them (server/scripts/test.mjs passes --runInBand).
import { spawn, spawnSync } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';

const server = fileURLToPath(new URL('../../../rehearsal-calendar-native/server/', import.meta.url));
const [rounds = '5', perCore = '2', ...files] = process.argv.slice(2);
const cores = availableParallelism();
const burners = Array.from({ length: cores * Number(perCore) }, () =>
  spawn(process.execPath, ['-e', 'for(;;){}'], { stdio: 'ignore' }));

// What was run: the commit checked out, what differs from it, and the blob of
// each test file as it is on disk, to match against `git rev-parse <sha>:<path>`.
const git = (...args) => spawnSync('git', args, { cwd: server, encoding: 'utf8' }).stdout.trim();
console.log(`HEAD ${git('rev-parse', 'HEAD')}`);
console.log(`diff from HEAD: ${git('status', '--porcelain', '--', '.') || 'none'}`);
for (const f of files) console.log(`blob ${git('hash-object', f)} ${f}`);
console.log(`cores ${cores}, burners ${burners.length}, files ${files.join(' ')}`);
let red = 0;
try {
  for (let round = 1; round <= Number(rounds); round += 1) {
    const started = Date.now();
    const run = spawnSync(process.execPath, [
      '--experimental-vm-modules', 'node_modules/jest/bin/jest.js', '--runInBand', '--silent', ...files,
    ], { cwd: server, encoding: 'utf8' });
    const out = `${run.stdout}${run.stderr}`;
    const lines = out.split('\n').filter((l) =>
      /^(PASS|FAIL) |PROBE|Exceeded timeout|^Tests:|●/.test(l.trim()));
    if (run.status !== 0) red += 1;
    console.log(`--- round ${round}: exit ${run.status}, ${((Date.now() - started) / 1000).toFixed(1)} s`);
    console.log([...new Set(lines.map((l) => l.trim()))].join('\n'));
  }
} finally {
  for (const b of burners) b.kill('SIGKILL');
}
console.log(`=== red ${red} of ${rounds}`);
