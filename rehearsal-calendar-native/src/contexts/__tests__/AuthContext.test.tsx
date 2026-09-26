/**
 * Registration and sign-in wait for the emailed code (R3).
 *
 * The server no longer gives a session on registration; the app keeps the
 * address and password in memory, opens the code screen, and starts the
 * session only when the code is confirmed. A sign-in to an unconfirmed
 * address answers EMAIL_NOT_VERIFIED and leads to the same place.
 *
 * `loading` must stay out of it: the navigator swaps everything for a spinner
 * while it is true, so a form toggling it was unmounted mid-request.
 */
import React from 'react';
import { Text } from 'react-native';
import { render, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../AuthContext';

const mockApi = {
  getMe: jest.fn(),
  register: jest.fn(),
  login: jest.fn(),
  verifyEmail: jest.fn(),
  resendVerification: jest.fn(),
  updateMe: jest.fn(() => Promise.resolve({ data: {} })),
};
jest.mock('../../shared/services/api', () => ({
  authAPI: new Proxy({}, { get: (_target, key: string) => (...args: any[]) => (mockApi as any)[key](...args) }),
}));

const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (key: string) => Promise.resolve(mockStorage[key] ?? null),
  setItem: (key: string, value: string) => { mockStorage[key] = value; return Promise.resolve(); },
  removeItem: (key: string) => { delete mockStorage[key]; return Promise.resolve(); },
  multiSet: (pairs: [string, string][]) => { pairs.forEach(([k, v]) => { mockStorage[k] = v; }); return Promise.resolve(); },
  multiRemove: (keys: string[]) => { keys.forEach((k) => delete mockStorage[k]); return Promise.resolve(); },
  clear: () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); return Promise.resolve(); },
}));
jest.mock('../../shared/utils/storage', () => ({ syncUserPreferences: jest.fn(() => Promise.resolve()) }));
jest.mock('../../shared/services/notifications', () => ({
  unregisterPushToken: jest.fn(() => Promise.resolve()),
  syncPushTokenIfGranted: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../shared/utils/calendarMappings', () => ({ resetConnectionCache: jest.fn() }));

// The device's own zone, so the provider's timezone auto-sync has nothing to do.
const USER = { id: 7, email: 'new@example.com', firstName: 'New', createdAt: '2026-09-26T00:00:00Z',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
let auth: ReturnType<typeof useAuth>;
const loadingSeen: boolean[] = [];

function Probe() {
  auth = useAuth();
  loadingSeen.push(auth.loading);
  return <Text testID="user">{auth.user ? String(auth.user.id) : 'none'}</Text>;
}

async function renderAuth() {
  const screen = render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(auth.loading).toBe(false));
  loadingSeen.length = 0;
  return screen;
}

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  Object.values(mockApi).forEach((fn) => fn.mockReset());
  mockApi.updateMe.mockImplementation(() => Promise.resolve({ data: {} }));
  loadingSeen.length = 0;
});

it('registers without a session, keeps the address for the code, and never raises loading', async () => {
  const screen = await renderAuth();
  mockApi.register.mockResolvedValue({ data: { status: 'verification_required', email: 'new@example.com', delivery: 'sent' } });
  let created: any;
  await act(async () => { created = await auth.register(' New@Example.com', 'long-enough-1', 'New', undefined, 'de'); });
  expect(created).toEqual({ email: 'new@example.com', delivery: 'sent' });
  expect(mockApi.register).toHaveBeenCalledWith(' New@Example.com', 'long-enough-1', 'New', undefined, expect.anything(), 'de');
  expect(screen.getByTestId('user').props.children).toBe('none');
  expect(mockStorage.accessToken).toBeUndefined();
  expect(auth.pendingEmail).toBe('new@example.com');
  expect(loadingSeen.every((value) => value === false)).toBe(true);
});

it('confirms the code with the remembered credentials and starts the session', async () => {
  const screen = await renderAuth();
  mockApi.register.mockResolvedValue({ data: { status: 'verification_required', email: 'new@example.com', delivery: 'sent' } });
  mockApi.verifyEmail.mockResolvedValue({ data: { user: USER, accessToken: 'access', refreshToken: 'refresh' } });
  await act(async () => { await auth.register('new@example.com', 'long-enough-1', 'New'); });
  await act(async () => { await auth.confirmEmail('123456'); });
  expect(mockApi.verifyEmail).toHaveBeenCalledWith('new@example.com', 'long-enough-1', '123456');
  expect(mockStorage.accessToken).toBe('access');
  expect(mockStorage.refreshToken).toBe('refresh');
  expect(screen.getByTestId('user').props.children).toBe('7');
  expect(auth.pendingEmail).toBeNull();
});

it('turns a sign-in to an unconfirmed address into the code screen', async () => {
  await renderAuth();
  mockApi.login.mockRejectedValue({ response: { status: 403, data: {
    error: 'Confirm your email address first', code: 'EMAIL_NOT_VERIFIED', email: 'new@example.com' } } });
  mockApi.resendVerification.mockResolvedValue({ data: { status: 'code_sent', delivery: 'sent' } });
  let failure: any;
  await act(async () => { failure = await auth.login('NEW@example.com', 'long-enough-1').catch((error) => error); });
  expect(failure.code).toBe('EMAIL_NOT_VERIFIED');
  expect(auth.pendingEmail).toBe('new@example.com');
  expect(auth.error).toBeNull();
  let delivery: any;
  await act(async () => { delivery = await auth.resendConfirmation(); });
  expect(delivery).toBe('sent');
  expect(mockApi.resendVerification).toHaveBeenCalledWith('new@example.com', 'long-enough-1');
});

it('asks to sign in again when nothing waits for a code', async () => {
  await renderAuth();
  let failure: any;
  await act(async () => { failure = await auth.confirmEmail('123456').catch((error) => error); });
  expect(failure.code).toBe('SIGN_IN_AGAIN');
  expect(mockApi.verifyEmail).not.toHaveBeenCalled();
});

it('keeps the code screen on a wrong code, with the server code to show', async () => {
  await renderAuth();
  mockApi.register.mockResolvedValue({ data: { status: 'verification_required', email: 'new@example.com', delivery: 'sent' } });
  mockApi.verifyEmail.mockRejectedValue({ response: { status: 400, data: { error: 'The code is not valid', code: 'CODE_INVALID' } } });
  await act(async () => { await auth.register('new@example.com', 'long-enough-1', 'New'); });
  let failure: any;
  await act(async () => { failure = await auth.confirmEmail('000000').catch((error) => error); });
  expect(failure.code).toBe('CODE_INVALID');
  expect(auth.pendingEmail).toBe('new@example.com');
  expect(mockStorage.accessToken).toBeUndefined();
});
