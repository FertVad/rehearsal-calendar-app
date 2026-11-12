/**
 * "New administrator" carries its project, so a tap on it can open it (T-252).
 *
 * It was sent with the project's name alone: the push had nothing to open, and
 * the inbox row had no related_type/related_id, so a tap on the card only
 * marked it read — what T-023 fixed for "New member". Here a role is given
 * through the route, the server's own notice is sent, and the other admin's
 * inbox is read. Nobody has a device, so nothing goes to Expo.
 */
import { jest } from '@jest/globals';
import { setupIntegrationDb, closeIntegrationDb, seedTestData } from './setup.js';

let testDb;
let testData;
let app;
let request;
let generateTokens;
let secondAdminId;

beforeAll(async () => {
  testDb = await setupIntegrationDb();
  testData = await seedTestData(testDb);

  secondAdminId = Number(testDb.run(
    `INSERT INTO native_users (email, password_hash, first_name, locale) VALUES (?, ?, ?, ?)`,
    ['second-admin@test.com', 'hash', 'Second', 'en']
  ).lastInsertId);
  testDb.run(
    `INSERT INTO native_project_members (project_id, user_id, role, status) VALUES (?, ?, 'admin', 'active')`,
    [testData.projectId, secondAdminId]
  );

  jest.unstable_mockModule('../../database/db.js', () => ({
    default: testDb,
    isPostgres: false,
    initDatabase: async () => testDb,
    testConnection: async () => true,
  }));
  jest.unstable_mockModule('../../utils/logger.js', () => ({
    logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  }));

  const express = (await import('express')).default;
  request = (await import('supertest')).default;
  ({ generateTokens } = await import('../../middleware/jwtMiddleware.js'));
  const membersRouter = (await import('../../routes/native/members.js')).default;

  app = express();
  app.use(express.json());
  app.use('/api/native/projects', membersRouter);
});

afterAll(() => closeIntegrationDb());

const auth = (userId) => ['Authorization', `Bearer ${generateTokens(userId, 1).accessToken}`];

const inboxOf = (userId) => testDb.all(
  'SELECT type, title, body, data, related_type, related_id FROM native_notifications WHERE user_id = ? ORDER BY id DESC',
  [userId]
).map((row) => ({ ...row, data: JSON.parse(row.data) }));

it('the other admin\'s "New administrator" names the project, so the push and the card can open it', async () => {
  const res = await request(app)
    .put(`/api/native/projects/${testData.projectId}/members/${testData.memberId}/role`)
    .set(...auth(testData.adminId))
    .send({ role: 'admin' });
  expect(res.status).toBe(200);

  const [row] = inboxOf(secondAdminId);
  expect(row).toMatchObject({ type: 'admin_appointed', title: 'New administrator' });
  // What the push carries.
  expect(Number(row.data.projectId)).toBe(Number(testData.projectId));
  // What the inbox opens it by.
  expect(row.related_type).toBe('project');
  expect(Number(row.related_id)).toBe(Number(testData.projectId));
});
