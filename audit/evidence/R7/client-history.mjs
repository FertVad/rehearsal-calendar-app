// R7, app half (review R7-03): run client-history.test.ts against three
// snapshots of the app — before R7, the first round of cause fix 4, and the
// commit given (default HEAD) — and require each test to fail or pass where the
// table below says. A failure is recorded with its first assertion line; a
// suite that does not load, or a test failing on anything but an assertion
// (a TypeError from a missing stub, say), counts against the run.
//
//   node audit/evidence/R7/client-history.mjs [commit]
//
// Needs Node 22 and the app's node_modules; no network, no device.
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const app = path.join(repo, 'rehearsal-calendar-native');
const history = fileURLToPath(new URL('./client-history.test.ts', import.meta.url));
const target = process.argv[2] || 'HEAD';
const snapshots = [
  { commit: 'a0bffc2', label: 'before R7' },
  { commit: '16c6723', label: 'cause fix 4, first round' },
  { commit: target, label: 'after review R7' },
];
// Expected outcome per snapshot, in the order above.
const table = {
  'Import EI01: a sync on this phone does not delete what another phone imported': ['failed', 'passed', 'passed'],
  'Import EI04: moving an occurrence does not delete the old time on its own, where the new one can fail to arrive': ['failed', 'passed', 'passed'],
  'Import EI02: a sync with a calendar it could not read is not stamped as done': ['failed', 'passed', 'passed'],
  'Import R7-02: the window names the local dates it read': ['failed', 'failed', 'passed'],
  'Import EI03: "remove all imported" asks the server when this phone holds no record of its imports': ['failed', 'passed', 'passed'],
  'Import CLAUDE.md 10: an imported count that cannot be read is an error, not none': ['failed', 'passed', 'passed'],
  "Export mappings ES02: all mappings — this phone's, not the oldest of every phone's": ['failed', 'passed', 'passed'],
  "Export mappings ES02: one mapping — this phone's, not whichever the server hands back": ['failed', 'passed', 'passed'],
  "Export mappings ES02: unsyncing on this phone names its calendars, so the server leaves another phone's mapping": ['failed', 'passed', 'passed'],
  'Export mappings ES02: "remove all exported" does not delete another phone\'s mappings': ['failed', 'passed', 'passed'],
  'Export mappings R7-01: a mapping saved while the server could not take it wins in the list over the older one the server still holds': ['failed', 'failed', 'passed'],
  'Export mappings R7-01: a mapping saved while the server could not take it wins for one rehearsal, and reading does not overwrite it with the older one': ['failed', 'failed', 'passed'],
  'Export mappings R7-01: a mapping saved while the server could not take it a server mapping copied here keeps the time it was written, not the time it was read': ['failed', 'failed', 'passed'],
};
const ANSI = /\u001b\[[0-9;]*m/g;
// An assertion names what it expected; anything else is a crash of the test.
const assertion = (message) => /expect\(|Expected|Received/.test(message) && !/TypeError|is not a function|Cannot read prop/.test(message);

let failures = 0;
for (const [index, snapshot] of snapshots.entries()) {
  const commit = execFileSync('git', ['rev-parse', snapshot.commit], { cwd: repo, encoding: 'utf8' }).trim();
  const parent = mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'r7-client-history-'));
  const root = path.join(parent, 'rehearsal-calendar-native');
  try {
    const parts = ['src', 'shared', 'jest.config.js', 'package.json', 'tsconfig.json', 'app.json']
      .map((part) => `rehearsal-calendar-native/${part}`);
    const tar = spawnSync('git', ['archive', '--format=tar', commit, ...parts], { cwd: repo, maxBuffer: 256 << 20 });
    assert.equal(tar.status, 0, String(tar.stderr));
    execFileSync('tar', ['-x', '-C', parent], { input: tar.stdout });
    symlinkSync(path.join(app, 'node_modules'), path.join(root, 'node_modules'));
    cpSync(history, path.join(root, 'src/__tests__/r7History.test.ts'));
    const json = path.join(parent, 'result.json');
    const run = spawnSync(process.execPath, ['node_modules/jest/bin/jest.js', '--selectProjects', 'frontend', '--runInBand',
      '--silent', '--json', '--outputFile', json, '--testPathPatterns', 'r7History'], { cwd: root, encoding: 'utf8',
      timeout: 300000, maxBuffer: 16 << 20, env: { PATH: process.env.PATH, HOME: process.env.HOME, TZ: process.env.TZ } });
    assert.ok(existsSync(json), `jest wrote no result: ${run.stderr.slice(-400)}`);
    const suite = JSON.parse(readFileSync(json, 'utf8')).testResults[0];
    const loaded = suite && !suite.testExecError && suite.assertionResults.length > 0;
    if (!loaded) failures += 1;
    const seen = new Set();
    const tests = (suite?.assertionResults ?? []).map((test) => {
      const name = test.fullName;
      seen.add(name);
      const expected = table[name]?.[index];
      const first = (test.failureMessages[0] || '').replace(ANSI, '').split('\n').map((line) => line.trim())
        .filter(Boolean).slice(0, 4).join(' | ').slice(0, 220);
      const ok = expected === test.status && (test.status === 'passed' || assertion(test.failureMessages.join('\n')));
      if (!ok) failures += 1;
      return { test: name, expected: expected ?? 'not in the table', status: test.status, reason: first || null, result: ok ? 'PASS' : 'FAIL' };
    });
    for (const name of Object.keys(table)) if (!seen.has(name)) { failures += 1; tests.push({ test: name, status: 'missing', result: 'FAIL' }); }
    console.log(JSON.stringify({ snapshot: snapshot.label, commit, loaded, exit: run.status }));
    for (const test of tests) console.log(JSON.stringify(test));
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}
console.log(JSON.stringify({ summary: failures ? 'FAIL' : 'PASS', snapshots: snapshots.length, tests: Object.keys(table).length, failures }));
process.exitCode = failures ? 1 : 0;
