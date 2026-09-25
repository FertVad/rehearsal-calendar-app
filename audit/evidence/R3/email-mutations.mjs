// R3 email codes: put each weakening of the one-time code back into a copy of
// the server and require the tests that guard it to fail. The unmutated copy
// must pass the same commands.
//
//   node audit/evidence/R3/email-mutations.mjs
//
// Needs Node 22, Docker Desktop (desktop-linux) with postgres:15, as the R0 harness.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const server = path.resolve(fileURLToPath(new URL('../../../rehearsal-calendar-native/server', import.meta.url)));
const CODES = 'services/email/codes.js';
const jest = ['--experimental-vm-modules', 'node_modules/jest/bin/jest.js', '--runInBand', '--silent', '__tests__/services/emailCodes.test.js'];
const pgEmail = ['scripts/r0-postgres.mjs', '--r3-email-only'];

function edit(root, from, to) {
  const target = path.join(root, CODES);
  const text = readFileSync(target, 'utf8');
  assert.ok(text.includes(from), `mutation anchor not found: ${from.slice(0, 60)}`);
  writeFileSync(target, text.replace(from, to));
}

const mutations = [
  { id: 'control', description: 'unmutated copy', runs: [jest, pgEmail], expect: 'pass' },
  { id: 'no-row-lock', description: 'checkCode reads the live code without FOR UPDATE',
    apply: (root) => edit(root, 'consumed_at IS NULL FOR UPDATE`', 'consumed_at IS NULL`'),
    runs: [pgEmail], expect: /second concurrent check of one code must not succeed/ },
  { id: 'no-address-check', description: 'a code for another address is checked anyway',
    apply: (root) => edit(root, "if (live.email !== email) return { ok: false, reason: 'CODE_MISSING' };", ''),
    runs: [jest], expect: /refuses a code sent to another address/ },
  { id: 'hash-without-address', description: 'the HMAC no longer binds the address',
    apply: (root) => edit(root, 'JSON.stringify([userId, purpose, email, code])', 'JSON.stringify([userId, purpose, code])'),
    runs: [jest], expect: /binds the hash to the address/ },
  { id: 'never-burn', description: 'wrong attempts are counted but never burn the code',
    apply: (root) => edit(root, 'const burned = attempts >= MAX_ATTEMPTS;', 'const burned = false;'),
    runs: [jest, pgEmail], expect: /burns the code on the fifth wrong attempt/ },
  { id: 'no-resend-interval', description: 'a new code may be requested at once',
    apply: (root) => edit(root, 'if (since < RESEND_INTERVAL_MS)', 'if (false)'),
    runs: [jest, pgEmail], expect: /waits a minute between codes/ },
];

const results = [];
for (const mutation of mutations) {
  const parent = mkdtempSync(path.join(process.env.TMPDIR || tmpdir(), `r3-email-mutation-${mutation.id}-`));
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
