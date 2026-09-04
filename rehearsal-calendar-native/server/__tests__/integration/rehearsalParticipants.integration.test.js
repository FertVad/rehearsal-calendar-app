/**
 * Rehearsal Service — participants and the busy slots they imply.
 *
 * Goes through updateRehearsal itself rather than driving SQL, because the bug
 * these cover was an ordering mistake inside the service: the availability was
 * rebuilt from the roster before the roster was updated, so a person added by
 * an edit never got a busy slot and a person removed kept one.
 */
import { jest } from '@jest/globals';
import {
  setupIntegrationDb,
  closeIntegrationDb,
  seedTestData,
} from './setup.js';

let testDb;
let testData;

const mockDbRun = jest.fn();
const mockDbGet = jest.fn();
const mockDbAll = jest.fn();

// Mirrors db.transaction: a handle passed in, a throw that undoes everything.
// There is one connection here, so the isolation it reproduces is the shape
// callers rely on rather than the pooling.
const mockDb = {
  run: mockDbRun,
  get: mockDbGet,
  all: mockDbAll,
  async transaction(fn) {
    return fn(mockDb);
  },
};

jest.unstable_mockModule('../../database/db.js', () => ({
  default: mockDb,
  isPostgres: false,
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { createRehearsal, updateRehearsal } = await import(
  '../../services/rehearsals/rehearsalService.js'
);

const DAY = '2026-09-14';
const START = `${DAY}T10:00:00.000Z`;
const END = `${DAY}T13:00:00.000Z`;

function busyUserIds(rehearsalId) {
  return testDb
    .all(
      `SELECT user_id FROM native_user_availability
       WHERE source = 'rehearsal' AND external_event_id = ?
       ORDER BY user_id`,
      [String(rehearsalId)]
    )
    .map((r) => Number(r.user_id));
}

function responses(rehearsalId) {
  return testDb
    .all(
      'SELECT user_id, response FROM native_rehearsal_responses WHERE rehearsal_id = ? ORDER BY user_id',
      [rehearsalId]
    )
    .map((r) => ({ userId: Number(r.user_id), response: r.response }));
}

describe('Rehearsal participants and their busy slots', () => {
  let owner;
  let member;
  let projectId;

  beforeAll(async () => {
    testDb = await setupIntegrationDb();
    mockDbRun.mockImplementation((sql, params) => testDb.run(sql, params));
    mockDbGet.mockImplementation((sql, params) => testDb.get(sql, params));
    mockDbAll.mockImplementation((sql, params) => testDb.all(sql, params));
    testData = await seedTestData(testDb);

    owner = Number(testData.adminId);
    member = Number(testData.memberId);
    projectId = Number(testData.projectId);
  });

  beforeEach(() => {
    testDb.run('DELETE FROM native_user_availability', []);
    testDb.run('DELETE FROM native_rehearsal_responses', []);
    testDb.run('DELETE FROM native_rehearsals', []);
  });

  afterAll(() => {
    closeIntegrationDb();
  });

  async function create(participantIds) {
    const r = await createRehearsal(projectId, owner, {
      title: 'Act II',
      startsAt: START,
      endsAt: END,
      participant_ids: participantIds,
    });
    return Number(r.id);
  }

  it('books a busy slot for everyone on a new rehearsal', async () => {
    const id = await create([member]);
    expect(busyUserIds(id)).toEqual([member]);
  });

  it('books a slot for someone added by an edit', async () => {
    const id = await create([member]);

    await updateRehearsal(id, projectId, {
      title: 'Act II',
      startsAt: START,
      endsAt: END,
      participant_ids: [member, owner],
    });

    // The owner joined the rehearsal, so their day is no longer free.
    expect(busyUserIds(id)).toEqual([owner, member].sort((a, b) => a - b));
  });

  it('frees the day of someone dropped by an edit', async () => {
    const id = await create([member, owner]);

    await updateRehearsal(id, projectId, {
      title: 'Act II',
      startsAt: START,
      endsAt: END,
      participant_ids: [member],
    });

    expect(busyUserIds(id)).toEqual([member]);
  });

  it('moves the slots when the time changes', async () => {
    const id = await create([member]);
    const later = `${DAY}T18:00:00.000Z`;
    const laterEnd = `${DAY}T20:00:00.000Z`;

    await updateRehearsal(id, projectId, {
      title: 'Act II',
      startsAt: later,
      endsAt: laterEnd,
      participant_ids: [member],
    });

    const slots = testDb.all(
      `SELECT starts_at, ends_at FROM native_user_availability
       WHERE source = 'rehearsal' AND external_event_id = ?`,
      [String(id)]
    );
    expect(slots).toHaveLength(1);
    expect(String(slots[0].starts_at)).toContain('18:00');
  });

  it('adds newcomers as unseen and leaves existing answers alone', async () => {
    const id = await create([member]);

    // The member has read it
    testDb.run(
      "UPDATE native_rehearsal_responses SET response = 'yes' WHERE rehearsal_id = ? AND user_id = ?",
      [id, member]
    );

    await updateRehearsal(id, projectId, {
      title: 'Act II',
      startsAt: START,
      endsAt: END,
      participant_ids: [member, owner],
    });

    const rows = responses(id);
    expect(rows).toContainEqual({ userId: member, response: 'yes' });
    expect(rows).toContainEqual({ userId: owner, response: 'no' });
  });
});
