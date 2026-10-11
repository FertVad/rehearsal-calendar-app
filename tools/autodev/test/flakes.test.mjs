import { test } from 'node:test';
import assert from 'node:assert/strict';
import { failureExcerpt, flakeName, flakeTask, insertAfter, nextFlakeId } from '../lib/flakes.mjs';
import { parseTasks } from '../lib/store.mjs';

// The tails the checks really gave on 2026-10-10.
const jest = `PASS frontend src/a.test.ts
Summary of all failing tests
FAIL server/__tests__/routes/authorization.test.js
  ● Route authorization › Non-members › cannot read a project they do not belong to

    expect(received).toBe(expected) // Object.is equality

    Expected: 403
    Received: 401

Test Suites: 1 failed, 123 passed, 124 total`;
const nodeTest = `# Subtest: visibility changes and page restoration cancel a pending second automatic scheme attempt
not ok 10 - visibility changes and page restoration cancel a pending second automatic scheme attempt
  ---
  location: '/x/invitePage.browser.test.mjs:230:1'
  error: 'The operation was aborted'
  code: 'ABORT_ERR'
  ...
# pass 10
# fail 1`;

test('the failing test is named by its own title', () => {
  assert.equal(flakeName([{ name: 'tests', tail: jest }]), 'Route authorization › Non-members › cannot read a project they do not belong to');
  assert.equal(flakeName([{ name: 'tests', tail: nodeTest }]), 'visibility changes and page restoration cancel a pending second automatic scheme attempt');
  assert.equal(flakeName([{ name: 'e2e', tail: '[Passed] Sign in (28s)\n[Failed] Inbox (34s)\n' }]), 'Inbox');
  assert.equal(flakeName([{ name: 'tests', tail: 'something odd' }]), 'проверка tests');
});

test('the failure lines gathered over the whole run name the test, not the tail', () => {
  const step = { name: 'tests', code: 1, tail: 'filler\nfiller', failures: ['FAIL server/__tests__/startup/runtimeStartup.test.js', '  ● library import exports the app'] };
  assert.equal(flakeName([step]), 'library import exports the app');
  assert.match(flakeTask({ id: 'T-202', task: { id: 'T-109' }, head: 'abcdef1', steps: [step], evidence: 'x', when: 'y' }), /runtimeStartup\.test\.js/);
});

test('the excerpt keeps what failed and leaves the passes out', () => {
  const excerpt = failureExcerpt(jest);
  assert.match(excerpt, /FAIL server\/__tests__\/routes\/authorization\.test\.js/);
  assert.match(excerpt, /Expected: 403/);
  assert.match(excerpt, /Received: 401/);
  assert.doesNotMatch(excerpt, /PASS frontend/);
  assert.match(failureExcerpt(nodeTest), /error: 'The operation was aborted'/);
});

const QUEUE = `# Очередь

## T-108 Правка №8
Тело 8.

## T-109 Правка №9
Тело 9.

## T-130 Остаток R3
Тело R3.
`;

test('a flaky test is queued right after the task it hit, with an id of its own', () => {
  const id = nextFlakeId(QUEUE);
  assert.equal(id, 'T-201');
  const block = flakeTask({ id, task: { id: 'T-109' }, head: '712995b7296e', steps: [{ name: 'tests', code: 1, tail: jest }],
    evidence: 'Логи красного прогона — rehearsal-calendar-native/e2e/out/failed/T-109-x/', when: '10.10.2026, 10:05' });
  const queue = insertAfter(QUEUE, 'T-109', block);
  assert.deepEqual(parseTasks(queue).map((task) => task.id), ['T-108', 'T-109', 'T-201', 'T-130']);
  const flake = parseTasks(queue).find((task) => task.id === 'T-201');
  assert.match(flake.title, /^Нестабильный тест: Route authorization/);
  assert.match(flake.body, /712995b/);
  assert.match(flake.body, /Received: 401/);
  assert.match(flake.body, /e2e\/out\/failed\/T-109-x/);
  assert.equal(parseTasks(queue).find((task) => task.id === 'T-109').body, 'Тело 9.');
  assert.equal(nextFlakeId(queue), 'T-202');
});

test('after the last task, a flaky test goes to the end', () => {
  const queue = insertAfter(QUEUE, 'T-130', '## T-201 Нестабильный тест: x\n\nТело.\n');
  assert.deepEqual(parseTasks(queue).map((task) => task.id), ['T-108', 'T-109', 'T-130', 'T-201']);
});
