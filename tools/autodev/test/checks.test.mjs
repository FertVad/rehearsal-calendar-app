// The supervisor's own checks, with stand-ins for npm and node: what an e2e
// run that could not start looks like, and that stopping the supervisor stops
// a check in flight.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { e2eFlowsFor, e2eLimitMs, failedFlows, maestroRuns, pruneArtifacts, runChecks, stopChecks } from '../lib/checks.mjs';

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

test('the e2e limit grows with the flows: 34 that passed in 46 minutes are not cut off', () => {
  // T-121, 26.10.2026: "34/34 Flows Passed in 45m 55s", killed at a fixed 45 minutes and called red.
  assert.ok(e2eLimitMs(34) > 50 * 60 * 1000);
  assert.ok(e2eLimitMs(60) > e2eLimitMs(34));
});

test('a check stopped by its limit says so, and is not passed off as a failed change', async () => {
  const result = await runChecks({ root: path.join(dir, 'tree'), changedFiles: appChange, node: bin('e', 'trap "exit 0" TERM; while :; do sleep 0.1; done'), log: path.join(dir, 'e.log'), env, e2eLimit: 300 });
  const e2e = result.steps.find((step) => step.name === 'e2e');
  assert.equal(result.ok, false);
  assert.equal(e2e.timedOut, true);
  assert.match(e2e.tail, /не уложились в лимит/);
});

/** An app tree with flows and subflows that run each other the way the real ones do. */
function appTree(name) {
  const app = path.join(dir, name, 'rehearsal-calendar-native');
  const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(app, rel)), { recursive: true }); fs.writeFileSync(path.join(app, rel), text); };
  write('e2e/flows/01-login.yaml', '- runFlow:\n    file: ../subflows/sign-in.yaml\n');
  write('e2e/flows/05-inbox.yaml', '- runFlow:\n    file: ../subflows/sign-in.yaml\n');
  write('e2e/flows/30-sync.yaml', '- runFlow:\n    file: ../subflows/tap-and-see.yaml\n');
  write('e2e/subflows/sign-in.yaml', '- runFlow:\n    file: sign-in-form.yaml\n');
  write('e2e/subflows/sign-in-form.yaml', '- tapOn: Sign in\n');
  write('e2e/subflows/tap-and-see.yaml', '- runScript:\n    file: ../scripts/tap-again.js\n');
  write('e2e/scripts/tap-again.js', '');
  return app;
}

test("a task's checks run its own flows, not the whole set", () => {
  // Owner, 27.10.2026: the task's flows on each task, the whole set at night.
  const app = appTree('pick');
  const at = (rel) => `rehearsal-calendar-native/${rel}`;
  const pick = (changedFiles, taskText) => e2eFlowsFor({ app, changedFiles, taskText });
  assert.deepEqual(pick([at('e2e/flows/30-sync.yaml'), at('src/App.tsx')]), ['e2e/flows/30-sync.yaml']);
  // A subflow reaches the flows that run it, through another subflow too.
  assert.deepEqual(pick([at('e2e/subflows/sign-in-form.yaml')]), ['e2e/flows/01-login.yaml', 'e2e/flows/05-inbox.yaml']);
  assert.deepEqual(pick([at('e2e/scripts/tap-again.js')]), ['e2e/flows/30-sync.yaml']);
  // Named in the task by path: a fix made in the app is checked by the flow that failed.
  assert.deepEqual(pick([at('src/App.tsx')], 'Сценарии:\n- e2e/flows/05-inbox.yaml — Inbox\n- e2e/flows/99-gone.yaml'), ['e2e/flows/05-inbox.yaml']);
  // The app changed and no flow is the task's: it starts and somebody signs in.
  assert.deepEqual(pick([at('src/App.tsx')]), ['e2e/flows/01-login.yaml']);
});

test('the e2e run is given only the chosen flows, and says which', async () => {
  const app = appTree('run');
  const folder = path.join(dir, 'run-bin');
  fs.mkdirSync(folder);
  fs.writeFileSync(path.join(folder, 'npm'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  fs.writeFileSync(path.join(folder, 'node'), '#!/bin/sh\necho "ran: $*"\n', { mode: 0o755 });
  const result = await runChecks({ root: path.dirname(app), changedFiles: ['rehearsal-calendar-native/e2e/flows/05-inbox.yaml'], node: path.join(folder, 'node'), log: path.join(dir, 'run.log'), env });
  const e2e = result.steps.find((step) => step.name === 'e2e');
  assert.match(e2e.tail, /^ran: e2e\/run\.mjs e2e\/flows\/05-inbox\.yaml$/m);
  assert.deepEqual(e2e.flows, ['e2e/flows/05-inbox.yaml']);
});

test('the flows a Maestro report failed, by file', () => {
  const junit = `<testsuite tests="3" failures="1">
    <testcase id="Inbox" name="Inbox" classname="Inbox" file="e2e/flows/05-inbox.yaml" time="51.3" status="SUCCESS"></testcase>
    <testcase id="Calendar filter against a late answer" name="Calendar filter against a late answer" file="e2e/flows/22-calendar-filter.yaml" time="85" status="ERROR">
      <failure>Assertion is false</failure>
    </testcase>
  </testsuite>`;
  assert.deepEqual(failedFlows(junit), [{ file: 'e2e/flows/22-calendar-filter.yaml', name: 'Calendar filter against a late answer', reason: 'Assertion is false' }]);
  assert.deepEqual(failedFlows(''), []);
});

test('old Maestro artifacts go; the newest and those a recent red run points at stay', () => {
  // 27.10.2026: 207 runs, 34 GB, 8 GB left on the disk.
  const out = path.join(dir, 'prune', 'e2e', 'out');
  const runs = ['2026-10-01_010000', '2026-10-02_010000', '2026-10-03_010000', '2026-10-04_010000',
    '2026-10-05_010000', '2026-10-06_010000', '2026-10-07_010000', '2026-10-08_010000'];
  for (const run of runs) fs.mkdirSync(path.join(out, 'artifacts', run, 'Inbox'), { recursive: true });
  const now = Date.now();
  const kept = (name, days, run) => {
    const at = path.join(out, 'failed', name);
    fs.mkdirSync(at, { recursive: true });
    fs.writeFileSync(path.join(at, 'maestro-artifacts.txt'), `rehearsal-calendar-native/e2e/out/artifacts/${run}\n`);
    const when = new Date(now - days * 24 * 60 * 60 * 1000);
    fs.utimesSync(at, when, when);
  };
  kept('T-121-recent', 1, runs[0]);
  kept('T-110-week', 7, runs[1]);
  kept('T-108-old', 20, runs[2]);
  const removed = pruneArtifacts(out, now);
  assert.deepEqual(fs.readdirSync(path.join(out, 'artifacts')).sort(), [runs[0], ...runs.slice(3)]);
  assert.deepEqual(fs.readdirSync(path.join(out, 'failed')).sort(), ['T-110-week', 'T-121-recent']);
  assert.ok(removed.includes(path.join('failed', 'T-108-old')));
  assert.deepEqual(pruneArtifacts(path.join(dir, 'prune', 'nothing-here'), now), []);
});

test('a flow failed by an exception says why, from the report', async () => {
  // T-120, 27.10.2026: "[Failed] Switch accounts on a running app (44s)" — the
  // simulator was gone, and only junit.xml said so.
  const app = appTree('reason');
  const folder = path.join(dir, 'reason-bin');
  fs.mkdirSync(folder);
  fs.writeFileSync(path.join(folder, 'npm'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const junit = `<testsuite><testcase name="Sign in" file="e2e/flows/01-login.yaml" status="ERROR"><failure>maestro.DeviceUnreachableException: Device became unreachable during deviceInfo\n\tat maestro.drivers.IOSDriver</failure></testcase></testsuite>`;
  fs.writeFileSync(path.join(folder, 'node'), `#!/bin/sh\nmkdir -p e2e/out\ncat > e2e/out/junit.xml <<'XML'\n${junit}\nXML\necho "[Failed] Sign in (13s)"\nexit 1\n`, { mode: 0o755 });
  const result = await runChecks({ root: path.dirname(app), changedFiles: ['rehearsal-calendar-native/src/App.tsx'], node: path.join(folder, 'node'), log: path.join(dir, 'reason.log'), env });
  const e2e = result.steps.find((step) => step.name === 'e2e');
  const line = '[e2e] failed: e2e/flows/01-login.yaml — maestro.DeviceUnreachableException: Device became unreachable during deviceInfo';
  assert.ok(e2e.failures.includes(line));
  assert.match(e2e.tail, /DeviceUnreachableException/);
});


/** A node that "runs e2e": the first call writes `first` as the report and fails, later ones `later`; each call's flows go to calls.txt. */
function e2eRuns(name, first, later) {
  const folder = path.join(dir, `${name}-bin`);
  fs.mkdirSync(folder);
  fs.writeFileSync(path.join(folder, 'npm'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const report = (cases) => `<testsuite>${cases.map(([file, failure]) => `<testcase name="${file}" file="${file}" status="${failure ? 'ERROR' : 'SUCCESS'}">${failure ? `<failure>${failure}</failure>` : ''}</testcase>`).join('')}</testsuite>`;
  fs.writeFileSync(path.join(folder, 'node'), `#!/bin/sh
shift
echo "$*" >> calls.txt
mkdir -p e2e/out
if [ "$(wc -l < calls.txt)" -eq 1 ]; then
cat > e2e/out/junit.xml <<'XML'
${report(first)}
XML
exit 1
fi
cat > e2e/out/junit.xml <<'XML'
${report(later)}
XML
${later.some(([, failure]) => failure) ? 'exit 1' : 'exit 0'}
`, { mode: 0o755 });
  return path.join(folder, 'node');
}

const LOST = 'maestro.DeviceUnreachableException: Device became unreachable during deviceInfo';

test('flows the Maestro driver never ran are run again, not called red', async () => {
  // T-120, 27.10.2026: the driver on the simulator exited 28 minutes in, during
  // flow 13; the 25 flows after it failed at their first command, and the same
  // code passed 37/37 on the next run. A developer session went on proving it.
  const app = appTree('lost');
  const node = e2eRuns('lost', [['e2e/flows/01-login.yaml'], ['e2e/flows/05-inbox.yaml', LOST], ['e2e/flows/30-sync.yaml', LOST]],
    [['e2e/flows/05-inbox.yaml'], ['e2e/flows/30-sync.yaml']]);
  const result = await runChecks({ root: path.dirname(app), changedFiles: ['rehearsal-calendar-native/e2e/subflows/sign-in-form.yaml', 'rehearsal-calendar-native/e2e/flows/30-sync.yaml'], node, log: path.join(dir, 'lost.log'), env });
  const e2e = result.steps.find((step) => step.name === 'e2e');
  assert.equal(e2e.ok, true);
  assert.deepEqual(fs.readFileSync(path.join(app, 'calls.txt'), 'utf8').trim().split('\n'),
    ['e2e/flows/01-login.yaml e2e/flows/05-inbox.yaml e2e/flows/30-sync.yaml', 'e2e/flows/05-inbox.yaml e2e/flows/30-sync.yaml']);
  assert.match(e2e.tail, /драйвер Maestro.*2 сценари/);
  assert.equal(e2e.driverLost, 2);
  assert.deepEqual(e2e.flows, ['e2e/flows/01-login.yaml', 'e2e/flows/05-inbox.yaml', 'e2e/flows/30-sync.yaml']);
});

test('a flow that failed on its own is red, whatever the driver did after it', async () => {
  const app = appTree('lost-real');
  const node = e2eRuns('lost-real', [['e2e/flows/01-login.yaml', 'Assertion is false: "Calendar" is visible'], ['e2e/flows/05-inbox.yaml', LOST]], []);
  const result = await runChecks({ root: path.dirname(app), changedFiles: ['rehearsal-calendar-native/e2e/subflows/sign-in-form.yaml'], node, log: path.join(dir, 'lost-real.log'), env });
  const e2e = result.steps.find((step) => step.name === 'e2e');
  assert.equal(e2e.ok, false);
  assert.equal(fs.readFileSync(path.join(app, 'calls.txt'), 'utf8').trim().split('\n').length, 1);
});

test('lost again on the second run is red, with both runs in what failed', async () => {
  const app = appTree('lost-twice');
  const node = e2eRuns('lost-twice', [['e2e/flows/01-login.yaml'], ['e2e/flows/05-inbox.yaml', LOST]], [['e2e/flows/05-inbox.yaml', LOST]]);
  const result = await runChecks({ root: path.dirname(app), changedFiles: ['rehearsal-calendar-native/e2e/subflows/sign-in-form.yaml'], node, log: path.join(dir, 'lost-twice.log'), env });
  const e2e = result.steps.find((step) => step.name === 'e2e');
  assert.equal(e2e.ok, false);
  assert.equal(fs.readFileSync(path.join(app, 'calls.txt'), 'utf8').trim().split('\n').length, 2);
  assert.equal(e2e.failures.filter((line) => line.includes('05-inbox.yaml — maestro.DeviceUnreachableException')).length, 2);
  assert.match(e2e.tail, /драйвер Maestro/);
});

test('a folder beside the Maestro runs is not taken for the newest run', () => {
  // 27.10.2026: an empty metro-watch-48323 in the reviewer's tree sorted after
  // every dated run, so the control run's red flow kept no screenshots, and
  // pruning counted it as one of the five newest.
  const out = path.join(dir, 'stray', 'e2e', 'out');
  const runs = ['2026-10-01_010000', '2026-10-02_010000', '2026-10-03_010000', '2026-10-04_010000',
    '2026-10-05_010000', '2026-10-06_010000'];
  for (const run of [...runs, 'metro-watch-48323']) fs.mkdirSync(path.join(out, 'artifacts', run), { recursive: true });
  assert.deepEqual(maestroRuns(out), runs);
  pruneArtifacts(out);
  assert.deepEqual(fs.readdirSync(path.join(out, 'artifacts')).sort(), [...runs.slice(1), 'metro-watch-48323']);
  assert.deepEqual(maestroRuns(path.join(dir, 'stray', 'none')), []);
});

test('a person changed in the seed brings the flows that sign in as them', () => {
  // T-122 gave flow 42 a second `charlotta` in the seed and made her admin of
  // a newer project; flow 20, hers, then opened the form on the wrong one, and
  // only the control run saw it (T-211).
  const app = path.join(dir, 'seed-people', 'rehearsal-calendar-native');
  const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(app, rel)), { recursive: true }); fs.writeFileSync(path.join(app, rel), text); };
  write('e2e/flows/01-login.yaml', '- runFlow:\n    env:\n      EMAIL: ${OLGA_EMAIL}\n');
  write('e2e/flows/20-save.yaml', '- runFlow:\n    env:\n      EMAIL: ${CHARLOTTA_EMAIL}\n');
  write('e2e/flows/31-late.yaml', '- openLink: ${LATE_ANSWER_REHEARSAL}\n');
  write('e2e/flows/42-count.yaml', '- runFlow:\n    env:\n      EMAIL: ${OLGA_EMAIL}\n');
  const seedLines = [
    "  charlotta: { email: 'charlotta@e2e.test', firstName: 'Charlotta', onboarded: true },",
    '  // Olga is named only in a comment here.',
    "    late_answer: await rehearsal(ballId, 'Ball rehearsal', 2, 12, 13, ['gaev'], 'gaev'),",
  ];
  assert.deepEqual(e2eFlowsFor({ app, changedFiles: ['rehearsal-calendar-native/e2e/flows/42-count.yaml', 'rehearsal-calendar-native/e2e/seed.mjs'], seedLines }),
    ['e2e/flows/20-save.yaml', 'e2e/flows/31-late.yaml', 'e2e/flows/42-count.yaml']);
});
