/**
 * Removing someone from a project has to take them off its rehearsals.
 *
 * Membership is not what grants access to a rehearsal — a row in
 * native_rehearsal_responses is. That table has foreign keys to rehearsals and
 * to users, none to membership, so nothing cascaded when a member was removed.
 * Their rows stayed, and with them: the day-before and hour-before reminders,
 * every edited/cancelled push, and the ability to read the rehearsal by id —
 * including changes made after they were removed. The rows also kept a busy
 * slot on their availability, so they showed unavailable to their *other*
 * projects at times nobody expected them.
 *
 * None of it was visible to the admin who removed them: every counter and
 * roster the app displays joins active membership, so the stale rows showed up
 * nowhere. The only thing that ever cleared them was an admin happening to
 * re-save that rehearsal's participants.
 */
import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb, seedTestData } from '../integration/setup.js';

let testDb;
let testData;
let app;
let request;
let generateTokens;
let rehearsalId;
let pastRehearsalId;

const removedUser = () => Number(testData.memberId);

beforeAll(async () => {
  testDb = await setupIntegrationDb();
  testData = await seedTestData(testDb);

  jest.unstable_mockModule('../../database/db.js', () => ({
    default: testDb,
    isPostgres: false,
    initDatabase: async () => testDb,
    testConnection: async () => true,
  }));

  const noop = async () => ({ sent: 0, failed: 0, errors: [] });
  jest.unstable_mockModule('../../services/notifications/pushNotificationService.js', () => ({
    getUserPushTokens: async () => [],
    sendPushNotification: noop,
    notifyRehearsalCreated: noop,
    notifyRehearsalUpdated: noop,
    notifyRehearsalDeleted: noop,
    notifyMemberResponse: noop,
    notifyMemberJoined: noop,
    notifyAdminAppointed: noop,
    notifyRoleChanged: noop,
    notifyMemberRemoved: noop,
    notifyProjectDeleted: noop,
    notifyRehearsal24h: noop,
    notifyRehearsal1h: noop,
  }));

  const express = (await import('express')).default;
  request = (await import('supertest')).default;
  ({ generateTokens } = await import('../../middleware/jwtMiddleware.js'));

  const membersRouter = (await import('../../routes/native/members.js')).default;
  const rehearsalsRouter = (await import('../../routes/native/rehearsals.js')).default;

  app = express();
  app.use(express.json());
  app.use('/api/native/projects', membersRouter);
  app.use('/api/native/projects', rehearsalsRouter);
  app.use('/api/native/rehearsals', rehearsalsRouter);
});

afterAll(() => closeIntegrationDb());

beforeEach(() => {
  testDb.run('DELETE FROM native_user_availability');
  testDb.run('DELETE FROM native_rehearsal_responses');
  testDb.run('DELETE FROM native_rehearsals');

  // Put the member back, since the tests here remove them.
  testDb.run(`DELETE FROM native_project_members WHERE project_id = ? AND user_id = ?`, [
    testData.projectId,
    removedUser(),
  ]);
  testDb.run(
    `INSERT INTO native_project_members (project_id, user_id, role, status)
     VALUES (?, ?, 'member', 'active')`,
    [testData.projectId, removedUser()]
  );

  const make = (title, startsAt, endsAt) =>
    Number(
      testDb.run(
        `INSERT INTO native_rehearsals (project_id, title, location, starts_at, ends_at)
         VALUES (?, ?, ?, ?, ?)`,
        [testData.projectId, title, 'Малая сцена', startsAt, endsAt]
      ).lastInsertId
    );

  rehearsalId = make('Прогон', '2026-12-01T17:00:00.000Z', '2026-12-01T19:00:00.000Z');
  pastRehearsalId = make('Старый прогон', '2020-03-03T17:00:00.000Z', '2020-03-03T19:00:00.000Z');

  for (const id of [rehearsalId, pastRehearsalId]) {
    for (const uid of [testData.adminId, removedUser()]) {
      testDb.run(
        `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response) VALUES (?, ?, 'no')`,
        [id, uid]
      );
    }
    // The busy slot a rehearsal puts on each participant's availability.
    testDb.run(
      `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, source, external_event_id)
       VALUES (?, ?, ?, 'busy', 'rehearsal', ?)`,
      [removedUser(), '2026-12-01T17:00:00.000Z', '2026-12-01T19:00:00.000Z', String(id)]
    );
  }
});

const auth = (userId) => ['Authorization', `Bearer ${generateTokens(userId, 1).accessToken}`];

const remove = () =>
  request(app)
    .delete(`/api/native/projects/${testData.projectId}/members/${removedUser()}`)
    .set(...auth(testData.adminId));

const rosterRows = () =>
  testDb.all(`SELECT rehearsal_id FROM native_rehearsal_responses WHERE user_id = ?`, [removedUser()]);

describe('Removing a member', () => {
  it('succeeds', async () => {
    const res = await remove();
    expect(res.status).toBe(200);
  });

  it('takes them off the project rehearsals', async () => {
    await remove();

    expect(rosterRows()).toHaveLength(0);
  });

  it('is what stops the reminders and the edit notifications', async () => {
    // Both read their recipients from this table, so the roster rows are the
    // whole of it — there is no separate notification list to clean.
    await remove();

    const recipients = testDb.all(
      `SELECT user_id FROM native_rehearsal_responses WHERE rehearsal_id = ?`,
      [rehearsalId]
    );
    expect(recipients.map((r) => Number(r.user_id))).not.toContain(removedUser());
  });

  it('clears the busy slots those rehearsals put on their calendar', async () => {
    // Otherwise they read as unavailable to their other projects at times
    // nobody expects them any more.
    await remove();

    const slots = testDb.all(
      `SELECT id FROM native_user_availability WHERE user_id = ? AND source = 'rehearsal'`,
      [removedUser()]
    );
    expect(slots).toHaveLength(0);
  });

  it('leaves everyone else on the rehearsal', async () => {
    await remove();

    const left = testDb.all(`SELECT user_id FROM native_rehearsal_responses WHERE rehearsal_id = ?`, [
      rehearsalId,
    ]);
    expect(left.map((r) => Number(r.user_id))).toEqual([Number(testData.adminId)]);
  });

  it('does not reach into another project', async () => {
    const otherProject = Number(
      testDb.run(`INSERT INTO native_projects (name) VALUES (?)`, ['Другой проект']).lastInsertId
    );
    const otherRehearsal = Number(
      testDb.run(
        `INSERT INTO native_rehearsals (project_id, title, starts_at, ends_at) VALUES (?, ?, ?, ?)`,
        [otherProject, 'Чужой прогон', '2026-12-05T17:00:00.000Z', '2026-12-05T19:00:00.000Z']
      ).lastInsertId
    );
    testDb.run(
      `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response) VALUES (?, ?, 'yes')`,
      [otherRehearsal, removedUser()]
    );

    await remove();

    expect(rosterRows().map((r) => Number(r.rehearsal_id))).toEqual([otherRehearsal]);
  });
});

describe('What a removed member can still read', () => {
  const getById = (id, userId) =>
    request(app).get(`/api/native/rehearsals/${id}`).set(...auth(userId));

  it('nothing — the rehearsal they were on answers 404', async () => {
    // Their token is still valid and they still hold the id from an earlier
    // push, which is exactly how this was reachable.
    const before = await getById(rehearsalId, removedUser());
    expect(before.status).toBe(200);

    await remove();

    const after = await getById(rehearsalId, removedUser());
    expect(after.status).toBe(404);
  });

  it('and a stale roster row on its own is no longer enough', async () => {
    // The second lock. Even if a row survives by some other route, membership
    // is now checked first.
    await remove();
    testDb.run(
      `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response) VALUES (?, ?, 'no')`,
      [rehearsalId, removedUser()]
    );

    const res = await getById(rehearsalId, removedUser());

    expect(res.status).toBe(404);
  });

  it('while everyone still in the project reads it as before', async () => {
    await remove();

    const res = await getById(rehearsalId, testData.adminId);

    expect(res.status).toBe(200);
    expect(res.body.rehearsal.title).toBe('Прогон');
  });
});
