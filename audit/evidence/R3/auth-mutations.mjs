// R3 A01 routes: put each weakening of registration and address confirmation
// back into a copy of the server and require the tests that guard it to fail.
// The unmutated copy must pass the same commands; "before-A01" is the
// registration, login and refresh as they were before this item.
//
//   node audit/evidence/R3/auth-mutations.mjs
//
// Needs Node 22, git, Docker Desktop (desktop-linux) with postgres:15, as the R0 harness.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const server = path.resolve(fileURLToPath(new URL('../../../rehearsal-calendar-native/server', import.meta.url)));
const BEFORE = 'c4c5a14';
const jest = ['--experimental-vm-modules', 'node_modules/jest/bin/jest.js', '--runInBand', '--silent',
  '__tests__/routes/emailVerification.test.js'];
const pgAuth = ['scripts/r0-postgres.mjs', '--r3-auth-only'];

function edit(root, file, from, to) {
  const target = path.join(root, file);
  const text = readFileSync(target, 'utf8');
  assert.equal(text.split(from).length, 2, `mutation anchor must occur once: ${from.slice(0, 60)}`);
  writeFileSync(target, text.replace(from, () => to));
}

const mutations = [
  { id: 'control', description: 'unmutated copy', runs: [jest, pgAuth], expect: 'pass' },
  { id: 'before-A01', description: `routes/auth.js as at ${BEFORE}: register signs in at once, login and refresh ignore pending`,
    apply: (root) => writeFileSync(path.join(root, 'routes/auth.js'),
      execFileSync('git', ['show', `${BEFORE}:rehearsal-calendar-native/server/routes/auth.js`], { cwd: server })),
    runs: [jest, pgAuth], expect: /tells an app from before R3 to update/ },
  { id: 'no-upgrade-gate', description: 'register accepts an app that cannot enter a code',
    apply: (root) => edit(root, 'routes/auth.js', "if (req.body?.verification !== 'code') {", 'if (false) {'),
    runs: [jest, pgAuth], expect: /tells an app from before R3 to update/ },
  { id: 'no-transport-check', description: 'register creates the account with no way to send the code',
    apply: (root) => edit(root, 'routes/auth.js', 'if (!transport.available) {', 'if (false) {'),
    runs: [jest, pgAuth], expect: /refuses before writing anything when no email can be sent/ },
  { id: 'login-ignores-pending', description: 'login signs in a registration whose code was never entered',
    apply: (root) => edit(root, 'routes/auth.js', "if ((await identityOf(db, user.id))?.status === 'pending') {", 'if (false) {'),
    runs: [jest, pgAuth], expect: /answers a pending account with 403/ },
  { id: 'refresh-ignores-pending', description: 'refresh renews a token of a pending account',
    apply: (root) => edit(root, 'routes/auth.js', "if ((await identityOf(db, decoded.userId))?.status === 'pending') {", 'if (false) {'),
    runs: [jest], expect: /does not renew a token of a pending account/ },
  { id: 'unique-race-500', description: 'the loser of two registrations of one address gets a 500',
    apply: (root) => edit(root, 'routes/auth.js', "if (error?.code !== '23505') throw error;", 'throw error;'),
    runs: [pgAuth], expect: /two concurrent registrations of one address must give one account/ },
  { id: 'case-sensitive-email', description: 'addresses are compared as typed, so one mailbox can hold two accounts',
    apply: (root) => edit(root, 'utils/accountInput.js', 'value.trim().toLowerCase()', 'value.trim()'),
    runs: [jest, pgAuth], expect: /refuses an address that is taken, whatever its case/ },
  { id: 'code-without-password', description: 'confirming needs the code only, not the password of the registration',
    apply: (root) => edit(root, 'routes/emailVerification.js',
      'if (!user?.password_hash || !(await bcrypt.compare(password, user.password_hash))) return null;', 'if (!user) return null;'),
    runs: [jest], expect: /refuses a wrong password without spending an attempt/ },
  { id: 'confirm-twice', description: 'verify-email does not see that the address is already confirmed',
    apply: (root) => edit(root, 'routes/emailVerification.js',
      `    if (isVerified(await identityOf(tx, holder.id), holder.email)) return { status: 409, body: ALREADY_VERIFIED };
    const checked`, '    const checked'),
    runs: [jest, pgAuth], expect: /two concurrent confirmations with one code must confirm once/ },
  { id: 'no-lock-recheck', description: 'the password checked before the transaction is not compared again under the lock',
    apply: (root) => edit(root, 'routes/emailVerification.js',
      'return row && row.password_hash === holder.password_hash && row.email === holder.email;', 'return Boolean(row);'),
    runs: [pgAuth], expect: /a password changed while the confirmation waited must not be accepted/ },
];

const results = [];
for (const mutation of mutations) {
  const parent = mkdtempSync(path.join(process.env.TMPDIR || tmpdir(), `r3-auth-mutation-${mutation.id}-`));
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
      // What ran and where it stopped: the first failing test or assertion line.
      detail.push({ run: args.at(-1), exit: run.status, seconds: Math.round((Date.now() - started) / 100) / 10,
        passedPg: (output.match(/REGRESSION PASS/) || [null])[0],
        firstFailure: (output.split('\n').find((line) => /●|AssertionError|Expected|!==/.test(line)) || '').trim().slice(0, 160) || null });
    }
    const output = outputs.join('\n');
    const caught = mutation.expect === 'pass' ? !failed : failed && mutation.expect.test(output);
    results.push(caught);
    console.log(JSON.stringify({ mutation: mutation.id, description: mutation.description,
      detail, suitesFailed: failed,
      expected: mutation.expect === 'pass' ? 'all pass' : 'guard test fails', result: caught ? 'PASS' : 'FAIL' }));
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}
const failures = results.filter((ok) => !ok).length;
console.log(JSON.stringify({ summary: failures ? 'FAIL' : 'PASS', mutations: results.length, failures }));
process.exitCode = failures ? 1 : 0;
