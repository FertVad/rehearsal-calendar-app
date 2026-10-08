import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readResult, readVerdict } from '../lib/prompts.mjs';

test('the developer\'s marker is read off the last line only', () => {
  assert.deepEqual(readResult('Сделано то-то.\n\nRESULT: DONE\n'), { done: true });
  assert.deepEqual(readResult('Нужна миграция.\nRESULT: BLOCKED: нужна миграция 012'), { blocked: true, reason: 'нужна миграция 012' });
  assert.equal(readResult('RESULT: DONE\nа потом ещё текст'), null);
  assert.equal(readResult(''), null);
});

test('the reviewer\'s verdict is read off the last line only', () => {
  assert.equal(readVerdict('Замечаний нет.\nVERDICT: ACCEPT'), 'accept');
  assert.equal(readVerdict('R-01 …\nVERDICT: CHANGES\n'), 'changes');
  assert.equal(readVerdict('VERDICT: ACCEPT\nно вообще-то нет'), null);
});
