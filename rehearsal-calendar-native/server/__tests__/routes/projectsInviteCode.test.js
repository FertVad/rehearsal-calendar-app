/**
 * The projects list carries the invite code so the list can offer it without
 * a request per card. That makes who sees it a question worth a test: the code
 * is a way into the project, and a plain member handing it out is not a thing
 * the project owner agreed to.
 */
import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

const mockDbAll = jest.fn();
const mockDbGet = jest.fn();
const mockDbRun = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
  default: { all: mockDbAll, get: mockDbGet, run: mockDbRun },
  isPostgres: false,
}));

jest.unstable_mockModule('../../middleware/jwtMiddleware.js', () => ({
  requireAuth: (req, _res, next) => {
    req.userId = 1;
    next();
  },
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const projectsRoutes = (await import('../../routes/native/projects.js')).default;

function appWith(rows) {
  mockDbAll.mockResolvedValue(rows);
  const app = express();
  app.use(express.json());
  app.use('/projects', projectsRoutes);
  return app;
}

const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

const row = (over = {}) => ({
  id: 7,
  name: 'Hamlet',
  description: '',
  timezone: 'Asia/Jerusalem',
  is_admin: true,
  invite_code: 'K7M3XQ2P',
  invite_expires_at: tomorrow,
  created_at: tomorrow,
  updated_at: tomorrow,
  ...over,
});

describe('GET /projects — who gets the invite code', () => {
  beforeEach(() => jest.clearAllMocks());

  it('gives an admin the live code', async () => {
    const res = await request(appWith([row()])).get('/projects');

    expect(res.status).toBe(200);
    expect(res.body.projects[0].inviteCode).toBe('K7M3XQ2P');
  });

  it('withholds it from a plain member', async () => {
    const res = await request(appWith([row({ is_admin: false })])).get('/projects');

    expect(res.body.projects[0].inviteCode).toBeNull();
  });

  it('withholds one that has expired', async () => {
    const res = await request(appWith([row({ invite_expires_at: yesterday })])).get('/projects');

    expect(res.body.projects[0].inviteCode).toBeNull();
  });

  it('copes with a project that has never had an invite', async () => {
    const res = await request(
      appWith([row({ invite_code: null, invite_expires_at: null })])
    ).get('/projects');

    expect(res.body.projects[0].inviteCode).toBeNull();
  });
});
