/**
 * The store's world (T-274, e2e/store/seed.mjs): the Planner's first card is
 * today's, and frame 1 needs all four levels on it. Today's busy hours start
 * at the next full hour and the Planner's day ends at 23:00, so late in the
 * evening there is no room for the three busy levels: the seed must refuse
 * then, before it writes anything, rather than let the run pass green with a
 * frame 1 the task did not ask for.
 *
 * And the video's shots 6 and 7 (T-286): the calendar lists the rehearsals
 * ahead under the count that runs to "12 of 12", so none of them reads "0/7" —
 * each is seen by some of its cast, through the API as their phones mark it,
 * and not by all; the rehearsal of all twelve by nobody, its count runs in the shot.
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

/**
 * seedStore for `locale` against a stand-in database and server, at noon in
 * Moscow: the rehearsals it made ({ id, title, cast: how many are on it }), and
 * who marked which seen ({ id → [token, …] }) and how.
 */
async function seedAgainstStandIns(locale) {
  let next = 100;
  const rehearsals = [];
  const marks = new Map();
  const client = { query: async () => ({ rows: [{ id: next++ }] }) };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, { method, headers, body }) => {
    const route = new URL(url).pathname;
    const sent = body ? JSON.parse(body) : undefined;
    let answer = {};
    if (route === '/auth/login') answer = { accessToken: `token-${sent.email}` };
    else if (method === 'POST' && route === '/native/projects') answer = { project: { id: next++ } };
    else if (/^\/native\/projects\/\d+\/invite$/.test(route)) answer = { inviteCode: `code-${next++}` };
    else if (/^\/native\/projects\/\d+\/rehearsals$/.test(route)) {
      const id = next++;
      rehearsals.push({ id, title: sent.title, cast: sent.participant_ids.length });
      answer = { rehearsal: { id } };
    } else if (/^\/native\/rehearsals\/\d+\/respond$/.test(route)) {
      assert.deepEqual(sent, { response: 'yes' }, 'marked as the app marks "seen"');
      const id = Number(route.split('/')[3]);
      marks.set(id, [...(marks.get(id) ?? []), headers.Authorization]);
    }
    return new Response(JSON.stringify(answer), { status: 200 });
  };
  try {
    const seeded = await seedStore({ client, apiUrl: 'http://stand.in', locale, now: new Date('2026-11-19T09:00:00Z') });
    return { seeded, rehearsals, seenBy: (id) => new Set(marks.get(id) ?? []).size };
  } finally {
    globalThis.fetch = realFetch;
  }
}

test('the rehearsals ahead are each seen by some of their cast and not all; the one of all twelve by nobody yet', async () => {
  const { seeded, rehearsals, seenBy } = await seedAgainstStandIns('ru');
  const { everyone, seen } = seeded.rehearsals;
  assert.equal(rehearsals.length, 17, 'two tomorrow, two in two days, the one of all twelve, twelve ahead');
  assert.equal(seenBy(everyone), 0, 'the rehearsal of all twelve: its count runs from 0/12 in shot 6');
  assert.equal(seenBy(seen), 5, 'frame 5: 5 of 8');
  for (const { id, title, cast } of rehearsals.filter((r) => r.id !== everyone && r.id !== seen)) {
    const count = seenBy(id);
    assert.ok(count >= 1 && count < cast, `${title} (${id}): ${count}/${cast}`);
  }
});
