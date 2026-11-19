import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../lib/prompts.mjs';

const { readResult, readVerdict, pickResult } = P;
const task = { id: 'T-109', title: 'Правка причины №9', body: 'Что сделать.' };

test('the developer\'s marker is read off the last line only', () => {
  assert.deepEqual(readResult('Сделано то-то.\n\nRESULT: DONE\n'), { done: true });
  assert.deepEqual(readResult('Нужна миграция.\nRESULT: BLOCKED: нужна миграция 012'), { blocked: true, reason: 'нужна миграция 012' });
  assert.equal(readResult('RESULT: DONE\nа потом ещё текст'), null);
  assert.equal(readResult(''), null);
});

test('markdown around the marker is not mistaken for more text', () => {
  assert.deepEqual(readResult('Отчёт.\n\n**RESULT: DONE**'), { done: true });
  assert.deepEqual(readResult('Отчёт.\n```\nRESULT: DONE\n```\n'), { done: true });
  assert.deepEqual(readResult('Отчёт.\n`RESULT: DONE`\n\n---'), { done: true });
  assert.equal(readVerdict('Замечаний нет.\n\n**VERDICT: ACCEPT**\n'), 'accept');
});

test('the reviewer\'s verdict is read off the last line only', () => {
  assert.equal(readVerdict('Замечаний нет.\nVERDICT: ACCEPT'), 'accept');
  assert.equal(readVerdict('R-01 …\nVERDICT: CHANGES\n'), 'changes');
  assert.equal(readVerdict('VERDICT: ACCEPT\nно вообще-то нет'), null);
});

test('a run that ended several times counts the answer with the marker, not the last turn', () => {
  // T-108: the report, then a reply to a background job's notification.
  const picked = pickResult(['Отчёт по задаче.\nRESULT: DONE', 'Уведомление уже обработано.']);
  assert.deepEqual(picked.result, { done: true });
  assert.equal(picked.text, 'Отчёт по задаче.\nRESULT: DONE');
  assert.deepEqual(pickResult(['раз', 'два']), { result: null, text: 'два' });
  assert.deepEqual(pickResult([]), { result: null, text: '' });
});

test('every developer message names its task and asks for the marker', () => {
  const messages = [
    P.developTask(task),
    P.fixChecks(task, [{ name: 'tests', ok: false, code: 1, tail: 'FAIL x' }], 'abc1234 fix'),
    P.fixReview(task, 'R-01 …', 'abc1234 fix'),
    P.continueStep(task, 'fix-review'),
    P.missingMarker(task),
    P.refusedCommand(task, 'develop', 'cd && git отклонено'),
    P.ownerApproved(task, 'develop', 'нужна миграция'),
    P.uncommitted(task, ' M a.ts'),
  ];
  for (const message of messages) {
    assert.ok(message.includes(`${task.id}: ${task.title}`), message.slice(0, 80));
    assert.match(message, /RESULT: DONE\nRESULT: BLOCKED: <причина>$/);
    // T-108 was sent a bare "continue" and started the next audit fix.
    assert.doesNotMatch(message, /^Продолжай/);
  }
});

test('the reviewer is told when a round follows its earlier ones in the same conversation', () => {
  const args = { base: 'a', head: 'b', devReport: 'r', checks: { steps: [] }, round: 1 };
  assert.match(P.review(task, args), /Это первый круг ревью:/);
  assert.match(P.review(task, { ...args, earlier: true }), /новый первый круг ревью \(владелец продлил работу над задачей; прежние круги и твои замечания — выше в этой беседе\)/);
  assert.match(P.review(task, { ...args, round: 2, earlier: true }), /второй и последний круг ревью:/);
  assert.doesNotMatch(P.review(task, args), /круг круг|круг ревью круг/);
});

test('a reviewer new to the task is sent to the answers of the rounds it has not seen', () => {
  // Codex reviewed until 19.11.2026; its threads do not carry over to Fable.
  const args = { base: 'a', head: 'b', devReport: 'r', checks: { steps: [] }, round: 1 };
  const files = ['/x/AUTODEV/reviews/T-109-r1.md', '/x/AUTODEV/reviews/T-109-r2.md'];
  const message = P.review(task, { ...args, earlierReviews: files });
  assert.match(message, /новый первый круг ревью \(владелец продлил работу над задачей\):/);
  assert.match(message, /Прежние круги ревью этой задачи вёл другой ревьюер/);
  for (const file of files) assert.ok(message.includes(`- ${file}`), file);
  // Its own session remembers them: no list then.
  assert.doesNotMatch(P.review(task, { ...args, earlier: true, earlierReviews: files }), /вёл другой ревьюер/);
  // The task bodies still call the reviewer Astra.
  assert.match(message, /ревьюера иногда зовут Астрой — это ты/);
  assert.doesNotMatch(P.REVIEW_CONTINUE, /остановилась/);
});

test('commits that would not cherry-pick are ported first, by meaning, then the step itself', () => {
  const port = { from: 'auto/deferred/T-108', commits: ['02a8549f93a7', 'c9f40a5e3d25'], conflicts: ['audit/TRIAGE_R4_R9.md'] };
  const message = P.fixReview(task, 'R5-02 …', '', port);
  assert.match(message, /Сначала перенеси на текущую ветку работу этой задачи из auto\/deferred\/T-108/);
  assert.match(message, /- 02a8549\n- c9f40a5/);
  assert.match(message, /конфликт: audit\/TRIAGE_R4_R9\.md/);
  assert.match(message, /git commit --no-edit/);
  assert.ok(message.indexOf('Сначала перенеси') < message.indexOf('R5-02'), 'the port comes before the notes');
  assert.match(P.portTask(task, port, ''), /Больше ничего не меняй/);
  assert.match(P.portTask(task, port, ''), /RESULT: DONE\nRESULT: BLOCKED: <причина>$/);
  assert.doesNotMatch(P.fixReview(task, 'R5-02 …', ''), /Сначала перенеси/);
});

test('a step\'s fresh session is told what the branch already holds', () => {
  assert.match(P.fixChecks(task, [{ name: 'tests', ok: false, code: 1, tail: 'FAIL x' }], 'abc1234 fix'), /уже есть коммиты:\nabc1234 fix/);
  assert.match(P.fixReview(task, 'R-01 …', 'abc1234 fix'), /R-01 …/);
  assert.doesNotMatch(P.developTask(task), /уже есть коммиты/);
  assert.match(P.developTask(task), /Работай только над этой задачей/);
});

test('a note from the owner leads the message, which still ends with the marker request', () => {
  const message = P.withNote(P.continueStep(task, 'develop'), 'node <файл> теперь разрешён');
  assert.match(message, /^Заметка владельца к этой задаче \(через супервизор\):\nnode <файл> теперь разрешён/);
  assert.match(message, /RESULT: DONE\nRESULT: BLOCKED: <причина>$/);
  assert.equal(P.withNote('x', ''), 'x');
});

test('the owner\'s earlier decisions on a task lead every message to its developer', () => {
  const message = P.withDecisions(P.fixReview(task, 'R-01 …', ''), [{ reason: 'миграцию 012 нужно применить до выкладки', decision: 'продолжить', at: '13.10.2026, 18:20' }]);
  assert.match(message, /^Владелец уже решил по этой задаче — из-за этого повторно не останавливайся/);
  assert.match(message, /«миграцию 012 нужно применить до выкладки» → продолжить/);
  assert.match(message, /RESULT: DONE\nRESULT: BLOCKED: <причина>$/);
  assert.equal(P.withDecisions('x', []), 'x');
});
