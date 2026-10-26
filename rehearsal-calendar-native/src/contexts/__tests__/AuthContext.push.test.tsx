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
import { render, act, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '../AuthContext';
import { resetSessionForTests } from '../../shared/services/session';

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
  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(mockApi.registerPushToken).toHaveBeenCalledTimes(1));
  await act(async () => {});

  await comeForward();
  await waitFor(() => expect(mockApi.registerPushToken).toHaveBeenCalledTimes(2));
  expect(mockStorage['@push_token']).toBe('mock-token');

  await comeForward();
  await act(async () => {});
  expect(mockApi.registerPushToken).toHaveBeenCalledTimes(2);
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});

it('registers once the permission is granted in Settings, never asking itself', async () => {
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
  mockApi.registerPushToken.mockResolvedValue({ data: {} });
  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(auth.user?.id).toBe(7));
  await act(async () => {});
  expect(mockApi.registerPushToken).not.toHaveBeenCalled();

  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
  await comeForward();
  await waitFor(() => expect(mockApi.registerPushToken).toHaveBeenCalledTimes(1));
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});

it('a change to the user is the same session and registers nothing new', async () => {
  mockApi.registerPushToken.mockResolvedValue({ data: {} });
  mockApi.updateMe.mockResolvedValue({ data: { user: { ...USER, firstName: 'Anya' } } });
  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(mockApi.registerPushToken).toHaveBeenCalledTimes(1));
  await act(async () => { await auth.updateUser({ firstName: 'Anya' }); });
  await act(async () => {});
  expect(mockApi.registerPushToken).toHaveBeenCalledTimes(1);
});
