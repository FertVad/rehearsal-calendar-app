/**
 * "Not allowed" re-reads the projects (T-229).
 *
 * The role the app goes by is the list of projects. An admin whose role was
 * taken away on another device still saw the admin's buttons, and every tap on
 * one was refused with 403 — the list was never read again, so the buttons
 * stayed until the app was restarted. A 403 to someone signed in now tells the
 * projects to reload.
 */
const mockStorage: Record<string, string> = { accessToken: 'access' };
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (k: string) => Promise.resolve(mockStorage[k] ?? null),
  multiSet: () => Promise.resolve(),
}));

const mockHandlers: { request?: (c: any) => Promise<any>; rejected?: (e: any) => Promise<any> } = {};
jest.mock('axios', () => {
  const instance: any = jest.fn();
  instance.interceptors = {
    request: { use: (fulfilled: any) => { mockHandlers.request = fulfilled; } },
    response: { use: (_ok: any, rejected: any) => { mockHandlers.rejected = rejected; } },
  };
  return { create: () => instance, post: jest.fn() };
});

import '../api';
import { resetSessionForTests } from '../session';
import { onDataChanged } from '../../utils/dataChanged';

async function refused(status: number, method: string, url: string, signedIn = true) {
  if (signedIn) mockStorage.accessToken = 'access';
  else delete mockStorage.accessToken;
  const config = await mockHandlers.request!({ headers: {}, url, method });
  return mockHandlers.rejected!({ config, response: { status } }).catch(() => undefined);
}

let reloads: jest.Mock;
let off: () => void;
beforeEach(() => {
  resetSessionForTests();
  reloads = jest.fn();
  off = onDataChanged('projects', reloads);
});
afterEach(() => off());

it('reloads the projects when an admin action is refused with 403', async () => {
  await refused(403, 'post', '/native/rehearsals');
  expect(reloads).toHaveBeenCalledTimes(1);
});

it('does not for other refusals, nor without a session', async () => {
  await refused(400, 'post', '/native/rehearsals');
  await refused(404, 'get', '/native/projects/p1');
  await refused(403, 'post', '/auth/login', false);
  expect(reloads).not.toHaveBeenCalled();
});

it('does not when the list itself is refused, which would ask again and again', async () => {
  await refused(403, 'get', '/native/projects');
  expect(reloads).not.toHaveBeenCalled();
});
