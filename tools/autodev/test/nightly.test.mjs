// The whole e2e set, apart from the tasks: when it is due, and the task a
// flow red twice becomes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MACHINE_RETRY_MS, fullE2eDue, regressionTask, regressionTitle, seenByE2e, unseenGroups } from '../lib/nightly.mjs';
import { parseTasks } from '../lib/store.mjs';

const HOUR = 60 * 60 * 1000;
const now = Date.parse('2026-10-28T00:30:00Z');

test('the whole set runs once a night on new reviewed code', () => {
  assert.equal(fullE2eDue({ head: 'b', now, hour: 2 }), true);
  assert.equal(fullE2eDue({ head: 'b', now, hour: 14 }), false, 'not by day while tasks run');
  assert.equal(fullE2eDue({ head: 'b', now, hour: 2, last: { head: 'b', at: new Date(now - 30 * HOUR).toISOString(), ok: true } }), false, 'the same code again');
  assert.equal(fullE2eDue({ head: 'c', now, hour: 3, last: { head: 'b', at: new Date(now - 2 * HOUR).toISOString(), ok: true } }), false, 'once a night');
  assert.equal(fullE2eDue({ head: 'c', now, hour: 2, last: { head: 'b', at: new Date(now - 24 * HOUR).toISOString(), ok: false } }), true, 'the next night');
  assert.equal(fullE2eDue({ head: null, now, hour: 2 }), false);
});

test('a run the machine spoiled is tried again after an hour', () => {
  const last = (ago) => ({ head: 'b', at: new Date(now - ago).toISOString(), machine: true });
  assert.equal(fullE2eDue({ head: 'b', now, hour: 2, last: last(20 * 60 * 1000) }), false);
  assert.equal(fullE2eDue({ head: 'b', now, hour: 2, last: last(MACHINE_RETRY_MS) }), true);
});

test('when the queue is done the control run goes at once, once per code', () => {
  const at = new Date(now - HOUR).toISOString();
  assert.equal(fullE2eDue({ head: 'c', now, hour: 14, queueEmpty: true, last: { head: 'b', at, ok: true } }), true);
  assert.equal(fullE2eDue({ head: 'c', now, hour: 14, queueEmpty: true, last: { head: 'c', at, ok: true } }), false);
});

test('flows red twice are a task that names them, so its checks run them', () => {
  const flows = [
    { file: 'e2e/flows/22-calendar-filter.yaml', name: 'Calendar filter against a late answer' },
    { file: 'e2e/flows/11-password-reset.yaml', name: 'Password reset by emailed code' },
  ];
  const block = regressionTask({
    id: 'T-209', kind: 'ночной', head: 'ef717df1234', lastGreen: 'e32b0ad9876', flows,
    failures: ['[Failed] Calendar filter against a late answer (1m 25s) (Assertion is false)'],
    evidence: 'Логи — rehearsal-calendar-native/e2e/out/failed/full-e2e-ef717df-x/', when: '28.10.2026, 02:40',
  });
  const [task] = parseTasks(`# Очередь\n\n${block}`);
  assert.equal(task.id, 'T-209');
  assert.equal(task.title, regressionTitle(flows));
  assert.match(task.title, /^Полный e2e красный: Calendar filter against a late answer и ещё 1$/);
  assert.match(task.body, /e32b0ad\.\.ef717df/);
  assert.match(task.body, /\[Failed\] Calendar filter/);
  assert.deepEqual(flows.map((f) => task.body.includes(f.file)), [true, true]);
  assert.equal(regressionTitle([]), 'Полный e2e красный: до сценариев');
});

test('the whole set does not run again for changes it cannot see (owner, 21.11.2026)', () => {
  // T-289's second round over the last green run: the App Store's tools, their
  // test, the evidence — and one line of the app, a testID gone, which a flow
  // could have used.
  const app = 'rehearsal-calendar-native/src/features/profile/screens/CalendarSyncSettingsScreen.tsx';
  assert.deepEqual(seenByE2e([
    'audit/evidence/T-289/report.md',
    'rehearsal-calendar-native/e2e/__tests__/store-video.test.mjs',
    'rehearsal-calendar-native/e2e/store/README.md',
    'rehearsal-calendar-native/e2e/store/compose.swift',
    'rehearsal-calendar-native/e2e/store/montage.mjs',
    'rehearsal-calendar-native/e2e/store/video.yaml',
    app,
  ]), [app]);

  // A video put together again, with the supervisor's own commit merged in.
  const remontage = [
    'audit/evidence/T-290/report.md',
    'rehearsal-calendar-native/e2e/__tests__/store-video.test.mjs',
    'rehearsal-calendar-native/e2e/store/montage.mjs',
    'rehearsal-calendar-native/e2e/store/compose.swift',
    'rehearsal-calendar-native/docs/e2e.md',
    'CLAUDE.md',
    'tools/autodev/supervisor.mjs',
    'tools/autodev/test/nightly.test.mjs',
    'screens/shots/en-01-calendar.png',
    '.github/workflows/check.yml',
    'rehearsal-calendar-native/server/__tests__/integration/setup.js',
    'rehearsal-calendar-native/src/shared/utils/__tests__/time.test.ts',
  ];
  assert.deepEqual(seenByE2e(remontage), []);
  assert.equal(unseenGroups(remontage), 'съёмка для App Store, тесты, отчёты, документация, супервизор, снимки лендинга, CI');
  assert.equal(unseenGroups([]), '');

  // What the run builds, serves or runs is the app.
  for (const file of [
    'rehearsal-calendar-native/e2e/device/App.js', // in the e2e bundle (metro.config.js)
    'rehearsal-calendar-native/e2e/flows/01-login.yaml',
    'rehearsal-calendar-native/e2e/subflows/sign-in.yaml',
    'rehearsal-calendar-native/e2e/scripts/seen.js',
    'rehearsal-calendar-native/e2e/run.mjs',
    'rehearsal-calendar-native/e2e/seed.mjs',
    'rehearsal-calendar-native/metro.config.js',
    'rehearsal-calendar-native/server/public/privacy.html', // flows open the landing's pages
    'rehearsal-calendar-native/server/routes/auth.js',
    'rehearsal-calendar-native/app.json',
    'rehearsal-calendar-native/package-lock.json',
    'rehearsal-calendar-native/src/i18n/translations/ru.ts',
  ]) assert.deepEqual(seenByE2e([file]), [file], file);
});
