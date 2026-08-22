/**
 * RSVP Service — the "seen" toggle.
 *
 * Goes through respondToRehearsal and getRehearsalResponses rather than
 * driving SQL, because the bugs here were in the service: the stats it
 * returned counted the whole project instead of the people on the rehearsal,
 * so the number jumped on every tap and snapped back on the next refresh.
 */
import { jest } from '@jest/globals';
import {
  setupIntegrationDb,
  closeIntegrationDb,
  seedTestData,
} from './setup.js';

let testDb;

const mockDbRun = jest.fn();
const mockDbGet = jest.fn();
const mockDbAll = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
  default: { run: mockDbRun, get: mockDbGet, all: mockDbAll },
  isPostgres: false,
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { respondToRehearsal, getRehearsalResponses, getUserResponse } = await import(
  '../../services/rehearsals/rsvpService.js'
);

describe('Seen toggle', () => {
  let owner;
  let member;
  let outsider;
  let projectId;
  let rehearsalId;

  beforeAll(async () => {
    testDb = await setupIntegrationDb();
    mockDbRun.mockImplementation((sql, params) => testDb.run(sql, params));
    mockDbGet.mockImplementation((sql, params) => testDb.get(sql, params));
    mockDbAll.mockImplementation((sql, params) => testDb.all(sql, params));

    const seeded = await seedTestData(testDb);
    owner = Number(seeded.adminId);
    member = Number(seeded.memberId);
    projectId = Number(seeded.projectId);

    // A third member of the project who is NOT on the rehearsal. The counter
    // must ignore them, which is exactly what the old stats query did not do.
    outsider = Number(
      testDb.run(
        `INSERT INTO native_users (email, password_hash, first_name, last_name)
         VALUES (?, ?, ?, ?)`,
        ['outsider@test.com', 'hash', 'Out', 'Sider']
      ).lastInsertId
    );
    testDb.run(
      `INSERT INTO native_project_members (project_id, user_id, role, status)
       VALUES (?, ?, ?, ?)`,
      [projectId, outsider, 'member', 'active']
    );
  });

  beforeEach(() => {
    testDb.run('DELETE FROM native_rehearsal_responses', []);
    testDb.run('DELETE FROM native_rehearsals', []);

    rehearsalId = Number(
      testDb.run(
        `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at)
         VALUES (?, ?, ?, ?)`,
        [projectId, 'Act II', '2026-09-14T10:00:00.000Z', '2026-09-14T13:00:00.000Z']
      ).lastInsertId
    );

    // Two of the three project members are on this rehearsal, neither has looked
    for (const userId of [owner, member]) {
      testDb.run(
        `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response)
         VALUES (?, ?, 'no')`,
        [rehearsalId, userId]
      );
    }
  });

  afterAll(() => {
    closeIntegrationDb();
  });

  it('marks only the person who tapped', async () => {
    await respondToRehearsal(rehearsalId, owner, 'yes', null, projectId);

    expect(await getUserResponse(rehearsalId, owner)).toMatchObject({ response: 'yes' });
    expect(await getUserResponse(rehearsalId, member)).toMatchObject({ response: 'no' });
  });

  it('counts the people on the rehearsal, not the whole project', async () => {
    // Three active members in the project, two of them on this rehearsal
    const stats = await respondToRehearsal(rehearsalId, owner, 'yes', null, projectId);

    expect(stats).toEqual({ confirmed: 1, invited: 2 });
  });

  it('agrees with what the participants screen reports', async () => {
    const fromTap = await respondToRehearsal(rehearsalId, owner, 'yes', null, projectId);
    const fromScreen = await getRehearsalResponses(rehearsalId);

    expect(fromTap.confirmed).toBe(fromScreen.stats.confirmed);
    expect(fromTap.invited).toBe(fromScreen.stats.invited);
  });

  it('takes the mark back without dropping the person from the rehearsal', async () => {
    await respondToRehearsal(rehearsalId, owner, 'yes', null, projectId);
    const stats = await respondToRehearsal(rehearsalId, owner, 'no', null, projectId);

    expect(stats).toEqual({ confirmed: 0, invited: 2 });
    // Still invited — the row stays, it just says 'no'
    expect(await getUserResponse(rehearsalId, owner)).toMatchObject({ response: 'no' });
  });

  it('refuses anything that is not yes or no', async () => {
    await expect(
      respondToRehearsal(rehearsalId, owner, 'maybe', null, projectId)
    ).rejects.toThrow(/yes.*no/i);
  });
});
