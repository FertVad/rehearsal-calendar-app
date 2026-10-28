import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseTasks, parseDecisions, slugify, loadState, saveState } from '../lib/store.mjs';

test('reads the queue in file order', () => {
  const tasks = parseTasks(`# Очередь

## T-001 Сценарий: отметка занятости
Сделать сценарий.
Только клиент.

## T-002 Language switch
Body two.
`);
  assert.deepEqual(tasks.map((t) => [t.id, t.title, t.slug]), [
    ['T-001', 'Сценарий: отметка занятости', 'scenariy-otmetka-zanyatosti'],
    ['T-002', 'Language switch', 'language-switch'],
  ]);
  assert.equal(tasks[0].body, 'Сделать сценарий.\nТолько клиент.');
});

test('reads the owner\'s decisions', () => {
  assert.deepEqual(parseDecisions('- T-001: продолжить\nT-002: пропустить — не нужно\nчто-то ещё'),
    { 'T-001': { action: 'continue', commits: [], note: '' }, 'T-002': { action: 'skip', commits: [], note: 'не нужно' } });
});

test('a deferred task is continued with the commits named', () => {
  assert.deepEqual(parseDecisions('T-108: продолжить 02a8549 c9f40a5'), { 'T-108': { action: 'continue', commits: ['02a8549', 'c9f40a5'], note: '' } });
  assert.deepEqual(parseDecisions('T-108: пропустить abcdef1'), { 'T-108': { action: 'skip', commits: [], note: '' } });
});

test('a deferred task goes back to review with the commits named, or all of them', () => {
  assert.deepEqual(parseDecisions('T-108: на ревью f9212b3, 0b9f1a9 — только по задаче\nT-109: на ревью'), {
    'T-108': { action: 'review', commits: ['f9212b3', '0b9f1a9'], note: 'только по задаче' },
    'T-109': { action: 'review', commits: [], note: '' },
  });
});

test('slugs stay short and safe', () => {
  assert.equal(slugify('!!!'), 'task');
  assert.ok(slugify('x'.repeat(100)).length <= 48);
});

test('state survives a round trip, a missing file is empty, a corrupt one is an error', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'autodev-'));
  const file = path.join(dir, 'state.json');
  assert.deepEqual(loadState(file), { tasks: {}, current: null, waitUntil: null });
  saveState(file, { tasks: { 'T-001': { phase: 'review' } }, current: 'T-001', waitUntil: null });
  assert.equal(loadState(file).tasks['T-001'].phase, 'review');
  fs.writeFileSync(file, '{ broken');
  assert.throws(() => loadState(file));
});

test('decisions already applied are not read again', () => {
  const text = 'T-003: продолжить\n\n## Применено\n- 09.10.2026, 09:00 — T-002: пропустить\n';
  assert.deepEqual(parseDecisions(text), { 'T-003': { action: 'continue', commits: [], note: '' } });
});

test('what the owner writes after the decision is kept for the developer', () => {
  assert.equal(parseDecisions('T-110: продолжить — разрешено изменить routes/auth.js: только блокировка').T_110, undefined);
  assert.equal(parseDecisions('T-110: продолжить — разрешено изменить routes/auth.js: только блокировка')['T-110'].note,
    'разрешено изменить routes/auth.js: только блокировка');
});

test('a hash quoted in the note is not a choice of commits', () => {
  assert.deepEqual(parseDecisions('T-112: продолжить — сценарий красный на 1fbbc47 и зелёный после')['T-112'],
    { action: 'continue', commits: [], note: 'сценарий красный на 1fbbc47 и зелёный после' });
  assert.deepEqual(parseDecisions('T-108: на ревью f9212b3, 0b9f1a9 — только по задаче')['T-108'],
    { action: 'review', commits: ['f9212b3', '0b9f1a9'], note: 'только по задаче' });
});
