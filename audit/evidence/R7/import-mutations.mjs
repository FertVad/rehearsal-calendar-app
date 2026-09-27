// R7 calendar import (cause fix 4: EI01, EI03, EI04, ES02), server half: put
// each weakening back into a copy of the server and require the test that
// guards it to fail — in Jest, and on PostgreSQL where the SQLite harness cannot
// show it (a sync rolled back whole, a year of events in one body). The
// unmutated copy must pass both. A Jest expectation names a failed test ("●");
// a copy that fails to load its modules is refused (loadFailure).
//
//   node audit/evidence/R7/import-mutations.mjs
//
// Needs Node 22, Docker Desktop (desktop-linux) with postgres:15, as the R0 harness.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const server = path.resolve(fileURLToPath(new URL('../../../rehearsal-calendar-native/server', import.meta.url)));
const SCOPE = 'services/availability/importScope.js';
const ROUTE = 'routes/native/availability.js';
const APP = 'app.js';
const MAPPINGS = 'routes/native/calendarSync.js';
const jest = ['--experimental-vm-modules', 'node_modules/jest/bin/jest.js', '--runInBand', '--silent',
  '__tests__/routes/availabilityImportSync.test.js'];
const jestMappings = ['--experimental-vm-modules', 'node_modules/jest/bin/jest.js', '--runInBand', '--silent',
  '__tests__/routes/calendarMappingScope.test.js'];
const pg = ['scripts/r0-postgres.mjs', '--r7-only'];

function edit(root, file, from, to) {
  const target = path.join(root, file);
  const text = readFileSync(target, 'utf8');
  assert.equal(text.split(from).length, 2, `mutation anchor must occur once: ${from.slice(0, 60)}`);
  writeFileSync(target, text.replace(from, () => to));
}

const mutations = [
  { id: 'control', description: 'unmutated copy', runs: [jest, jestMappings, pg], expect: 'pass' },
  { id: 'diff-every-device', description: 'a sync diffs against every imported row of the person, not its calendar (EI01)',
    apply: (root) => edit(root, SCOPE, `       WHERE user_id = $1 AND source = $2 AND \${condition}
       AND ends_at >= $4::timestamptz`, `       WHERE user_id = $1 AND source = $2 AND $3 = $3
       AND ends_at >= $4::timestamptz`),
    runs: [jest, pg], expect: /● .*a sync on the second phone leaves what the first imported \(EI01\)/ },
  { id: 'no-transaction', description: 'a sync is applied statement by statement, outside one transaction (EI04)',
    apply: (root) => edit(root, ROUTE, 'await db.transaction((tx) => applySync(tx, req.userId, sync))',
      'await applySync(db, req.userId, sync)'),
    runs: [pg], expect: /EI04: a failed insert must leave the old time in place/ },
  { id: 'unreadable-cleared', description: 'a calendar that could not be read loses its rows as if unchosen (EI02 at the server)',
    apply: (root) => edit(root, SCOPE, 'const chosen = new Set([...sync.unreadable, ...sync.calendars',
      'const chosen = new Set([...sync.calendars'),
    runs: [jest], expect: /● .*keeps a calendar it could not read/ },
  { id: 'window-ignored', description: 'a sync deletes rows of its calendar outside the window it read',
    apply: (root) => edit(root, SCOPE, 'AND ends_at >= $4::timestamptz AND starts_at <= $5::timestamptz',
      'AND $4 = $4 AND $5 = $5'),
    runs: [jest], expect: /● .*leaves rows outside the window it read/ },
  { id: 'unlisted-calendar', description: 'a sync may write a calendar the device does not list',
    apply: (root) => edit(root, SCOPE, "typeof calendarId !== 'string' || !device.has(calendarId) ||",
      "typeof calendarId !== 'string' ||"),
    runs: [jest], expect: /● .*refuses a calendar the device does not list/ },
  { id: 'batch-unfenced', description: 'the old batch delete reaches rows of the device scope (EI01 through an older app)',
    apply: (root) => {
      const route = path.join(root, ROUTE);
      const text = readFileSync(route, 'utf8');
      assert.equal(text.split("AND external_event_id NOT LIKE 'cal:%'").length, 3, 'both batch routes are fenced');
      writeFileSync(route, text.replace("         AND external_event_id NOT LIKE 'cal:%'\n", ''));
    },
    runs: [jest, pg], expect: /● .*an older app cannot delete another device's rows through the old batch delete/ },
  { id: 'default-body-limit', description: 'the sync is parsed by the global 100kb parser',
    apply: (root) => edit(root, APP, 'IMPORT_SYNC_PATH.test(req.path) ? next() : json(req, res, next)',
      'json(req, res, next)'),
    runs: [pg], expect: /a year of events must fit one sync/ },
  { id: 'unsync-every-device', description: 'unsyncing a rehearsal on one phone deletes every phone\'s mapping of it (ES02)',
    // The scope stays in the SQL with its parameters bound, and stops choosing
    // anything: a dropped parameter would fail the request, not the scope.
    apply: (root) => edit(root, MAPPINGS, '` AND c.device_calendar_id IN (${inList(calendars, 4)})`',
      '` AND (c.device_calendar_id IN (${inList(calendars, 4)}) OR TRUE)`'),
    runs: [jestMappings, pg], expect: /● .*removes that phone's mapping and leaves the other phone's \(ES02\)/ },
  { id: 'clear-every-device', description: '"remove all exported" on one phone deletes every phone\'s mappings (ES02)',
    apply: (root) => edit(root, MAPPINGS, 'AND m.event_type = $2 AND c.device_calendar_id IN (${inList(calendars, 3)})',
      'AND m.event_type = $2 AND (c.device_calendar_id IN (${inList(calendars, 3)}) OR TRUE)'),
    runs: [jestMappings, pg], expect: /● .*removes that phone's mappings only \(ES02\)/ },
];

const results = [];
for (const mutation of mutations) {
  const parent = mkdtempSync(path.join(process.env.TMPDIR || tmpdir(), `r7-import-mutation-${mutation.id}-`));
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
