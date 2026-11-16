import { test } from 'node:test';
import assert from 'node:assert/strict';
import { failureExcerpt, flakeName, flakeTask, flakeTitle, isFoundTask, nextFlakeId, queueFound } from '../lib/flakes.mjs';
import { regressionTitle } from '../lib/nightly.mjs';
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

test('a flaky test is queued with an id of its own and what failed', () => {
  const id = nextFlakeId(QUEUE);
  assert.equal(id, 'T-201');
  const block = flakeTask({ id, task: { id: 'T-109' }, head: '712995b7296e', steps: [{ name: 'tests', code: 1, tail: jest }],
    evidence: 'Логи красного прогона — rehearsal-calendar-native/e2e/out/failed/T-109-x/', when: '10.10.2026, 10:05' });
  const waiting = parseTasks(QUEUE).filter((task) => task.id === 'T-130');
  const queue = queueFound(QUEUE, waiting, block);
  assert.deepEqual(parseTasks(queue).map((task) => task.id), ['T-108', 'T-109', 'T-130', 'T-201']);
  const flake = parseTasks(queue).find((task) => task.id === 'T-201');
  assert.match(flake.title, /^Нестабильный тест: Route authorization/);
  assert.match(flake.body, /712995b/);
  assert.match(flake.body, /Received: 401/);
  assert.match(flake.body, /e2e\/out\/failed\/T-109-x/);
  assert.equal(parseTasks(queue).find((task) => task.id === 'T-109').body, 'Тело 9.');
  assert.equal(nextFlakeId(queue), 'T-202');
});


test('an e2e run that failed before any flow is named by what it said', () => {
  const tail = '[e2e] starting Metro, pointed at the local server\n[e2e] checking the bundle talks to the local server\n[e2e] fetch failed';
  assert.equal(flakeName([{ name: 'e2e', tail }]), 'e2e до сценариев: fetch failed');
  assert.match(failureExcerpt(tail), /^\[e2e\] fetch failed$/);
});

test('a flaky flow from the full run says where it came from and names its flows', () => {
  const step = { name: 'e2e', code: 1, tail: '', failures: ['[Failed] Inbox late read after mark all (1m 2s) (Assertion is false)'] };
  const block = flakeTask({ id: 'T-210', task: null, head: 'ef717df1234', steps: [step], evidence: 'x', when: 'y',
    source: 'Источник: ночной полный прогон e2e на auto/main ef717df.', flows: [{ file: 'e2e/flows/36-inbox-late-read.yaml', name: 'Inbox late read after mark all' }] });
  const [task] = parseTasks(block);
  assert.equal(task.title, 'Нестабильный тест: Inbox late read after mark all');
  assert.match(task.body, /^Источник: ночной полный прогон/);
  assert.match(task.body, /- e2e\/flows\/36-inbox-late-read\.yaml — Inbox late read after mark all/);
});

// Owner, 07.11.2026: «обнаруженные баги поставь в очередь первыми». T-234, a
// flaky flow found in T-229's checks, was queued right after T-229 and taken
// at once, ahead of T-232 and T-233 — bugs he had found in the app.
const WAITING = `# Очередь

## T-229 Роль в проекте устаревает
a

## T-232 Админ видит в «Все проекты» все репетиции
b

## T-233 Добавленным в состав приходит уведомление
c

## T-231 Нестабильный тест: Details and the card read one seen mark
d

## T-230 Полный e2e красный: Switch accounts
e

## T-227 e2e собирает тот iOS-проект, что уйдёт в App Store
f
`;

test('a task the supervisor found waits behind the tasks people queued, ahead of its own still waiting', () => {
  const waiting = parseTasks(WAITING).filter((task) => task.id !== 'T-229');
  const queue = queueFound(WAITING, waiting, '## T-234 Нестабильный тест: Details count\n\ng\n');
  assert.deepEqual(parseTasks(queue).map((task) => task.id), ['T-229', 'T-232', 'T-233', 'T-234', 'T-231', 'T-230', 'T-227']);
  assert.equal(parseTasks(queue).find((task) => task.id === 'T-233').body, 'c');
});

test('with none of its own waiting, a found task goes after every task people queued', () => {
  const queue = '# Очередь\n\n## T-120 Done one\n\nx\n\n## T-122 Next\n\ny\n';
  const waiting = parseTasks(queue).filter((task) => task.id === 'T-122');
  const ids = parseTasks(queueFound(queue, waiting, '## T-209 Полный e2e красный: x\n\nz\n')).map((task) => task.id);
  assert.deepEqual(ids, ['T-120', 'T-122', 'T-209']);
});

test('the supervisor knows its own tasks by the titles it gives them', () => {
  assert.equal(isFoundTask(flakeTitle([{ name: 'tests', tail: jest }])), true);
  assert.equal(isFoundTask(regressionTitle([{ name: 'Switch accounts' }])), true);
  assert.equal(isFoundTask(regressionTitle([])), true);
  assert.equal(isFoundTask('Админ видит в «Все проекты» все репетиции своих проектов'), false);
  assert.equal(isFoundTask('e2e собирает тот iOS-проект, что уйдёт в App Store'), false);
});

