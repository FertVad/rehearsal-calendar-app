// The supervisor's own checks, with stand-ins for npm and node: what an e2e
// run that could not start looks like, and that stopping the supervisor stops
// a check in flight.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runChecks, stopChecks } from '../lib/checks.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'autodev-checks-'));
after(() => fs.rmSync(dir, { recursive: true, force: true }));
fs.mkdirSync(path.join(dir, 'tree', 'rehearsal-calendar-native'), { recursive: true });
const env = { PATH: '/usr/bin:/bin', HOME: os.homedir() };

/** A bin folder whose npm passes and whose node "runs e2e" with the given exit code. */
function bin(name, e2e) {
  const folder = path.join(dir, name);
  fs.mkdirSync(folder);
  fs.writeFileSync(path.join(folder, 'npm'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  fs.writeFileSync(path.join(folder, 'node'), `#!/bin/sh\n${e2e}\n`, { mode: 0o755 });
  return path.join(folder, 'node');
}

const appChange = ['rehearsal-calendar-native/src/App.tsx'];

test('an e2e run that found the machine not ready is told apart from a failed change', async () => {
  const notReady = await runChecks({ root: path.join(dir, 'tree'), changedFiles: appChange, node: bin('a', 'echo "[e2e] not ready, not the change: Port 3001 is taken"; exit 75'), log: path.join(dir, 'a.log'), env });
  const e2e = notReady.steps.find((step) => step.name === 'e2e');
  assert.equal(notReady.ok, false);
  assert.equal(e2e.environment, true);
  assert.match(e2e.tail, /Port 3001 is taken/);

  const failed = await runChecks({ root: path.join(dir, 'tree'), changedFiles: appChange, node: bin('b', 'echo "flow 03 failed"; exit 1'), log: path.join(dir, 'b.log'), env });
  assert.equal(failed.steps.find((step) => step.name === 'e2e').environment, false);
});

test('what failed is kept whole, however the output was cut and however long it ran on', async () => {
  // A test name split across two writes, then far more output than the tail keeps.
  const script = [
    "printf '  \\342\\227\\217 process database'", 'sleep 0.3', "printf ' configuration takes precedence\\n'",
    "printf '  \\342\\227\\217 library import exports the app\\n'",
    'i=0; while [ $i -lt 300 ]; do echo "filler $i"; i=$((i+1)); done', 'exit 1',
  ].join('\n');
  const result = await runChecks({ root: path.join(dir, 'tree'), changedFiles: appChange, node: bin('d', script), log: path.join(dir, 'd.log'), env });
  const e2e = result.steps.find((step) => step.name === 'e2e');
  assert.deepEqual(e2e.failures, ['  ● process database configuration takes precedence', '  ● library import exports the app']);
  assert.doesNotMatch(e2e.tail, /●/);
});

test('stopping the supervisor stops a check in flight', async () => {
  const pending = runChecks({ root: path.join(dir, 'tree'), changedFiles: appChange, node: bin('c', 'exec sleep 60'), log: path.join(dir, 'c.log'), env });
  await new Promise((resolve) => setTimeout(resolve, 500));
  stopChecks();
  const result = await pending;
  assert.equal(result.steps.at(-1).signal, 'SIGTERM');
});
