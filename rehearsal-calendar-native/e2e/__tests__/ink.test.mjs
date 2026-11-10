// The "…" of cut text, found on a screenshot (T-241): flow 59 looks for it,
// for Maestro reads a label whole however much of it the screen draws. Read
// off the planner as the simulator shot it, before the fix and after.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ellipses } from '../ink.mjs';

const SHOTS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'audit', 'evidence', 'T-241');
// Between the status bar and the tabs, as flow 59 asks.
const SCREEN = { left: 0, right: 1, top: 0.07, bottom: 0.9 };

test('finds each "…" of a row of filters cut in four languages', () => {
  // «Video musical “…» · «Se…» · «Partici…os (8)», the project, the week and
  // the people each cut, at the end and in the middle, after a quote mark too.
  const spanish = ellipses(path.join(SHOTS, 'before', 'before-planner-es.png'), { region: SCREEN });
  assert.equal(spanish.length, 3, JSON.stringify(spanish));
  assert.ok(spanish.every((e) => e.top > 135 && e.top < 155), JSON.stringify(spanish));
  for (const language of ['en', 'ru', 'de']) {
    assert.equal(ellipses(path.join(SHOTS, 'before', `before-planner-${language}.png`), { region: SCREEN }).length, 3, language);
  }
});

test('finds none where the words are whole: full stops, "·", umlauts, "i"s, faces and "+5"', () => {
  for (const shot of ['59-planner-es', '59-planner-en', '59-planner-ru', '59-planner-de', '59-participants-es']) {
    assert.deepEqual(ellipses(path.join(SHOTS, 'after', `${shot}.png`), { region: SCREEN }), [], shot);
  }
});

test('looks only inside the region', () => {
  assert.deepEqual(ellipses(path.join(SHOTS, 'before', 'before-planner-es.png'), { region: { ...SCREEN, top: 0.3 } }), []);
});
