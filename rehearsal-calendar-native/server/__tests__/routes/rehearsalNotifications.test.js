/**
 * Who gets told about a rehearsal.
 *
 * The roster is native_rehearsal_responses — having a row there is what puts
 * you on a rehearsal, and the app only ever shows you rehearsals you have a row
 * for. Notifying the whole project therefore announced rehearsals that never
 * appeared in the recipient's calendar and could not be opened from the
 * notification either.
 *
 * These go over HTTP through the real router: the recipient list is assembled
 * in the handler, so a test that drives SQL would not see it.
 */
import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb, seedTestData } from '../integration/setup.js';

let testDb;
let testData;
let app;
let request;
let generateTokens;

/** In the project, never on a rehearsal. */
let bystanderId;

const created = jest.fn();
const updated = jest.fn();
const deleted = jest.fn();

beforeAll(async () => {
  testDb = await setupIntegrationDb();
  testData = await seedTestData(testDb);

  const bystander = testDb.run(
    `INSERT INTO native_users (email, password_hash, first_name) VALUES (?, ?, ?)`,
    ['bystander@test.com', 'hash', 'By']
  );
  bystanderId = Number(bystander.lastInsertId);
  testDb.run(
    `INSERT INTO native_project_members (project_id, user_id, role, status)
     VALUES (?, ?, 'member', 'active')`,
    [testData.projectId, bystanderId]
  );

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
    notifyRehearsalCreated: created,
    notifyRehearsalUpdated: updated,
    notifyRehearsalDeleted: deleted,
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

  const rehearsalsRouter = (await import('../../routes/native/rehearsals.js')).default;

  app = express();
  app.use(express.json());
  app.use('/api/native/projects', rehearsalsRouter);
  app.use('/api/native/rehearsals', rehearsalsRouter);
});

afterAll(() => closeIntegrationDb());

beforeEach(() => {
  testDb.run('DELETE FROM native_user_availability');
  testDb.run('DELETE FROM native_rehearsal_responses');
  testDb.run('DELETE FROM native_rehearsals');
  created.mockClear();
  updated.mockClear();
  deleted.mockClear();
});

const auth = (userId) => ['Authorization', `Bearer ${generateTokens(userId, 1).accessToken}`];

const soon = (hoursFromNow) => new Date(Date.now() + hoursFromNow * 3600_000).toISOString();

/** The user ids a notify* call was handed. */
const recipients = (mock) => mock.mock.calls[0][2].map((m) => Number(m.user_id));

const createRehearsal = (participant_ids) =>
  request(app)
    .post(`/api/native/projects/${testData.projectId}/rehearsals`)
    .set(...auth(testData.adminId))
    .send({
      title: 'Прогон',
      startsAt: soon(30),
      endsAt: soon(32),
      participant_ids,
    });

describe('Rehearsal notifications go to the roster', () => {
  it('tells the people put on a new rehearsal', async () => {
    const res = await createRehearsal([testData.memberId]);
    expect(res.status).toBe(201);

    expect(created).toHaveBeenCalledTimes(1);
    expect(recipients(created)).toContain(Number(testData.memberId));
  });

  it('does not tell the author about the rehearsal they just scheduled', async () => {
    // The filter for this existed but compared against undefined: the service
    // returned the rehearsal without created_by, so it excluded nobody and
    // whoever scheduled a call was notified of it.
    const res = await createRehearsal([testData.adminId, testData.memberId]);
    expect(res.status).toBe(201);

    expect(recipients(created)).not.toContain(Number(testData.adminId));
    expect(recipients(created)).toContain(Number(testData.memberId));
  });

  it('leaves out a project member who is not on it', async () => {
    const res = await createRehearsal([testData.memberId]);
    expect(res.status).toBe(201);

    expect(recipients(created)).not.toContain(bystanderId);
  });

  it('tells the roster when the rehearsal changes', async () => {
    const res = await createRehearsal([testData.memberId]);
    const rehearsalId = res.body.rehearsal.id;

    await request(app)
      .put(`/api/native/projects/${testData.projectId}/rehearsals/${rehearsalId}`)
      .set(...auth(testData.adminId))
      .send({ title: 'Прогон второго акта', startsAt: soon(31), endsAt: soon(33) });

    expect(updated).toHaveBeenCalledTimes(1);
    expect(recipients(updated)).toContain(Number(testData.memberId));
    expect(recipients(updated)).not.toContain(bystanderId);
  });

  it('tells the roster when the rehearsal is cancelled', async () => {
    const res = await createRehearsal([testData.memberId]);
    const rehearsalId = res.body.rehearsal.id;

    await request(app)
      .delete(`/api/native/projects/${testData.projectId}/rehearsals/${rehearsalId}`)
      .set(...auth(testData.adminId));

    // Read before the delete, or the rows are gone with the rehearsal and
    // nobody is told it was cancelled.
    expect(deleted).toHaveBeenCalledTimes(1);
    expect(recipients(deleted)).toContain(Number(testData.memberId));
    expect(recipients(deleted)).not.toContain(bystanderId);
  });
});

describe('The person making the change is not told about it', () => {
  /** Both the author and the member are on it, so only the filter can tell them apart. */
  const withBoth = () => createRehearsal([testData.adminId, testData.memberId]);

  it('leaves the editor out when a rehearsal is moved', async () => {
    const res = await withBoth();
    const rehearsalId = res.body.rehearsal.id;

    await request(app)
      .put(`/api/native/projects/${testData.projectId}/rehearsals/${rehearsalId}`)
      .set(...auth(testData.adminId))
      .send({ title: 'Прогон', startsAt: soon(40), endsAt: soon(42) });

    expect(recipients(updated)).not.toContain(Number(testData.adminId));
    expect(recipients(updated)).toContain(Number(testData.memberId));
  });

  it('leaves out whoever cancelled it', async () => {
    const res = await withBoth();
    const rehearsalId = res.body.rehearsal.id;

    await request(app)
      .delete(`/api/native/projects/${testData.projectId}/rehearsals/${rehearsalId}`)
      .set(...auth(testData.adminId));

    expect(recipients(deleted)).not.toContain(Number(testData.adminId));
    expect(recipients(deleted)).toContain(Number(testData.memberId));
  });

  it('says nothing at all when the editor is the only one on it', async () => {
    const res = await createRehearsal([testData.adminId]);
    const rehearsalId = res.body.rehearsal.id;

    const put = await request(app)
      .put(`/api/native/projects/${testData.projectId}/rehearsals/${rehearsalId}`)
      .set(...auth(testData.adminId))
      .send({ title: 'Прогон', startsAt: soon(40), endsAt: soon(42) });

    // Still a normal answer — an early return from inside the notification
    // block would leave the request hanging.
    expect(put.status).toBe(200);
    expect(updated).not.toHaveBeenCalled();
  });
});

describe('What the change announcement names', () => {
  /** The change keys handed to notifyRehearsalUpdated. */
  const changes = () => updated.mock.calls[0][3];

  // Fixed, not soon(30) recomputed per call — a few milliseconds apart is a
  // real change and the diff would rightly report one.
  const START = '2026-09-20T18:00:00.000Z';
  const END = '2026-09-20T20:00:00.000Z';

  const create = () =>
    request(app)
      .post(`/api/native/projects/${testData.projectId}/rehearsals`)
      .set(...auth(testData.adminId))
      .send({
        title: 'Прогон',
        location: 'Большая сцена',
        startsAt: START,
        endsAt: END,
        participant_ids: [testData.memberId],
      });

  /** The app posts the whole form on save, so every field always arrives. */
  const save = (rehearsalId, overrides) =>
    request(app)
      .put(`/api/native/projects/${testData.projectId}/rehearsals/${rehearsalId}`)
      .set(...auth(testData.adminId))
      .send({
        title: 'Прогон',
        location: 'Большая сцена',
        startsAt: START,
        endsAt: END,
        ...overrides,
      });

  it('names only the field that moved', async () => {
    // This used to be built from which keys the request carried. Since the form
    // sends all of them, every edit announced "date, place and name" — a
    // rehearsal moved by an hour claimed it had been renamed as well.
    const res = await create();

    await save(res.body.rehearsal.id, {
      startsAt: '2026-09-21T18:00:00.000Z',
      endsAt: '2026-09-21T20:00:00.000Z',
    });

    expect(changes()).toEqual(['datetime']);
  });

  it('names only the place when only the place changed', async () => {
    const res = await create();

    await save(res.body.rehearsal.id, { location: 'Малая сцена' });

    expect(changes()).toEqual(['location']);
  });

  it('names both when both changed', async () => {
    const res = await create();

    await save(res.body.rehearsal.id, { title: 'Сводный прогон', location: 'Малая сцена' });

    expect(changes()).toEqual(expect.arrayContaining(['title', 'location']));
    expect(changes()).not.toContain('datetime');
  });

  it('stays quiet when the form comes back unchanged', async () => {
    // Opening the editor and tapping Save is not news.
    const res = await create();

    const put = await save(res.body.rehearsal.id, {});

    expect(put.status).toBe(200);
    expect(updated).not.toHaveBeenCalled();
  });

  it('stays quiet when only the roster changed', async () => {
    // Whoever was added or removed sees it in their own list; the rest of the
    // cast does not need telling that the rehearsal itself is as it was.
    const res = await create();

    const put = await save(res.body.rehearsal.id, {
      participant_ids: [testData.memberId, bystanderId],
    });

    expect(put.status).toBe(200);
    expect(updated).not.toHaveBeenCalled();
  });
});
