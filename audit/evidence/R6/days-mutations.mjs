// R6 editor save (cause fix 2: CC05, C02, C03), server half: put each
// weakening back into a copy of the server and require the test that guards it
// to fail — in Jest, and on PostgreSQL for the concurrent save. The unmutated
// copy must pass both. A Jest expectation names a failed test ("●"); a copy
// that fails to load its modules is refused (loadFailure).
//
//   node audit/evidence/R6/days-mutations.mjs
//
// Needs Node 22, Docker Desktop (desktop-linux) with postgres:15, as the R0 harness.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const server = path.resolve(fileURLToPath(new URL('../../../rehearsal-calendar-native/server', import.meta.url)));
const DAYS = 'services/availability/manualDays.js';
const ROUTE = 'routes/native/availability.js';
const jest = ['--experimental-vm-modules', 'node_modules/jest/bin/jest.js', '--runInBand', '--silent',
  '__tests__/routes/availabilityDays.test.js', '__tests__/routes/availabilityBulk.test.js'];
const pg = ['scripts/r0-postgres.mjs', '--r6-only'];

function edit(root, file, from, to) {
  const target = path.join(root, file);
  const text = readFileSync(target, 'utf8');
  assert.equal(text.split(from).length, 2, `mutation anchor must occur once: ${from.slice(0, 60)}`);
  writeFileSync(target, text.replace(from, () => to));
}

const mutations = [
  { id: 'control', description: 'unmutated copy', runs: [jest, pg], expect: 'pass' },
  { id: 'written-unchecked', description: 'the request is not checked before writing (C02)',
    apply: (root) => edit(root, ROUTE, '    days = checkDays(req.body?.days);\n', '    days = req.body?.days;\n'),
    runs: [jest, pg], expect: /● .*refuses a slot without an end, and keeps the other day in the request unwritten/ },
  { id: 'bulk-unchecked', description: 'the legacy bulk save deletes before checking its hand-entered entries (C02, R6-01)',
    apply: (root) => edit(root, ROUTE, '    checkBulkEntries(entries);\n', ''),
    runs: [jest, pg], expect: /● .*refuses an entry without an end, and deletes nothing/ },
  { id: 'no-person-lock', description: 'saves of one person are not serialised (C03)',
    apply: (root) => edit(root, DAYS, '  await lockOwnAvailability(tx, userId);\n  for (const day of days) {', '  for (const day of days) {'),
    runs: [pg], expect: /C03: two concurrent saves of one day must leave one of them, not both/ },
  { id: 'every-day-replaced', description: 'a save replaces days it does not name (CC05)',
    apply: (root) => edit(root, DAYS, '     AND DATE(starts_at AT TIME ZONE $2) = $3\n', '     AND ($2 = $2 OR $3 = $3)\n'),
    runs: [jest], expect: /● .*leaves the days it does not name as they are/ },
  { id: 'imported-replaced', description: 'a save removes rehearsal and imported rows of the day',
    apply: (root) => edit(root, DAYS, '     AND source = $4`,\n    [userId, timezone, date, AVAILABILITY_SOURCES.MANUAL]',
      '     AND $4 = $4`,\n    [userId, timezone, date, AVAILABILITY_SOURCES.MANUAL]'),
    runs: [jest], expect: /● .*leaves the rehearsal and the imported event on a replaced day alone/ },
];

const results = [];
for (const mutation of mutations) {
  const parent = mkdtempSync(path.join(process.env.TMPDIR || tmpdir(), `r6-days-mutation-${mutation.id}-`));
  const root = path.join(parent, 'server');
  try {
    cpSync(server, root, { recursive: true, filter: (source) => !source.includes(`${path.sep}node_modules`)
      && path.basename(source) !== '.env' });
    symlinkSync(path.join(server, 'node_modules'), path.join(root, 'node_modules'));
    symlinkSync(path.join(server, '..', 'shared'), path.join(parent, 'shared'));
    if (mutation.apply) mutation.apply(root);
    const outputs = [];
    const detail = [];
    let failed = false;
    for (const args of mutation.runs) {
      const started = Date.now();
      const run = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 300000,
        maxBuffer: 16 * 1024 * 1024, env: { PATH: process.env.PATH, HOME: process.env.HOME } });
      const output = `${run.stdout}\n${run.stderr}`;
      outputs.push(output);
      if (run.status !== 0) failed = true;
      detail.push({ run: args.at(-1), exit: run.status, seconds: Math.round((Date.now() - started) / 100) / 10,
        passedPg: (output.match(/REGRESSION PASS/) || [null])[0],
        firstFailure: (output.split('\n').find((line) => /●|AssertionError|Expected|!==/.test(line)) || '').trim().slice(0, 160) || null });
    }
    const output = outputs.join('\n');
    const loadFailure = /does not provide an export named|Test suite failed to run|Cannot find module/.test(output);
    const caught = mutation.expect === 'pass' ? !failed : failed && !loadFailure && mutation.expect.test(output);
    results.push(caught);
    console.log(JSON.stringify({ mutation: mutation.id, description: mutation.description,
      detail, suitesFailed: failed, loadFailure,
      expected: mutation.expect === 'pass' ? 'all pass' : 'guard test fails', result: caught ? 'PASS' : 'FAIL' }));
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}
const failures = results.filter((ok) => !ok).length;
console.log(JSON.stringify({ summary: failures ? 'FAIL' : 'PASS', mutations: results.length, failures }));
process.exitCode = failures ? 1 : 0;
