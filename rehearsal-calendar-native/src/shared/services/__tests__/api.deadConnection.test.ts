/**
 * A request after a change of network does not stay on a dead connection
 * (T-240).
 *
 * The owner's iPhone, TestFlight 1.0.0 (3), 09.11.2026: the phone went from
 * LTE to 5G after a sign-out, the Google sign-in went down the connection the
 * sign-out had used — dead, still in iOS's pool — and heard nothing for ten
 * seconds; the second try took the same connection and failed the same way,
 * with the network working. iOS does not send a POST again by itself.
 *
 * The transport here is that pool: one connection, dead, handed to every
 * request until the pool is flushed (the native `renew`), then a new one. A
 * request that got no answer flushes it, so the next try — the app's own for
 * a sign-in or a read, the person's for a change — goes down a new connection.
 */
const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (k: string) => Promise.resolve(mockStorage[k] ?? null),
  multiSet: () => Promise.resolve(),
}));

import { AxiosError } from 'axios';
import { NativeModules, Platform } from 'react-native';
import api, { authAPI, bugReportsAPI, rehearsalsAPI } from '../api';
import { resetSessionForTests } from '../session';

/** iOS's connection pool, as NSURLSession keeps it for React Native. */
let pooled: { id: number; dead: boolean } | null;
let opened: number;
let sent: { method: string; url: string; connection: number }[];
let failure: 'ECONNABORTED' | 'ERR_NETWORK';

const renew = jest.fn(async () => {
  pooled = null;
  return true;
});

function transport(config: any) {
  if (!pooled) pooled = { id: ++opened, dead: false };
  const connection = pooled;
  sent.push({ method: String(config.method).toUpperCase(), url: config.url, connection: connection.id });
  if (connection.dead) {
    const message = failure === 'ECONNABORTED' ? 'timeout of 10000ms exceeded' : 'Network Error';
    return Promise.reject(new AxiosError(message, failure, config, {}));
  }
  return Promise.resolve({ data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config, request: {} });
}

const originalAdapter = api.defaults.adapter;
beforeAll(() => {
  api.defaults.adapter = transport as any;
  (NativeModules as any).RehearslyConnections = { renew };
  Platform.OS = 'ios';
});
afterAll(() => {
  api.defaults.adapter = originalAdapter;
  delete (NativeModules as any).RehearslyConnections;
});

beforeEach(() => {
  resetSessionForTests();
  // The connection the sign-out used, left behind by the network.
  pooled = { id: 1, dead: true };
  opened = 1;
  sent = [];
  renew.mockClear();
});

describe.each(['ECONNABORTED', 'ERR_NETWORK'] as const)('no answer as %s', (code) => {
  beforeEach(() => {
    failure = code;
  });

  it('a Google sign-in that heard nothing is sent again, on a new connection, and goes through', async () => {
    await expect(authAPI.loginWithGoogle('id-token')).resolves.toMatchObject({ status: 200 });
    expect(sent).toEqual([
      { method: 'POST', url: '/auth/google', connection: 1 },
      { method: 'POST', url: '/auth/google', connection: 2 },
    ]);
    expect(renew).toHaveBeenCalledTimes(1);
  });

  it('so are a sign-in with a password, with Apple, and a read', async () => {
    await expect(authAPI.login('a@b.c', 'secret')).resolves.toMatchObject({ status: 200 });
    pooled = { id: ++opened, dead: true };
    await expect(authAPI.loginWithApple('id-token')).resolves.toMatchObject({ status: 200 });
    pooled = { id: ++opened, dead: true };
    await expect(rehearsalsAPI.getById('r1')).resolves.toMatchObject({ status: 200 });
    expect(sent.map((request) => request.connection)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('a change is not sent again by the app, and the next try goes down a new connection', async () => {
    await expect(bugReportsAPI.create({ message: 'broken' })).rejects.toMatchObject({ code });
    expect(sent).toEqual([{ method: 'POST', url: '/native/bug-reports', connection: 1 }]);
    expect(renew).toHaveBeenCalledTimes(1);

    // The person taps again.
    await expect(bugReportsAPI.create({ message: 'broken' })).resolves.toMatchObject({ status: 200 });
    expect(sent[1]).toEqual({ method: 'POST', url: '/native/bug-reports', connection: 2 });
  });

  it('a sign-in is sent again only once: no answer twice is the network', async () => {
    renew.mockImplementationOnce(async () => {
      pooled = { id: ++opened, dead: true };
      return true;
    });
    await expect(authAPI.loginWithGoogle('id-token')).rejects.toMatchObject({ code });
    expect(sent.map((request) => request.connection)).toEqual([1, 2]);

    // The repeat's connection failed too, and is flushed as well: the
    // person's next tap does not start on it.
    expect(renew).toHaveBeenCalledTimes(2);
    await expect(authAPI.loginWithGoogle('id-token')).resolves.toMatchObject({ status: 200 });
    expect(sent.map((request) => request.connection)).toEqual([1, 2, 3]);
  });
});

it('an answer, even a refusal, is not a dead connection: nothing is flushed or sent again', async () => {
  pooled = { id: 1, dead: false };
  api.defaults.adapter = ((config: any) => {
    sent.push({ method: 'POST', url: config.url, connection: 1 });
    return Promise.reject(new AxiosError('Request failed with status code 401', 'ERR_BAD_REQUEST', config, {},
      { status: 401, data: { error: 'Invalid email or password' }, statusText: '', headers: {}, config }));
  }) as any;
  try {
    await expect(authAPI.login('a@b.c', 'wrong')).rejects.toMatchObject({ response: { status: 401 } });
  } finally {
    api.defaults.adapter = transport as any;
  }
  expect(sent).toHaveLength(1);
  expect(renew).not.toHaveBeenCalled();
});
