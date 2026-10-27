/**
 * A session keeps this device registered for push (cause fix 20, GC03).
 *
 * Before: it registered once per session and gave up on any failure, so a
 * start on a bad connection left the phone without notifications for the
 * whole session, silently, though everything else came back with the network.
 * Now a failed attempt is made again when the app comes forward, and stops
 * once the token is on the server.
 */
import React from 'react';
import { AppState, Text } from 'react-native';
import { render, act } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '../AuthContext';
import { resetSessionForTests } from '../../shared/services/session';
import { getPushDeviceState, subscribePushDeviceState, type PushDeviceState } from '../../shared/services/notifications';

const mockApi = {
  getMe: jest.fn(),
  registerPushToken: jest.fn(),
  unregisterPushToken: jest.fn(() => Promise.resolve({ data: {} })),
  updateMe: jest.fn(() => Promise.resolve({ data: {} })),
  logout: jest.fn(() => Promise.resolve({ data: {} })),
};
jest.mock('../../shared/services/api', () => ({
  authAPI: new Proxy({}, { get: (_target, key: string) => (...args: any[]) => (mockApi as any)[key](...args) }),
}));
const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => { mockStorage[key] = value; return Promise.resolve(); },
  removeItem: (key: string) => { delete mockStorage[key]; return Promise.resolve(); },
  multiSet: (pairs: [string, string][]) => { for (const [k, v] of pairs) mockStorage[k] = v; return Promise.resolve(); },
  multiRemove: (keys: string[]) => { keys.forEach((k) => delete mockStorage[k]); return Promise.resolve(); },
}));
jest.mock('../../shared/utils/storage', () => ({ syncUserPreferences: jest.fn(() => Promise.resolve()) }));
jest.mock('../../shared/utils/calendarMappings', () => ({ resetConnectionCache: jest.fn() }));

const USER = { id: 7, email: 'anna@example.com', firstName: 'Anna', createdAt: '2026-09-26T00:00:00Z',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, notificationsEnabled: true };
let auth: ReturnType<typeof useAuth>;
function Probe() {
  auth = useAuth();
  return <Text>{auth.user ? String(auth.user.id) : 'none'}</Text>;
}

// The app's foreground listeners, so the test can bring it forward.
let appStateHandlers: ((state: string) => void)[] = [];
const comeForward = async () => {
  await act(async () => { appStateHandlers.forEach((handler) => handler('active')); });
};

// The attempt itself, not a time: settles once a registration has come to
// `state`. `waitFor` gave the whole sign-in and registration its one second,
// and under the full suite's load the chain did not fit in it (27.10.2026).
// Taken before the attempt is started, so its end cannot be missed. React
// runs what the chain schedules only between turns of `act`, so it is given
// turns until the attempt has ended — as many as it takes, however slow. Each
// turn lets timers run too: an attempt that never ends fails on Jest's own
// timeout instead of holding the event loop.
const comesTo = (state: PushDeviceState) => {
  const attempt = { ended: false };
  const stop = subscribePushDeviceState(() => {
    if (getPushDeviceState() !== state) return;
    stop();
    attempt.ended = true;
  });
  return attempt;
};
const settled = async (attempt: { ended: boolean }) => {
  while (!attempt.ended) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  }
};

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  Object.values(mockApi).forEach((fn) => fn.mockReset());
  mockApi.getMe.mockResolvedValue({ data: { user: USER } });
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
  (Notifications.requestPermissionsAsync as jest.Mock).mockReset();
  appStateHandlers = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, handler: any) => {
    appStateHandlers.push(handler);
    return { remove: () => { appStateHandlers = appStateHandlers.filter((h) => h !== handler); } };
  }) as any);
  resetSessionForTests();
  mockStorage.accessToken = 'access';
  mockStorage.refreshToken = 'refresh';
});

it('registers again when the app comes forward after a failed start, and stops once it has (GC03)', async () => {
  mockApi.registerPushToken.mockRejectedValueOnce(new Error('Network Error')).mockResolvedValue({ data: {} });
  const failed = comesTo('failed');
  render(<AuthProvider><Probe /></AuthProvider>);
  await settled(failed);
  expect(mockApi.registerPushToken).toHaveBeenCalledTimes(1);

  const registered = comesTo('registered');
  await comeForward();
  await settled(registered);
  expect(mockApi.registerPushToken).toHaveBeenCalledTimes(2);
  expect(mockStorage['@push_token']).toBe('mock-token');

  await comeForward();
  await act(async () => {});
  expect(mockApi.registerPushToken).toHaveBeenCalledTimes(2);
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});

it('registers once the permission is granted in Settings, never asking itself', async () => {
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
  mockApi.registerPushToken.mockResolvedValue({ data: {} });
  const denied = comesTo('denied');
  render(<AuthProvider><Probe /></AuthProvider>);
  await settled(denied);
  expect(mockApi.registerPushToken).not.toHaveBeenCalled();

  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
  const registered = comesTo('registered');
  await comeForward();
  await settled(registered);
  expect(mockApi.registerPushToken).toHaveBeenCalledTimes(1);
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});

it('a change to the user is the same session and registers nothing new', async () => {
  mockApi.registerPushToken.mockResolvedValue({ data: {} });
  mockApi.updateMe.mockResolvedValue({ data: { user: { ...USER, firstName: 'Anya' } } });
  const registered = comesTo('registered');
  render(<AuthProvider><Probe /></AuthProvider>);
  await settled(registered);
  expect(mockApi.registerPushToken).toHaveBeenCalledTimes(1);
  await act(async () => { await auth.updateUser({ firstName: 'Anya' }); });
  await act(async () => {});
  expect(mockApi.registerPushToken).toHaveBeenCalledTimes(1);
});
