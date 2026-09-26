// R3 email change (HP01): put each weakening of the change back into a copy
// of the server and require the tests that guard it to fail. The unmutated
// copy must pass the same commands. "before-R3-19" puts back the routes as
// first written, where a password stood in for the current-address code;
// there is no variant from before the item — the routes did not exist, and a
// copy without them fails on the missing module, which the runner refuses. A Jest expectation names a failed test ("●"); a
// copy that fails to load its modules is refused (loadFailure).
//
//   node audit/evidence/R3/change-mutations.mjs
//
// Needs Node 22, git, Docker Desktop (desktop-linux) with postgres:15, as the R0 harness.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const server = path.resolve(fileURLToPath(new URL('../../../rehearsal-calendar-native/server', import.meta.url)));
const CHANGE = 'routes/emailChange.js';
const BEFORE_R3_19 = '239b5d7';
const historical = (root, file, commit) => writeFileSync(path.join(root, file),
  execFileSync('git', ['show', `${commit}:rehearsal-calendar-native/server/${file}`], { cwd: server }));
const jest = ['--experimental-vm-modules', 'node_modules/jest/bin/jest.js', '--runInBand', '--silent',
  '__tests__/routes/emailChange.test.js'];
const pgAuth = ['scripts/r0-postgres.mjs', '--r3-auth-only'];

function edit(root, file, from, to) {
  const target = path.join(root, file);
  const text = readFileSync(target, 'utf8');
  assert.equal(text.split(from).length, 2, `mutation anchor must occur once: ${from.slice(0, 60)}`);
  writeFileSync(target, text.replace(from, () => to));
}

const mutations = [
  { id: 'control', description: 'unmutated copy', runs: [jest, pgAuth], expect: 'pass' },
  { id: 'before-R3-19', description: `routes/emailChange.js as at ${BEFORE_R3_19}: a password stands in for the current-address code`,
    apply: (root) => historical(root, CHANGE, BEFORE_R3_19),
    runs: [jest], expect: /● .*a first password it sets does not replace the code to the current address/ },
  { id: 'session-enough', description: 'the change is asked for without the current password',
    apply: (root) => edit(root, CHANGE, `      if (user.password_hash) {
        const proof = req.body?.currentPassword;
        if (typeof proof !== 'string' || !(await bcrypt.compare(proof, user.password_hash))) {
          return refused(403, { error: 'Current password is incorrect', code: 'CURRENT_PASSWORD_INVALID', field: 'currentPassword' });
        }
      }
`, ''),
    runs: [jest], expect: /● .*needs the current password: a session alone does not move the account/ },
  { id: 'current-code-unchecked', description: 'the current-address code is not required at confirmation',
    apply: (root) => edit(root, CHANGE,
      "        if (!current.ok) return refused(400, { error: 'The code is not valid', code: current.reason, field: 'currentCode' });\n", ''),
    runs: [jest], expect: /● .*needs the current-address code from an account with a password too/ },
  { id: 'burns-current-code', description: 'a right current-address code is spent though the new-address code is wrong (R3-20)',
    apply: (root) => edit(root, CHANGE, 'code: req.body?.currentCode, now, consume: false });', 'code: req.body?.currentCode, now });'),
    runs: [jest], expect: /● .*a wrong code in either place spends neither right one: the pair still works/ },
  { id: 'change-keeps-sessions', description: 'the other sessions survive the change',
    apply: (root) => edit(root, CHANGE, 'SET email = $2, token_version = token_version + 1, updated_at', 'SET email = $2, updated_at'),
    runs: [jest, pgAuth], expect: /one change must move the account once/ },
  { id: 'confirm-session-unchecked', description: 'the confirmation trusts the version the middleware read outside the lock',
    apply: (root) => edit(root, CHANGE, `        const user = await lockSession(tx, req, 'email, password_hash, locale');
        if (!user) return refused(401, SESSION_REVOKED);
        const pending`, `        const user = await tx.get('SELECT email, password_hash, locale FROM native_users WHERE id = $1 FOR UPDATE', [req.userId]);
        const pending`),
    runs: [pgAuth], expect: /one change must move the account once/ },
  { id: 'change-leaves-address-unproven', description: 'the new address is not marked verified',
    apply: (root) => edit(root, CHANGE, "        await markVerified(tx, { userId: req.userId, email: checked.email, by: 'code', now });\n", ''),
    runs: [jest], expect: /● .*moves the account: new address proven, other sessions and codes gone, old address told/ },
  { id: 'method-row-stale', description: 'the email sign-in method keeps the old address',
    apply: (root) => edit(root, CHANGE, `        await tx.run(
          "UPDATE native_auth_providers SET provider_email = $2, updated_at = $3::timestamptz WHERE user_id = $1 AND provider_type = 'email'",
          [req.userId, checked.email, now.toISOString()]
        );
`, ''),
    runs: [jest], expect: /● .*moves the account: new address proven, other sessions and codes gone, old address told/ },
  { id: 'codes-survive', description: 'live codes survive the change',
    apply: (root) => edit(root, CHANGE, '        await voidCodes(tx, { userId: req.userId, now });\n', ''),
    runs: [jest], expect: /● .*moves the account: new address proven, other sessions and codes gone, old address told/ },
  { id: 'change-removes-devices', description: 'the change takes the push devices off the account (R3-22)',
    apply: (root) => edit(root, CHANGE, '        await voidCodes(tx, { userId: req.userId, now });\n',
      "        await voidCodes(tx, { userId: req.userId, now });\n        await tx.run('DELETE FROM native_push_tokens WHERE user_id = $1', [req.userId]);\n"),
    runs: [jest], expect: /● .*leaves the account's push devices in place/ },
  { id: 'old-address-not-told', description: 'the old address is not told',
    apply: (root) => edit(root, CHANGE, `    const notice = await transport.send(addressChangedMessage({ to: outcome.oldEmail, newAddress: outcome.user.email,
      locale: outcome.locale }));
`, '    const notice = { ok: true };\n'),
    runs: [jest], expect: /● .*moves the account: new address proven, other sessions and codes gone, old address told/ },
  { id: 'notice-undoes-change', description: 'a refused notice turns the confirmation into an error (R3-22)',
    apply: (root) => edit(root, CHANGE, '    if (!notice.ok) {\n',
      "    if (!notice.ok) return res.status(502).json({ error: 'The notice was not sent' });\n    if (!notice.ok) {\n"),
    runs: [jest], expect: /● .*stands when the notice to the old address is refused/ },
  { id: 'taken-unchecked-at-confirm', description: 'the confirmation does not look whether the address was taken meanwhile',
    apply: (root) => edit(root, CHANGE, `        if (await tx.get('SELECT id FROM native_users WHERE email = $1 AND id <> $2', [checked.email, req.userId])) {
          return refused(409, EMAIL_TAKEN);
        }
`, ''),
    runs: [jest], expect: /● .*refuses an address taken while the change waited, and keeps the old one/ },
  { id: 'unique-race-500', description: 'a registration winning the address makes the change a 500',
    apply: (root) => edit(root, CHANGE, "      if (error?.code !== '23505') throw error;\n      outcome = refused(409, EMAIL_TAKEN);", '      throw error;'),
    runs: [pgAuth], expect: /a change to an address registered meanwhile must be refused/ },
];

const results = [];
for (const mutation of mutations) {
  const parent = mkdtempSync(path.join(process.env.TMPDIR || tmpdir(), `r3-change-mutation-${mutation.id}-`));
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
    // A copy that cannot load its modules shows nothing about the behaviour,
    // whatever test names its failures carry (review R3-15).
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
