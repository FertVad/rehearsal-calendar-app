/**
 * The store's world (T-274, e2e/store/seed.mjs): the Planner's first card is
 * today's, and frame 1 needs all four levels on it. Today's busy hours start
 * at the next full hour and the Planner's day ends at 23:00, so late in the
 * evening there is no room for the three busy levels: the seed must refuse
 * then, before it writes anything, rather than let the run pass green with a
 * frame 1 the task did not ask for.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { busyBlocks, LAST_HOUR, seedStore, storeHour } from '../store/seed.mjs';

const LEVELS = [8, 5, 2]; // more than 50 %, up to 50 %, up to 25 % of the play's twelve

test('until LAST_HOUR, today has one window of each busy level, after now and by 23:00', () => {
  for (let hour = 0; hour <= LAST_HOUR; hour++) {
    const blocks = busyBlocks(0, hour);
    assert.deepEqual(blocks.map((block) => block.busy).sort(), [...LEVELS].sort(), `at ${hour}:xx`);
    for (const block of blocks) {
      assert.ok(block.from >= (hour + 1) * 60, `at ${hour}:xx a block starts at ${block.from / 60}`);
      assert.ok(block.to <= 23 * 60, `at ${hour}:xx a block ends at ${block.to / 60}`);
    }
  }
});

test('after LAST_HOUR in the page\'s country the seed refuses, before it writes anything', async () => {
  // 20:30 in Moscow, 12:30 in New York.
  const now = new Date('2026-11-19T17:30:00Z');
  assert.equal(storeHour('ru', now), 20);
  assert.ok(storeHour('ru', now) > LAST_HOUR);
  const client = { query: async () => { throw new Error('wrote to the database'); } };
  await assert.rejects(seedStore({ client, apiUrl: 'http://127.0.0.1:9', locale: 'ru', now }), /20:30|after 19:59|before 20:00/);
});
