// R3 A03/HP02/A04 on PostgreSQL: put back each weakening the new R3_AUTH
// contracts guard — the row lock of two unlinks, the refusal of UTC offsets,
// the refusal of NUL — into a copy of the server and require the contract to
// fail on its own assertion. The route tests of A03/A04 have their own red
// evidence from 9a702ba and 6320743; files from before those commits no longer
// load beside today's modules, so there is no "before" variant here. A Jest
// expectation names a failed test ("●"); a copy that fails to load its modules
// is refused (loadFailure).
//
//   node audit/evidence/R3/profile-mutations.mjs
//
// Needs Node 22, Docker Desktop (desktop-linux) with postgres:15, as the R0 harness.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const server = path.resolve(fileURLToPath(new URL('../../../rehearsal-calendar-native/server', import.meta.url)));
const jest = ['--experimental-vm-modules', 'node_modules/jest/bin/jest.js', '--runInBand', '--silent',
  '__tests__/routes/accountInput.test.js', '__tests__/routes/signInMethods.test.js'];
const pgAuth = ['scripts/r0-postgres.mjs', '--r3-auth-only'];

function edit(root, file, from, to) {
  const target = path.join(root, file);
  const text = readFileSync(target, 'utf8');
  assert.equal(text.split(from).length, 2, `mutation anchor must occur once: ${from.slice(0, 60)}`);
  writeFileSync(target, text.replace(from, () => to));
}

const mutations = [
  { id: 'control', description: 'unmutated copy', runs: [jest, pgAuth], expect: 'pass' },
  { id: 'unlink-without-lock', description: 'unlinking reads the user row without FOR UPDATE (A04)',
    apply: (root) => edit(root, 'utils/accountLinking.js',
      "'SELECT id, token_version FROM native_users WHERE id = $1 FOR UPDATE'", "'SELECT id, token_version FROM native_users WHERE id = $1'"),
    runs: [pgAuth], expect: /two concurrent unlinks must leave one way in/ },
  { id: 'offset-zones-accepted', description: 'a UTC offset passes as a time zone (R3-02)',
    apply: (root) => edit(root, 'utils/accountInput.js',
      "return resolved === 'UTC' || resolved.startsWith('Etc/') || NAMED_ZONES.has(resolved);", 'return true;'),
    runs: [pgAuth], expect: /an offset must be refused: PostgreSQL reads it the other way/ },
  { id: 'nul-reaches-postgres', description: 'text with NUL is passed on to PostgreSQL (R3-03)',
    apply: (root) => edit(root, 'utils/accountInput.js', "const hasNul = (value) => value.includes('\\u0000');", 'const hasNul = () => false;'),
    runs: [pgAuth], expect: /a NUL must be refused before PostgreSQL sees it/ },
];

const results = [];
for (const mutation of mutations) {
  const parent = mkdtempSync(path.join(process.env.TMPDIR || tmpdir(), `r3-profile-mutation-${mutation.id}-`));
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
