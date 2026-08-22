/**
 * Looking up a calendar mapping that does not exist.
 *
 * This is the commonest request the sync makes — every rehearsal not yet
 * exported asks it — so absence has to read as an ordinary answer rather than
 * an error, or the logs fill with 404s and hide the real ones.
 */
import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

const mockDbGet = jest.fn();
const mockDbAll = jest.fn();
const mockDbRun = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
  default: { get: mockDbGet, all: mockDbAll, run: mockDbRun },
  isPostgres: false,
}));

jest.unstable_mockModule('../../middleware/jwtMiddleware.js', () => ({
  requireAuth: (req, _res, next) => { req.userId = 1; next(); },
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const calendarSyncRoutes = (await import('../../routes/native/calendarSync.js')).default;

function app() {
  const a = express();
  a.use(express.json());
  a.use('/calendar-sync', calendarSyncRoutes);
  return a;
}

describe('GET /calendar-sync/mappings/by-event/:type/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('answers 200 with null when nothing is mapped', async () => {
    mockDbGet.mockResolvedValue(undefined);

    const res = await request(app()).get('/calendar-sync/mappings/by-event/rehearsal/126');

    expect(res.status).toBe(200);
    expect(res.body.mapping).toBeNull();
  });

  it('returns the mapping when there is one', async () => {
    mockDbGet.mockResolvedValue({
      id: 3,
      external_event_id: 'E57AB294',
      device_calendar_id: 'BFC55EC9',
    });

    const res = await request(app()).get('/calendar-sync/mappings/by-event/rehearsal/126');

    expect(res.status).toBe(200);
    expect(res.body.mapping.external_event_id).toBe('E57AB294');
  });
});
