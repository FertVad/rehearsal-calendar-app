/**
 * Deleting an account that signs in with Apple asks Apple first (T-279).
 *
 * The server revokes Sign in with Apple when the account goes (App Review
 * 5.1.1(v)) and keeps no Apple token to do it with, so the app asks Apple for
 * a fresh confirmation and sends its authorization code with DELETE /me. An
 * account without Apple is deleted as before, and the account goes even when
 * the person closes Apple's sheet or Apple fails.
 *
 * Apple's sheet comes before `loading`: while that is up the navigator swaps
 * the screens for a spinner.
 */
import React from 'react';
import { Text } from 'react-native';
import { render, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../AuthContext';
import { resetSessionForTests } from '../../shared/services/session';

const mockApi = {
  getMe: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(() => Promise.resolve({ data: {} })),
  updateMe: jest.fn(() => Promise.resolve({ data: {} })),
  getAuthProviders: jest.fn(),
  deleteMe: jest.fn(),
};
jest.mock('../../shared/services/api', () => ({
  authAPI: new Proxy({}, { get: (_target, key: string) => (...args: any[]) => (mockApi as any)[key](...args) }),
}));

const mockApple = {
  isAppleAuthAvailable: jest.fn(),
  confirmAppleForDeletion: jest.fn(),
};
jest.mock('../../shared/services/appleAuth', () => ({
  isAppleAuthAvailable: (...args: any[]) => mockApple.isAppleAuthAvailable(...args),
  confirmAppleForDeletion: (...args: any[]) => mockApple.confirmAppleForDeletion(...args),
}));

const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => { mockStorage[key] = value; return Promise.resolve(); },
  removeItem: (key: string) => { delete mockStorage[key]; return Promise.resolve(); },
  multiSet: (pairs: [string, string][]) => { for (const [k, v] of pairs) mockStorage[k] = v; return Promise.resolve(); },
  multiRemove: (keys: string[]) => { keys.forEach((k) => delete mockStorage[k]); return Promise.resolve(); },
  clear: () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); return Promise.resolve(); },
}));
jest.mock('../../shared/utils/storage', () => ({ syncUserPreferences: jest.fn(() => Promise.resolve()) }));
jest.mock('../../shared/services/notifications', () => ({
  unregisterPushToken: jest.fn(() => Promise.resolve()),
  keepPushRegistered: jest.fn(() => () => undefined),
}));
jest.mock('../../shared/utils/calendarMappings', () => ({ resetConnectionCache: jest.fn() }));

const USER = { id: 7, email: 'apple@example.com', firstName: 'Apple', createdAt: '2026-11-19T00:00:00Z',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
const CODE = 'apple-authorization-code';
const providers = (...types: string[]) => ({ data: { providers: types.map((providerType) => ({ providerType })) } });
let auth: ReturnType<typeof useAuth>;

function Probe() {
  auth = useAuth();
  return <Text testID="user">{auth.user ? String(auth.user.id) : 'none'}</Text>;
}

async function signedIn() {
  const screen = render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(auth.loading).toBe(false));
  mockApi.login.mockResolvedValue({ data: { user: USER, accessToken: 'access', refreshToken: 'refresh' } });
  await act(async () => { await auth.login('apple@example.com', 'long-enough-1'); });
  return screen;
}

async function deleteAccount() {
  let result: any;
  await act(async () => { result = await auth.deleteAccount(); });
  return result;
}

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  Object.values(mockApi).forEach((fn) => fn.mockReset());
  Object.values(mockApple).forEach((fn) => fn.mockReset());
  mockApi.logout.mockImplementation(() => Promise.resolve({ data: {} }));
  mockApi.updateMe.mockImplementation(() => Promise.resolve({ data: {} }));
  mockApi.deleteMe.mockResolvedValue({ data: { deletedProjects: 0 } });
  mockApple.isAppleAuthAvailable.mockResolvedValue(true);
  resetSessionForTests();
});

it('asks Apple to confirm first and sends its authorization code with the deletion', async () => {
  const screen = await signedIn();
  mockApi.getAuthProviders.mockResolvedValue(providers('email', 'apple'));
  let loadingDuringApple: boolean | undefined;
  mockApple.confirmAppleForDeletion.mockImplementation(async () => {
    loadingDuringApple = auth.loading;
    expect(mockApi.deleteMe).not.toHaveBeenCalled();
    return CODE;
  });

  await deleteAccount();

  expect(mockApple.confirmAppleForDeletion).toHaveBeenCalledTimes(1);
  expect(loadingDuringApple).toBe(false);
  expect(mockApi.deleteMe).toHaveBeenCalledWith(CODE);
  expect(screen.getByTestId('user').props.children).toBe('none');
});

it('an account without Apple is deleted as before, with no Apple sheet and no code', async () => {
  await signedIn();
  mockApi.getAuthProviders.mockResolvedValue(providers('email', 'google'));

  await deleteAccount();

  expect(mockApple.confirmAppleForDeletion).not.toHaveBeenCalled();
  expect(mockApi.deleteMe).toHaveBeenCalledTimes(1);
  expect(mockApi.deleteMe.mock.calls[0][0]).toBeUndefined();
});

it.each([
  ['the person closes Apple’s sheet', () => mockApple.confirmAppleForDeletion.mockResolvedValue(null)],
  ['Apple fails', () => mockApple.confirmAppleForDeletion.mockRejectedValue(new Error('Apple failed'))],
  ['Apple is not available on the device', () => mockApple.isAppleAuthAvailable.mockResolvedValue(false)],
  ['the providers cannot be read', () => mockApi.getAuthProviders.mockRejectedValue(new Error('offline'))],
])('deletes the account without a code when %s', async (_label, arrange) => {
  const screen = await signedIn();
  mockApi.getAuthProviders.mockResolvedValue(providers('apple'));
  mockApple.confirmAppleForDeletion.mockResolvedValue(CODE);
  arrange();

  await deleteAccount();

  expect(mockApi.deleteMe).toHaveBeenCalledTimes(1);
  expect(mockApi.deleteMe.mock.calls[0][0]).toBeUndefined();
  expect(screen.getByTestId('user').props.children).toBe('none');
});
