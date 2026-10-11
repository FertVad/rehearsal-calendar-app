// Runs server/__tests__/browser/invitePage.browser.test.mjs N times in a row,
// the whole file in its own order, exactly as `npm test` does
// (`node --test` from rehearsal-calendar-native/server), and prints every
// failing test with the first lines of its error.
// Usage: node audit/evidence/T-204/repeat-invite-browser.mjs [runs] [busy threads]
// The optional busy threads keep that many CPU cores spinning meanwhile.
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Worker } from 'node:worker_threads';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const server = path.join(root, 'rehearsal-calendar-native/server');
const runs = Number(process.argv[2] || 10);
const busy = Number(process.argv[3] || 0);
const workers = Array.from({ length: busy }, () => new Worker('for (;;);', { eval: true }));
console.log(`node ${process.version}, ${os.cpus().length} cores, ${busy} busy threads`);
let failedRuns = 0;
const failures = new Map();

for (let run = 1; run <= runs; run++) {
  const result = spawnSync(process.execPath, ['--test', '__tests__/browser/invitePage.browser.test.mjs'], {
    cwd: server, encoding: 'utf8', env: { ...process.env, DATABASE_URL: undefined, POSTGRES_URL: undefined },
  });
  const output = result.stdout + result.stderr;
  const lines = output.split('\n');
  const failed = [];
  lines.forEach((line, index) => {
    const match = /^not ok \d+ - (.*)$/.exec(line);
    if (!match) return;
    const error = lines.slice(index + 1, index + 30).find(text => /^\s{4}\S/.test(text) && !/^\s+(duration_ms|type|location|failureType|error):/.test(text));
    failed.push(`${match[1]} — ${error?.trim() ?? '?'}`);
  });
  const summary = (/^# pass (\d+)/m.exec(output)?.[1] ?? '?') + ' pass, ' + (/^# fail (\d+)/m.exec(output)?.[1] ?? '?') + ' fail';
  console.log(`run ${run}: exit ${result.status}, ${summary}`);
  for (const text of failed) {
    console.log(`  not ok: ${text}`);
    failures.set(text, (failures.get(text) ?? 0) + 1);
  }
  if (result.status !== 0) failedRuns++;
}
console.log(`\n${failedRuns} of ${runs} runs failed`);
for (const [text, count] of failures) console.log(`  ${count}× ${text}`);
await Promise.all(workers.map(worker => worker.terminate()));
