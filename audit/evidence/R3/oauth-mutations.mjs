// R3-01, Google and Apple: put each weakening of the provider sign-in back
// into a copy of the server and require the tests that guard it to fail. The
// unmutated copy must pass the same commands; "before-R3-01" puts back the
// three files as they were before this item.
//
//   node audit/evidence/R3/oauth-mutations.mjs
//
// Needs Node 22, git, Docker Desktop (desktop-linux) with postgres:15, as the R0 harness.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const server = path.resolve(fileURLToPath(new URL('../../../rehearsal-calendar-native/server', import.meta.url)));
const BEFORE = 'cbdfc63';
const LINKING = 'utils/accountLinking.js';
const historical = (root, file, commit) => writeFileSync(path.join(root, file),
  execFileSync('git', ['show', `${commit}:rehearsal-calendar-native/server/${file}`], { cwd: server }));
const jest = ['--experimental-vm-modules', 'node_modules/jest/bin/jest.js', '--runInBand', '--silent',
  '__tests__/routes/providerSignIn.test.js'];
const pgAuth = ['scripts/r0-postgres.mjs', '--r3-auth-only'];

function edit(root, file, from, to) {
  const target = path.join(root, file);
  const text = readFileSync(target, 'utf8');
  assert.equal(text.split(from).length, 2, `mutation anchor must occur once: ${from.slice(0, 60)}`);
  writeFileSync(target, text.replace(from, () => to));
}

const mutations = [
  { id: 'control', description: 'unmutated copy', runs: [jest, pgAuth], expect: 'pass' },
  { id: 'before-R3-01', description: `routes/auth.js, ${LINKING} and middleware/jwtMiddleware.js as at ${BEFORE}`,
    apply: (root) => ['routes/auth.js', LINKING, 'middleware/jwtMiddleware.js'].forEach((file) => historical(root, file, BEFORE)),
    runs: [jest], expect: /takes back a registration a stranger never confirmed/ },
  { id: 'trust-unverified-address', description: 'an address the provider did not verify counts as proof',
    apply: (root) => edit(root, LINKING, 'proof: emailVerified === true && address ? address : null,', 'proof: address,'),
    runs: [jest], expect: /neither joins nor creates an account for an address it did not verify/ },
  { id: 'rule-only-for-new-links', description: 'a provider linked before R3 does not trigger the rule',
    apply: (root) => edit(root, LINKING, 'if (proof && proof === user.email && !isVerified(identity, user.email)) {',
      'if (!link && proof && proof === user.email && !isVerified(identity, user.email)) {'),
    runs: [jest, pgAuth], expect: /the provider proving the address must revoke the unproven password/ },
  { id: 'sessions-survive', description: 'the password is removed but its sessions are not revoked',
    apply: (root) => edit(root, LINKING, 'SET password_hash = NULL, token_version = token_version + 1, updated_at',
      'SET password_hash = NULL, updated_at'),
    runs: [jest, pgAuth], expect: /the stranger's access token must be revoked/ },
  { id: 'password-method-stays', description: 'the password is removed but still listed as a way in',
    apply: (root) => edit(root, LINKING,
      `await tx.run("DELETE FROM native_auth_providers WHERE user_id = $1 AND provider_type = 'email'", [user.id]);`, ''),
    runs: [jest], expect: /removes the password and every session when a provider linked before R3 proves it/ },
  { id: 'codes-survive', description: "the stranger's live codes outlive the takeover",
    apply: (root) => edit(root, LINKING, 'await voidCodes(tx, { userId: user.id, now });', ''),
    runs: [jest], expect: /takes back a registration a stranger never confirmed/ },
  { id: 'case-sensitive-provider', description: "the provider's address is used as written",
    apply: (root) => edit(root, LINKING, 'const address = normalizeEmail(email) || null;', 'const address = email || null;'),
    runs: [jest], expect: /finds the account whatever case the provider writes the address in/ },
  { id: 'pending-provider-session', description: 'a linked provider signs in to a pending account',
    apply: (root) => edit(root, LINKING, "} else if (identity?.status === 'pending') {", '} else if (false) {'),
    runs: [jest], expect: /gives a pending account no session, even through a linked provider/ },
  { id: 'middleware-ignores-pending', description: "a pending account's token is accepted by every route",
    apply: (root) => edit(root, 'middleware/jwtMiddleware.js', "if (user.email_status === 'pending') {", 'if (false) {'),
    runs: [jest], expect: /reaches nothing, PUT \/me included/ },
  { id: 'no-retry', description: 'the loser of two first sign-ins gets the unique-key error',
    apply: (root) => edit(root, LINKING, 'if (!retry || attempt >= ATTEMPTS) throw error;', 'throw error;'),
    runs: [pgAuth], expect: /two first sign-ins of one person must both sign in/ },
  { id: 'no-address-recheck', description: 'the account is joined though its address moved while the sign-in waited',
    apply: (root) => edit(root, LINKING, 'if (!user || user.email !== proof) throw new SignInMoved();',
      'if (!user) throw new SignInMoved();'),
    runs: [pgAuth], expect: /an account whose address moved must not be joined/ },
  { id: 'no-link-recheck', description: 'a sign-in goes through a link removed while it waited',
    apply: (root) => edit(root, LINKING, 'if (!still) throw new SignInMoved();', ''),
    runs: [pgAuth], expect: /a sign-in through a link removed meanwhile must link afresh/ },
];

const results = [];
for (const mutation of mutations) {
  const parent = mkdtempSync(path.join(process.env.TMPDIR || tmpdir(), `r3-oauth-mutation-${mutation.id}-`));
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
