// R3 password reset: put each weakening of the reset back into a copy of the
// server and require the tests that guard it to fail. The unmutated copy must
// pass the same commands. There is no "before" variant: before this item the
// routes did not exist, and a copy without them fails on the missing module,
// which the runner does not count. A Jest expectation names a failed test
// ("●"); a copy that fails to load its modules is refused (loadFailure).
//
//   node audit/evidence/R3/reset-mutations.mjs
//
// Needs Node 22, Docker Desktop (desktop-linux) with postgres:15, as the R0 harness.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const server = path.resolve(fileURLToPath(new URL('../../../rehearsal-calendar-native/server', import.meta.url)));
const RESET = 'routes/passwordReset.js';
const jest = ['--experimental-vm-modules', 'node_modules/jest/bin/jest.js', '--runInBand', '--silent',
  '__tests__/routes/passwordReset.test.js'];
const pgAuth = ['scripts/r0-postgres.mjs', '--r3-auth-only'];

function edit(root, file, from, to) {
  const target = path.join(root, file);
  const text = readFileSync(target, 'utf8');
  assert.equal(text.split(from).length, 2, `mutation anchor must occur once: ${from.slice(0, 60)}`);
  writeFileSync(target, text.replace(from, () => to));
}

const mutations = [
  { id: 'control', description: 'unmutated copy', runs: [jest, pgAuth], expect: 'pass' },
  { id: 'request-reveals-account', description: 'the request answers 404 for an address without an account',
    apply: (root) => edit(root, RESET, "res.status(202).json({ status: 'reset_requested' });",
      "res.status(issued ? 202 : 404).json({ status: issued ? 'reset_requested' : 'unknown' });"),
    runs: [jest, pgAuth], expect: /● .*answers alike whether or not the address has an account/ },
  { id: 'rate-limit-said', description: 'a request too soon after the last code is answered 429',
    apply: (root) => edit(root, RESET, `    if (!(error instanceof CodeRateLimited)) throw error;
  }`, `    if (!(error instanceof CodeRateLimited)) throw error;
    return res.status(429).json({ code: 'RATE_LIMITED' });
  }`),
    runs: [jest], expect: /● .*sends nothing more within a minute, and answers the same/ },
  { id: 'no-transport-check', description: 'the request goes on without a way to send the code',
    apply: (root) => edit(root, RESET, '  if (!transport.available) return res.status(503).json(EMAIL_UNAVAILABLE);\n', ''),
    runs: [jest], expect: /● .*refuses before looking at the address when no email can be sent/ },
  { id: 'policy-unchecked', description: 'the new password is not held to the password rules',
    apply: (root) => edit(root, RESET, "password = checkPassword(req.body?.newPassword, 'newPassword');",
      'password = String(req.body?.newPassword);'),
    runs: [jest], expect: /● .*refuses a weak password without spending an attempt/ },
  { id: 'reset-keeps-sessions', description: 'the reset leaves the sessions from before valid',
    apply: (root) => edit(root, RESET, 'SET password_hash = $2, token_version = token_version + 1,', 'SET password_hash = $2,'),
    runs: [jest, pgAuth], expect: /a reset must revoke the stranger's session/ },
  { id: 'reset-keeps-devices', description: "the stranger's push devices outlive the reset",
    apply: (root) => edit(root, RESET, "    await tx.run('DELETE FROM native_push_tokens WHERE user_id = $1', [user.id]);\n", ''),
    runs: [jest, pgAuth], expect: /a reset must take the stranger's devices off the account/ },
  { id: 'reset-keeps-codes', description: 'live codes of the account outlive the reset',
    apply: (root) => edit(root, RESET, '    await voidCodes(tx, { userId: user.id, now });\n', ''),
    runs: [jest], expect: /● .*sets the new password, signs in and takes away everything from before/ },
  { id: 'reset-leaves-address-unproven', description: 'the mailbox proof does not verify the address',
    apply: (root) => edit(root, RESET, "    await markVerified(tx, { userId: user.id, email: user.email, by: 'code', now });\n", ''),
    runs: [jest], expect: /● .*takes back a registration a stranger never confirmed/ },
  { id: 'reset-password-unlisted', description: 'the new password is not recorded as a way in',
    apply: (root) => edit(root, RESET, '    await recordPasswordMethod(tx, user.id);\n', ''),
    runs: [jest], expect: /● .*sets the new password, signs in and takes away everything from before/ },
];

const results = [];
for (const mutation of mutations) {
  const parent = mkdtempSync(path.join(process.env.TMPDIR || tmpdir(), `r3-reset-mutation-${mutation.id}-`));
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
