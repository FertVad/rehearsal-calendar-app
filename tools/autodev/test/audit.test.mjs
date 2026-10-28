import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditTasks, parseRegistry, parseTriage } from '../lib/audit.mjs';
import { pauseReasons } from '../lib/guard.mjs';

const TRIAGE = `# Разбор
## Сначала — правки с серьёзными находками
| № | Правка причины | Находки |
|---|---|---|
| 7 | Форма репетиции. Сделано в \`58a7706\` | ★DP02, HC02 |
| 8 | Состав и расчёт планировщика привязаны к проекту | ★DP01 |
| 9 | Приглашение переживает онбординг | ★HN01, HP03 |
## Потом — остальные правки
| № | Правка причины | Находки |
|---|---|---|
| 10 | Операции выполняются одной транзакцией | B01, B02, D03 |
| 11 | У push-токена один владелец | G01 |
`;

const REGISTRY = `| ID | Важность | Условный | Пакет | Статус | Краткая суть | Evidence |
|---|---|---|---|---|---|---|
| A01 | High | Нет | R3 | IN_PROGRESS | захват аккаунта | — |
| A03 | Medium | Нет | R3 | IN_PROGRESS | пароль | — |
| A04 | Medium | Нет | R3 | IN_PROGRESS | способы входа | — |
| B01 | Medium | Нет | R4 | TODO | удаление участника неатомарно | — |
| B02 | Medium | Нет | R4 | TODO | x | — |
| D03 | Medium | Нет | R4 | TODO | x | — |
| DP01 | Medium | Нет | R5 | TODO | старые ID участников | — |
| DP02 | Medium | Нет | R9 | VERIFIED | x | — |
| G01 | High | Нет | R4 | READY_FOR_CHECK | два владельца токена | — |
| HN01 | Medium | Нет | R9 | TODO | приглашение теряется | — |
| HP03 | Low | Нет | R9 | TODO | x | — |
`;

test('reads the triage rows with their findings', () => {
  const fixes = parseTriage(TRIAGE);
  assert.deepEqual(fixes.map((f) => [f.num, f.findings, f.done, f.serious]), [
    [7, ['DP02', 'HC02'], true, true],
    [8, ['DP01'], false, true],
    [9, ['HN01', 'HP03'], false, true],
    [10, ['B01', 'B02', 'D03'], false, false],
    [11, ['G01'], false, false],
  ]);
});

test('reads the register', () => {
  assert.deepEqual(parseRegistry(REGISTRY).DP01, { severity: 'Medium', pkg: 'R5', status: 'TODO', summary: 'старые ID участников' });
});

test('the owner\'s order: open fixes 1–9, then the R3 client, then 10–22; done ones left out', () => {
  const tasks = auditTasks(TRIAGE, REGISTRY);
  // 7 is marked done; 11's only finding is READY_FOR_CHECK.
  assert.deepEqual(tasks.map((t) => t.id), ['T-108', 'T-109', 'T-130', 'T-110']);
});

test('a task carries its findings, where to read them and where to report', () => {
  const [fix8] = auditTasks(TRIAGE, REGISTRY);
  assert.match(fix8.body, /DP01 — Medium, пакет R5, статус TODO: старые ID участников/);
  assert.match(fix8.body, /audit\/AUDIT_REPORT\.md, раздел «### DP01»/);
  assert.match(fix8.body, /audit\/REMEDIATION_R5\.md/);
  assert.match(fix8.body, /HANDOFF_CLAUDE\.md §4/);
});

test('the R3 client is left out once its findings are settled', () => {
  const settled = REGISTRY.replace(/\| (A0[134]) \| (\w+) \| Нет \| R3 \| IN_PROGRESS/g, '| $1 | $2 | Нет | R3 | READY_FOR_CHECK');
  assert.ok(!auditTasks(TRIAGE, settled).some((t) => t.id === 'T-130'));
});

test('signing in on the app side pauses like the server\'s', () => {
  assert.equal(pauseReasons(['rehearsal-calendar-native/src/features/auth/screens/LoginScreen.tsx'], []).length, 1);
  assert.equal(pauseReasons(['rehearsal-calendar-native/src/contexts/AuthContext.tsx'], []).length, 1);
  assert.equal(pauseReasons(['rehearsal-calendar-native/src/features/calendar/screens/CalendarScreen.tsx'], []).length, 0);
});
