// Runs e2e/__tests__/metro-watch.test.mjs N times at once, to load the machine
// the way the supervisor's `npm test` does, and counts the runs that fail.
// Usage: node audit/evidence/T-048/metro-watch-parallel.mjs [N]
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(here, '..', '..', '..', 'rehearsal-calendar-native');
const n = Number(process.argv[2] ?? 12);
const runs = Array.from({ length: n }, () => new Promise((resolve) => {
  let out = '';
  const child = spawn(process.execPath, ['--test', 'e2e/__tests__/metro-watch.test.mjs'], { cwd: app });
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  child.on('close', (code) => resolve({ code, out }));
}));
const results = await Promise.all(runs);
const failed = results.filter((r) => r.code !== 0);
for (const r of failed) {
  const line = r.out.split('\n').find((l) => l.includes('AssertionError') || l.includes('heard'));
  console.log(`fail: ${line?.trim()}`);
}
console.log(`${n} runs at once: ${n - failed.length} green, ${failed.length} red`);
