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
    { 'T-001': 'continue', 'T-002': 'skip' });
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
  assert.deepEqual(parseDecisions(text), { 'T-003': 'continue' });
});
