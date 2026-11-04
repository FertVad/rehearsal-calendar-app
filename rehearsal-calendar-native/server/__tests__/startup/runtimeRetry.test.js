import { jest } from '@jest/globals';
import request from 'supertest';

// T-037: a failed first initialization (e.g. Neon still waking) must not keep
// the instance at 503 for its whole life. The clock is substituted; nothing
// here waits in real time.
let state = 'uninitialized';
let outcomes = [];
let arrivals = 0;
let openGate;
let gate;
// Each attempt is held until the test opens the gate, so concurrent requests
// can all arrive while it is in flight.
const initDatabase = jest.fn(async () => {
  await gate;
  const outcome = outcomes.shift();
  if (outcome === 'ok') { state = 'ready'; return {}; }
  state = 'unavailable';
  throw new Error('synthetic failure');
});
jest.unstable_mockModule('../../database/db.js', () => ({
  default: {}, isPostgres: false, initDatabase,
  getDatabaseStatus: () => { arrivals++; return { state }; },
  testConnection: jest.fn(async () => { if (state !== 'ready') throw new Error('unavailable'); }),
}));
jest.unstable_mockModule('../../utils/logger.js', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), log: jest.fn() },
}));

const { createRuntimeApp, initializationRetryDelayMs } = await import('../../runtime.js');
// The behaviour tests step the clock by the published pause; the upper bound
// of the allowed range stands in if a runtime does not publish one.
const pause = initializationRetryDelayMs ?? 30_000;

let clock;
const now = () => clock;

beforeEach(() => {
  state = 'uninitialized';
  outcomes = [];
  initDatabase.mockClear();
  clock = 1_000_000;
});

// Send `count` concurrent readiness requests; once all have reached the
// runtime, let any attempt in flight settle. Returns their responses.
async function readyWithAttempt(app, count = 1) {
  gate = new Promise(resolve => { openGate = resolve; });
  const start = arrivals;
  const responses = Array.from({ length: count }, () => request(app).get('/api/ready').then(r => r));
  for (let i = 0; i < 2000 && arrivals - start < count; i++) {
    await new Promise(resolve => setTimeout(resolve, 1));
  }
  openGate();
  return Promise.all(responses);
}

test('the pause is a bounded number of seconds', () => {
  expect(initializationRetryDelayMs).toBeGreaterThanOrEqual(10_000);
  expect(initializationRetryDelayMs).toBeLessThanOrEqual(30_000);
});

test('a failed attempt answers 503 within the pause and makes one new attempt after it', async () => {
  outcomes = ['fail', 'ok'];
  const app = createRuntimeApp({ now });

  const [first] = await readyWithAttempt(app);
  expect(first.status).toBe(503);
  expect(initDatabase).toHaveBeenCalledTimes(1);

  clock += pause - 1;
  for (let i = 0; i < 3; i++) {
    const within = await request(app).get('/api/ready');
    expect(within.status).toBe(503);
    expect(within.headers['cache-control']).toBe('no-store');
    expect((await request(app).get('/api/native/projects')).status).toBe(503);
  }
  expect(initDatabase).toHaveBeenCalledTimes(1);

  clock += 1;
  const [after] = await readyWithAttempt(app);
  expect(after.status).toBe(200);
  expect(after.body).toEqual({ status: 'ready' });
  expect(initDatabase).toHaveBeenCalledTimes(2);

  expect((await request(app).get('/api/ready')).status).toBe(200);
  expect(initDatabase).toHaveBeenCalledTimes(2);
});

test('concurrent requests after the pause share a single attempt', async () => {
  outcomes = ['fail', 'ok'];
  const app = createRuntimeApp({ now });
  await readyWithAttempt(app);
  expect(initDatabase).toHaveBeenCalledTimes(1);

  clock += pause;
  const responses = await readyWithAttempt(app, 5);
  expect(responses.map(r => r.status)).toEqual(Array(5).fill(200));
  expect(initDatabase).toHaveBeenCalledTimes(2);
});

test('a second failure starts a new pause counted from its end', async () => {
  outcomes = ['fail', 'fail', 'ok'];
  const app = createRuntimeApp({ now });
  await readyWithAttempt(app);

  clock += pause;
  const [second] = await readyWithAttempt(app);
  expect(second.status).toBe(503);
  expect(initDatabase).toHaveBeenCalledTimes(2);

  clock += pause - 1;
  expect((await request(app).get('/api/ready')).status).toBe(503);
  expect(initDatabase).toHaveBeenCalledTimes(2);

  clock += 1;
  const [third] = await readyWithAttempt(app);
  expect(third.status).toBe(200);
  expect(initDatabase).toHaveBeenCalledTimes(3);
});
