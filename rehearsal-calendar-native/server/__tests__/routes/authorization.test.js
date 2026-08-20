/**
 * Route-level authorization tests
 *
 * The existing integration suite exercises SQL directly and never reaches
 * req/res, so a missing permission check is invisible to it — which is exactly
 * how the members-availability IDOR survived. These tests mount the real
 * routers behind the real requireAuth middleware and drive them over HTTP.
 *
 * Anything asserted here is a security property, not a behavioural detail.
 */
import { jest } from '@jest/globals';
import {
  setupIntegrationDb,
  closeIntegrationDb,
  seedTestData,
} from '../integration/setup.js';

let testDb;
let testData;
let app;
let request;
let generateTokens;

/** A user who exists but belongs to no project — the "outsider" in these tests. */
let outsiderId;

beforeAll(async () => {
  testDb = await setupIntegrationDb();
  testData = await seedTestData(testDb);

  const outsider = testDb.run(
    `INSERT INTO native_users (email, password_hash, first_name, last_name)
     VALUES (?, ?, ?, ?)`,
    ['outsider@test.com', 'hash789', 'Out', 'Sider']
  );
  outsiderId = outsider.lastInsertId;

  // The routers grab `db` at import time, so the mock has to be registered
  // before any of them are pulled in.
  jest.unstable_mockModule('../../database/db.js', () => ({
    default: testDb,
    isPostgres: false,
    initDatabase: async () => testDb,
    testConnection: async () => true,
  }));

  // Push notifications fan out on role changes and removals; irrelevant here
  // and they would try to reach Expo. Every notify* export has to be present
  // or the router fails to import.
  const noop = async () => ({ sent: 0, failed: 0, errors: [] });
  jest.unstable_mockModule('../../services/notifications/pushNotificationService.js', () => ({
    getUserPushTokens: async () => [],
    sendPushNotification: noop,
    notifyRehearsalCreated: noop,
    notifyRehearsalUpdated: noop,
    notifyRehearsalDeleted: noop,
    notifyMemberResponse: noop,
    notifyProjectInvite: noop,
    notifyRoleChanged: noop,
    notifyMemberRemoved: noop,
    notifyProjectDeleted: noop,
    notifyRehearsal24h: noop,
    notifyRehearsal1h: noop,
    notifyPaymentFailed: noop,
  }));

  const express = (await import('express')).default;
  request = (await import('supertest')).default;
  ({ generateTokens } = await import('../../middleware/jwtMiddleware.js'));

  const membersRouter = (await import('../../routes/native/members.js')).default;
  const projectsRouter = (await import('../../routes/native/projects.js')).default;

  app = express();
  app.use(express.json());
  app.use('/api/native/projects', projectsRouter);
  app.use('/api/native/projects', membersRouter);
});

afterAll(() => {
  closeIntegrationDb();
});

const tokenFor = (userId) => generateTokens(userId, 1).accessToken;
const auth = (userId) => ['Authorization', `Bearer ${tokenFor(userId)}`];

describe('Route authorization', () => {
  describe('Unauthenticated access', () => {
    it('rejects a request with no token', async () => {
      const res = await request(app).get(`/api/native/projects/${testData.projectId}/members`);
      expect(res.status).toBe(401);
    });

    it('rejects a malformed token', async () => {
      const res = await request(app)
        .get(`/api/native/projects/${testData.projectId}/members`)
        .set('Authorization', 'Bearer not-a-real-token');
      expect(res.status).toBe(401);
    });
  });

  describe('Non-members', () => {
    it('cannot read a project they do not belong to', async () => {
      const res = await request(app)
        .get(`/api/native/projects/${testData.projectId}`)
        .set(...auth(outsiderId));
      expect(res.status).toBe(403);
    });

    it('cannot read members availability', async () => {
      const res = await request(app)
        .get(`/api/native/projects/${testData.projectId}/members/availability?date=2026-01-01`)
        .set(...auth(outsiderId));
      expect(res.status).toBe(403);
    });

    it('cannot promote anyone', async () => {
      const res = await request(app)
        .put(`/api/native/projects/${testData.projectId}/members/${testData.memberId}/role`)
        .set(...auth(outsiderId))
        .send({ role: 'admin' });
      expect(res.status).toBe(403);
    });
  });

  describe('Members without admin rights', () => {
    it('cannot change another member\'s role', async () => {
      const res = await request(app)
        .put(`/api/native/projects/${testData.projectId}/members/${testData.adminId}/role`)
        .set(...auth(testData.memberId))
        .send({ role: 'member' });
      expect(res.status).toBe(403);
    });

    it('cannot promote themselves', async () => {
      const res = await request(app)
        .put(`/api/native/projects/${testData.projectId}/members/${testData.memberId}/role`)
        .set(...auth(testData.memberId))
        .send({ role: 'admin' });
      expect(res.status).toBe(403);

      const membership = testDb.get(
        'SELECT role FROM native_project_members WHERE project_id = ? AND user_id = ?',
        [testData.projectId, testData.memberId]
      );
      expect(membership.role).toBe('member');
    });

    it('cannot remove another member', async () => {
      const res = await request(app)
        .delete(`/api/native/projects/${testData.projectId}/members/${testData.adminId}`)
        .set(...auth(testData.memberId));
      expect(res.status).toBe(403);
    });
  });

  describe('Owner protection', () => {
    it('refuses to remove the owner', async () => {
      const res = await request(app)
        .delete(`/api/native/projects/${testData.projectId}/members/${testData.adminId}`)
        .set(...auth(testData.adminId));
      expect(res.status).toBe(403);
    });

    it('refuses to change the owner\'s role', async () => {
      const res = await request(app)
        .put(`/api/native/projects/${testData.projectId}/members/${testData.adminId}/role`)
        .set(...auth(testData.adminId))
        .send({ role: 'member' });
      expect(res.status).toBe(403);
    });
  });

  /**
   * Regression guard for the IDOR fixed in d8b6660: ?userIds= used to be passed
   * straight through, letting any project member read any account's email and
   * schedule by guessing IDs.
   */
  describe('Members availability does not leak outsiders', () => {
    beforeAll(() => {
      testDb.run(
        `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, source)
         VALUES (?, ?, ?, ?, ?)`,
        [outsiderId, '2026-01-01T09:00:00.000Z', '2026-01-01T17:00:00.000Z', 'busy', 'manual']
      );
    });

    it('ignores a userIds entry for someone outside the project', async () => {
      const res = await request(app)
        .get(
          `/api/native/projects/${testData.projectId}/members/availability` +
            `?date=2026-01-01&userIds=${outsiderId}`
        )
        .set(...auth(testData.memberId));

      expect(res.status).toBe(200);
      const returnedIds = res.body.availability.map((entry) => String(entry.userId));
      expect(returnedIds).not.toContain(String(outsiderId));
    });

    it('does not expose the outsider\'s email even when mixed with valid ids', async () => {
      const res = await request(app)
        .get(
          `/api/native/projects/${testData.projectId}/members/availability` +
            `?date=2026-01-01&userIds=${testData.memberId},${outsiderId}`
        )
        .set(...auth(testData.memberId));

      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toContain('outsider@test.com');
    });

    it('still returns a genuine project member', async () => {
      const res = await request(app)
        .get(
          `/api/native/projects/${testData.projectId}/members/availability` +
            `?date=2026-01-01&userIds=${testData.memberId}`
        )
        .set(...auth(testData.memberId));

      expect(res.status).toBe(200);
      const returnedIds = res.body.availability.map((entry) => String(entry.userId));
      expect(returnedIds).toContain(String(testData.memberId));
    });
  });
});
