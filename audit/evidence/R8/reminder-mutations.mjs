// R8 rehearsal reminders (cause fix 5: GR01, GR02, GR03, GR05, G02; review
// R8-01, R8-02), server
// half: put each weakening back into a copy of the server and require the test
// that guards it to fail — in Jest, and on PostgreSQL where only a real engine
// shows it (a row lock a move waits on). The unmutated copy must pass both. A
// Jest expectation names a failed test ("●"); a copy that fails to load its
// modules is refused (loadFailure). A run that fails without an assertion says
// why in its last line.
//
//   node audit/evidence/R8/reminder-mutations.mjs
//
// Needs Node 22, Docker Desktop (desktop-linux) with postgres:15, as the R0
// harness. Run it alone: it starts its own PostgreSQL containers.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const server = path.resolve(fileURLToPath(new URL('../../../rehearsal-calendar-native/server', import.meta.url)));
const SCHEDULER = 'services/notifications/reminderScheduler.js';
const PUSH = 'services/notifications/pushNotificationService.js';
const STORE = 'services/notifications/notificationStore.js';
const ROUTE = 'routes/cron.js';
const jestRun = (file) => ['--experimental-vm-modules', 'node_modules/jest/bin/jest.js', '--runInBand', '--silent', file];
const jest = jestRun('__tests__/integration/reminderScheduler.integration.test.js');
const jestRoute = jestRun('__tests__/routes/cronReminders.test.js');
const pg = ['scripts/r0-postgres.mjs', '--r8-only'];

function edit(root, file, from, to) {
  const target = path.join(root, file);
  const text = readFileSync(target, 'utf8');
  assert.equal(text.split(from).length, 2, `mutation anchor must occur once: ${from.slice(0, 60)}`);
  writeFileSync(target, text.replace(from, () => to));
}

const mutations = [
  { id: 'control', description: 'unmutated copy', runs: [jest, jestRoute, pg], expect: 'pass' },
  { id: 'no-transaction', description: 'a rehearsal is reminded statement by statement, outside one transaction (GR02)',
    apply: (root) => edit(root, SCHEDULER, 'await db.transaction((tx) => remindRehearsal(tx, {\n        rehearsal, type, from, to, notify, now, expo, idleInTransactionMs,\n      }));',
      'await remindRehearsal(db, {\n        rehearsal, type, from, to, notify, now, expo, idleInTransactionMs,\n      });'),
    runs: [jest, pg], expect: /● .*a run that stops between the claim and the push \(GR02\) › leaves nobody claimed/ },
  { id: 'inbox-failure-swallowed', description: 'a failed inbox row inside the transaction is logged and the send goes on (GR02)',
    apply: (root) => edit(root, STORE, '      if (executor !== db) throw err;\n', ''),
    runs: [jest], expect: /● .*a run that stops between the claim and the push \(GR02\) › leaves nobody claimed/ },
  { id: 'failure-reported-as-delivery', description: 'the push service counts everyone with a device as delivered (GR01)',
    apply: (root) => edit(root, PUSH, '  outcome.delivered = [...reachable].filter((id) => accepted.has(id));\n  outcome.undelivered = [...reachable].filter((id) => !accepted.has(id));',
      '  outcome.delivered = [...reachable];\n  outcome.undelivered = [];'),
    runs: [jest], expect: /● .*a push that did not go out \(GR01\) › Expo down/ },
  { id: 'claim-kept-on-failure', description: 'the claims of people nobody reached are kept (GR01)',
    apply: (root) => edit(root, SCHEDULER, '  if (retry.length > 0) {\n    await tx.run(', '  if (retry.length < 0) {\n    await tx.run('),
    runs: [jest], expect: /● .*a push that did not go out \(GR01\) › Expo down/ },
  { id: 'inbox-doubled-on-retry', description: 'the inbox rows of people nobody reached are kept, so each retry adds one (GR01)',
    apply: (root) => edit(root, SCHEDULER, '    if (rows.length > 0) {\n', '    if (rows.length < 0) {\n'),
    runs: [jest], expect: /● .*a push that did not go out \(GR01\) › Expo down/ },
  { id: 'start-not-checked', description: 'a rehearsal is claimed wherever it starts now (GR05)',
    apply: (root) => edit(root, SCHEDULER, 'AND starts_at BETWEEN $2 AND $3\n     FOR SHARE', "AND $2 <> '' AND $3 <> ''\n     FOR SHARE"),
    runs: [jest, pg], expect: /● .*a rehearsal moved after the run read it \(GR05\)/ },
  { id: 'no-share-lock', description: 'the rehearsal is not held while it is reminded, so a move does not wait (GR05)',
    apply: (root) => edit(root, SCHEDULER, 'AND starts_at BETWEEN $2 AND $3\n     FOR SHARE', 'AND starts_at BETWEEN $2 AND $3'),
    runs: [pg], expect: /timed out waiting for the reminder to wait on the moved rehearsal|GR05/ },
  { id: 'exact-start-again', description: 'the start is compared with the copy the run read, at millisecond precision (R8-02)',
    apply: (root) => {
      edit(root, SCHEDULER, 'AND starts_at BETWEEN $2 AND $3\n     FOR SHARE', 'AND starts_at = $2::timestamptz AND $3 <> \'\'\n     FOR SHARE');
      edit(root, SCHEDULER, '[rehearsal.id, from.toISOString(), to.toISOString()]',
        '[rehearsal.id, new Date(rehearsal.starts_at).toISOString(), to.toISOString()]');
    },
    runs: [pg], expect: /R8-02: a start stored to the microsecond must still be reminded/ },
  { id: 'no-deadline', description: 'a request to Expo waits as long as Expo does (R8-01)',
    apply: (root) => edit(root, PUSH, "      }, timeoutMs);\n      request.on('error'", "      }, 2 ** 31 - 1);\n      request.on('error'"),
    runs: [jest, pg], expect: /● .*an Expo that takes the request and never answers \(R8-01\) › gives up at the deadline/ },
  { id: 'no-db-backstop', description: 'a reminder transaction is not ended when its worker stalls (R8-01)',
    apply: (root) => edit(root, SCHEDULER, "  await tx.run(`SET LOCAL idle_in_transaction_session_timeout = ${Math.max(1, Math.trunc(idleInTransactionMs))}`);\n", ''),
    runs: [pg], expect: /R8-01: (the edit stayed behind a stalled reminder|a run whose transaction was ended must say it failed|nothing a stalled transaction claimed may survive)/ },
  { id: 'no-run-budget', description: 'a run keeps starting rehearsals however long it has run (R8-01)',
    apply: (root) => edit(root, SCHEDULER, '    if (Date.now() >= stopAt) {', '    if (Date.now() >= stopAt && false) {'),
    runs: [jest], expect: /● .*stops starting rehearsals when the run budget is spent/ },
  { id: 'ticket-time-after-send', description: 'a ticket is dated after Expo answered, so a sign-in during the wait reads as older (G02)',
    apply: (root) => edit(root, PUSH, '    await recordTickets(tickets, sentAt);', '    await recordTickets(tickets, new Date().toISOString());'),
    runs: [jest], expect: /● .*keeps a token registered again while Expo had not yet answered the send/ },
  { id: 'load-failure-quiet', description: 'a run that cannot read what is due reports nothing wrong (GR03)',
    apply: (root) => edit(root, SCHEDULER, "    tally.errors.push({ step: type, error: err.message });\n    return tally;", '    return tally;'),
    runs: [jest, jestRoute, pg], expect: /● .*cannot read what is due/ },
  { id: 'route-200-on-failure', description: 'the cron answers 200 whatever the run says (GR03)',
    apply: (root) => edit(root, ROUTE, '    if (!ok) {', '    if (ok === "never") {'),
    runs: [jestRoute, pg], expect: /● .*answers 500 with what failed when the run could not read what was due/ },
  { id: 'tickets-not-kept', description: 'accepted pushes leave no ticket for their receipts (G02)',
    apply: (root) => edit(root, PUSH, '    await recordTickets(tickets, sentAt);\n', ''),
    runs: [jest], expect: /● .*receipts \(G02\) › every accepted push leaves its ticket to be checked/ },
  { id: 'dead-token-kept', description: 'a receipt saying the device is gone leaves the token (G02)',
    apply: (root) => edit(root, PUSH, "      if (receipt.details?.error === 'DeviceNotRegistered') {\n        result.tokensRemoved",
      "      if (receipt.details?.error === 'never') {\n        result.tokensRemoved"),
    runs: [jest, pg], expect: /● .*receipts \(G02\) › a receipt saying the device is gone removes the token and the ticket/ },
  { id: 'reregistered-token-removed', description: 'a token registered again since the send is removed by an old receipt (G02)',
    apply: (root) => edit(root, PUSH, "          notAfter: new Date(row.created_at).toISOString(),\n", ''),
    runs: [jest, pg], expect: /● .*receipts \(G02\) › keeps a token registered again since the send/ },
];

const results = [];
for (const mutation of mutations) {
  const parent = mkdtempSync(path.join(process.env.TMPDIR || tmpdir(), `r8-reminder-mutation-${mutation.id}-`));
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
        firstFailure: run.status === 0 ? null
          : (output.split('\n').find((line) => /●|R8-0\d|AssertionError|Expected|!==|timed out/.test(line)) || '').trim().slice(0, 160) || null,
        lastLine: run.status === 0 ? null : (output.trim().split('\n').at(-1) || '').trim().slice(0, 160) });
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
