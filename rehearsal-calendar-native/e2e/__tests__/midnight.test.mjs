// A run past midnight (T-226, its review): the wait for midnight ends within
// the supervisor's limit or is not begun, no batch runs across midnight, and
// the batches' artifacts are where the supervisor takes a red run's from.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { e2eLimitMs, failedFlows, maestroRuns } from '../../../tools/autodev/lib/checks.mjs';
import { exitCode, flattenBatches, limitMs, nextStep } from '../midnight.mjs';

const S = 1000;
// Measured: a setup of 3 min 19 s (T-226 green) to 3 min 39 s (T-226 red),
// a Maestro's start 54 s, a new day's seed 15 s, the teardown 11 s; the flows'
// own times from T-225's night and T-226's runs.
const SETUP = 219 * S;
const MAESTRO = 54 * S;
const RESEED = 15 * S;
const TEARDOWN = 11 * S;
const midnight = new Date(2026, 10, 7).getTime();

/** The run e2e/run.mjs makes of `flows` (their times), started at `start`, as nextStep leads it. */
function play(start, flows) {
  const deadline = start + limitMs(flows.length);
  let now = start + SETUP;
  let index = 0;
  while (index < flows.length) {
    const next = nextStep({ now: new Date(now), left: flows.length - index, deadline });
    if (next.stop) return { stopped: now, deadline };
    if (next.wait) { now += next.wait + RESEED; continue; }
    const began = now;
    now += MAESTRO + flows.slice(index, index + next.take).reduce((a, b) => a + b, 0);
    index += next.take;
    if (began < midnight) assert.ok(now <= midnight, `a batch begun ${new Date(began)} ended past midnight, ${new Date(now)}`);
  }
  return { ended: now + TEARDOWN, deadline };
}

test('the runner\'s limit is the supervisor\'s', () => {
  for (const n of [1, 2, 7, 80]) assert.equal(limitMs(n), e2eLimitMs(n));
});

test('the review\'s path: one flow from 23:47 with a 3 min 19 s setup runs at once and ends in its limit', () => {
  const start = new Date(2026, 10, 6, 23, 47).getTime();
  const at = new Date(start + 199 * S);
  assert.deepEqual(nextStep({ now: at, left: 1, deadline: start + limitMs(1) }), { take: 1 });
});

const runs = {
  'the longest flow alone (70, 200 s)': [200 * S],
  'flow 41 alone (134 s)': [134 * S],
  'the two longest (70, 26)': [200 * S, 184 * S],
  'the task\'s seven flows': [134, 117, 128, 124, 139, 75, 85].map((s) => s * S),
};

for (const [name, flows] of Object.entries(runs)) {
  test(`${name}: begun any second of the half hour before midnight, ends in the supervisor's limit or stops before it`, () => {
    for (let start = midnight - 30 * 60 * S; start <= midnight; start += S) {
      const run = play(start, flows);
      if (run.stopped !== undefined) assert.ok(run.stopped < run.deadline);
      else assert.ok(run.ended <= run.deadline, `begun ${new Date(start)}: ended ${(run.ended - start) / S} s in, limit ${(run.deadline - start) / S} s`);
    }
  });
}

test('the second review\'s path: a batch failed, then no wait for midnight — the run ends 1, not 75', () => {
  // Two flows from 23:50, a 3 min 39 s setup: the first a batch of its own,
  // failed; then midnight too near for a flow and a wait past the limit.
  const start = new Date(2026, 10, 6, 23, 50).getTime();
  const deadline = start + limitMs(2);
  let now = start + SETUP;
  assert.deepEqual(nextStep({ now: new Date(now), left: 2, deadline }), { take: 1 });
  now += MAESTRO + 134 * S;
  const failed = true;
  assert.ok(nextStep({ now: new Date(now), left: 1, deadline }).stop);
  assert.equal(exitCode({ failed, error: 'machine' }), 1);
});

test('a stop for the machine with nothing failed is 75; the other ends as before', () => {
  assert.equal(exitCode({ failed: false, error: 'machine' }), 75);
  assert.equal(exitCode({ failed: false, error: 'error' }), 1);
  assert.equal(exitCode({ failed: true, error: 'error' }), 1);
  assert.equal(exitCode({ failed: true }), 1);
  assert.equal(exitCode({ failed: false }), 0);
});

test('far from midnight the whole set is one batch', () => {
  assert.deepEqual(nextStep({ now: new Date(2026, 10, 6, 9), left: 80 }), { take: 80 });
});

test('the batches\' flows are where the supervisor takes a red run\'s from: artifacts/<run>/<flow>', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-out-'));
  try {
    const run = path.join(out, 'artifacts', '2026-11-06_235210');
    // What Maestro writes for two batches, a folder of its own each.
    for (const [batch, flow] of [['2026-11-06_235220', 'Sign in'], ['2026-11-07_000045', 'Today selects today']]) {
      fs.mkdirSync(path.join(run, batch, flow, 'logs'), { recursive: true });
      fs.writeFileSync(path.join(run, batch, flow, 'commands.json'), '[]');
      fs.writeFileSync(path.join(run, batch, `xctest_runner_${batch}.log`), '');
    }
    fs.writeFileSync(path.join(run, 'server.log'), '');
    flattenBatches(run);
    const junit = '<testcase name="Sign in" file="e2e/flows/01-login.yaml" status="ERROR"><failure>x</failure></testcase>'
      + '<testcase name="Today selects today" file="e2e/flows/41-today-selects-today.yaml" status="ERROR"><failure>y</failure></testcase>';
    // keepFailedRun (tools/autodev/supervisor.mjs): the newest run, a failed flow's folder by its name.
    const newest = maestroRuns(out).at(-1);
    assert.equal(newest, '2026-11-06_235210');
    for (const flow of failedFlows(junit)) {
      assert.ok(fs.existsSync(path.join(out, 'artifacts', newest, flow.name, 'commands.json')), `${flow.name} not in artifacts/${newest}`);
    }
    assert.deepEqual(fs.readdirSync(run).sort(), ['Sign in', 'Today selects today', 'server.log',
      'xctest_runner_2026-11-06_235220.log', 'xctest_runner_2026-11-07_000045.log']);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});
