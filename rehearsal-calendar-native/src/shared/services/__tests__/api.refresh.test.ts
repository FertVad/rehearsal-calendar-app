/**
 * A refresh that fails (cause fix 12: AC01, AC02).
 *
 * The interceptor used to remove both tokens on any failed refresh: a moment
 * without network signed the person out at the next start, while the open app
 * went on showing them signed in with nothing to authenticate with (AC01). And
 * a refresh the server really refused — revoked from another device — removed
 * the tokens and told nobody, so the app stayed on screens whose every request
 * failed (AC02). Now only the server's refusal ends the session, and it is
 * reported; anything else keeps the tokens and fails as offline.
 */
const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (k: string) => Promise.resolve(mockStorage[k] ?? null),
  multiSet: (pairs: [string, string][]) => { pairs.forEach(([k, v]) => { mockStorage[k] = v; }); return Promise.resolve(); },
  multiRemove: (keys: string[]) => { keys.forEach((k) => delete mockStorage[k]); return Promise.resolve(); },
}));

// The instance the module creates: callable (a retry), with its interceptors kept.
const mockRetry = jest.fn((config: any) => Promise.resolve({ data: 'retried', config }));
const mockHandlers: { request?: (c: any) => Promise<any>; rejected?: (e: any) => Promise<any> } = {};
const mockRefresh = jest.fn();
jest.mock('axios', () => {
  const instance: any = (config: any) => mockRetry(config);
  instance.interceptors = {
    request: { use: (fulfilled: any) => { mockHandlers.request = fulfilled; } },
    response: { use: (_ok: any, rejected: any) => { mockHandlers.rejected = rejected; } },
  };
  return { create: () => instance, post: (...args: any[]) => mockRefresh(...args) };
});

import '../api';
import { onSessionExpired, changeOwner, resetSessionForTests } from '../session';

// A request as it goes out (through the request interceptor) and comes back 401.
async function refused401() {
  const config = await mockHandlers.request!({ headers: {}, url: '/native/projects', method: 'get' });
  return { config, response: { status: 401 } };
}
const offline = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });

let expired: jest.Mock;
beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  mockStorage.accessToken = 'old-access';
  mockStorage.refreshToken = 'refresh-1';
  mockRetry.mockClear();
  mockRefresh.mockReset();
  resetSessionForTests();
  expired = jest.fn();
  onSessionExpired(expired);
});

it('keeps the session when the refresh cannot reach the server (AC01)', async () => {
  mockRefresh.mockRejectedValue(offline());
  const error = await mockHandlers.rejected!(await refused401()).catch((e: any) => e);

  expect(error.code).toBe('ERR_NETWORK');
  expect(mockStorage.accessToken).toBe('old-access');
  expect(mockStorage.refreshToken).toBe('refresh-1');
  expect(expired).not.toHaveBeenCalled();
});

it('keeps the session when the server fails the refresh with its own error (AC01)', async () => {
  mockRefresh.mockRejectedValue({ response: { status: 503 } });
  await mockHandlers.rejected!(await refused401()).catch(() => undefined);

  expect(mockStorage.refreshToken).toBe('refresh-1');
  expect(expired).not.toHaveBeenCalled();
});

it('reports the session over when the server refuses the refresh token (AC02)', async () => {
  mockRefresh.mockRejectedValue({ response: { status: 401, data: { error: 'Session revoked' } } });
  await mockHandlers.rejected!(await refused401()).catch(() => undefined);

  expect(expired).toHaveBeenCalledTimes(1);
});

it('retries with the new pair after a refresh', async () => {
  mockRefresh.mockResolvedValue({ data: { accessToken: 'new-access', refreshToken: 'refresh-2' } });
  const answer = await mockHandlers.rejected!(await refused401());

  expect(answer.data).toBe('retried');
  expect(mockRetry.mock.calls[0][0].headers.Authorization).toBe('Bearer new-access');
  expect(mockStorage.refreshToken).toBe('refresh-2');
});

it('spends the refresh token once when two requests are refused together', async () => {
  let answer!: (value: unknown) => void;
  mockRefresh.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
  const first = mockHandlers.rejected!(await refused401());
  const second = mockHandlers.rejected!(await refused401());
  await new Promise((resolve) => setTimeout(resolve, 0));
  answer({ data: { accessToken: 'new-access', refreshToken: 'refresh-2' } });
  await Promise.all([first, second]);

  expect(mockRefresh).toHaveBeenCalledTimes(1);
});

it('does not refresh or retry a request of a session that has ended', async () => {
  const refused = await refused401();
  await changeOwner(2);
  const error = await mockHandlers.rejected!(refused).catch((e: any) => e);

  expect(error.name).toBe('SessionEndedError');
  expect(mockRefresh).not.toHaveBeenCalled();
  expect(mockRetry).not.toHaveBeenCalled();
});

it('leaves a refused password at sign-in alone: no session was sent', async () => {
  const error = await mockHandlers.rejected!({ config: { headers: {}, url: '/auth/login' }, response: { status: 401 } })
    .catch((e: any) => e);

  expect(error.response.status).toBe(401);
  expect(mockRefresh).not.toHaveBeenCalled();
});
