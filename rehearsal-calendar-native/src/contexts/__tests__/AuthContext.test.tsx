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
  loginWithApple: jest.fn(),
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
const mockSyncPreferences = jest.fn((..._args: any[]) => Promise.resolve());
jest.mock('../../shared/utils/storage', () => ({ syncUserPreferences: (...args: any[]) => mockSyncPreferences(...args) }));
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
  mockSyncPreferences.mockReset();
  mockSyncPreferences.mockImplementation((..._args: any[]) => Promise.resolve());
  loadingSeen.length = 0;
});

// A request held open until the test decides how it ends.
function held<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}
const created = { data: { status: 'verification_required', email: 'new@example.com', delivery: 'sent' } };
const OTHER = { ...USER, id: 8, email: 'other@example.com' };

it('registers without a session, keeps the address for the code, and never raises loading', async () => {
  const screen = await renderAuth();
  mockApi.register.mockResolvedValue(created);
  let result: any;
  await act(async () => { result = await auth.register(' New@Example.com', 'long-enough-1', 'New', undefined, 'de'); });
  expect(result).toEqual({ email: 'new@example.com', delivery: 'sent' });
  expect(mockApi.register).toHaveBeenCalledWith(' New@Example.com', 'long-enough-1', 'New', undefined, expect.anything(), 'de');
  expect(screen.getByTestId('user').props.children).toBe('none');
  expect(mockStorage.accessToken).toBeUndefined();
  expect(auth.pendingEmail).toBe('new@example.com');
  expect(loadingSeen.every((value) => value === false)).toBe(true);
});

it('keeps the form mounted while registration waits: busy, never loading (review R3-27)', async () => {
  await renderAuth();
  const answer = held<any>();
  mockApi.register.mockReturnValue(answer.promise);
  let pending: Promise<any>;
  act(() => { pending = auth.register('new@example.com', 'long-enough-1', 'New'); });
  await waitFor(() => expect(auth.busy).toBe(true));
  expect(auth.loading).toBe(false);
  await act(async () => { answer.resolve(created); await pending; });
  expect(auth.busy).toBe(false);
  expect(auth.loading).toBe(false);
  expect(auth.pendingEmail).toBe('new@example.com');
});

it('signs nobody in when the confirmation answers after the person left (review R3-24)', async () => {
  const screen = await renderAuth();
  mockApi.register.mockResolvedValue(created);
  await act(async () => { await auth.register('new@example.com', 'long-enough-1', 'New'); });
  const answer = held<any>();
  mockApi.verifyEmail.mockReturnValue(answer.promise);
  let confirming: Promise<void>;
  act(() => { confirming = auth.confirmEmail('123456'); });
  act(() => { auth.forgetPendingSignIn(); });
  await act(async () => { answer.resolve({ data: { user: USER, accessToken: 'late', refreshToken: 'late' } }); await confirming; });
  expect(screen.getByTestId('user').props.children).toBe('none');
  expect(auth.isAuthenticated).toBe(false);
  expect(mockStorage.accessToken).toBeUndefined();
});

it('does not let a late confirmation replace a newer sign-in (review R3-24)', async () => {
  const screen = await renderAuth();
  mockApi.register.mockResolvedValue(created);
  await act(async () => { await auth.register('new@example.com', 'long-enough-1', 'New'); });
  const answer = held<any>();
  mockApi.verifyEmail.mockReturnValue(answer.promise);
  let confirming: Promise<void>;
  act(() => { confirming = auth.confirmEmail('123456'); });
  act(() => { auth.forgetPendingSignIn(); });
  mockApi.loginWithApple.mockResolvedValue({ data: { user: OTHER, accessToken: 'apple', refreshToken: 'apple' } });
  await act(async () => { await auth.loginWithApple('apple-token'); });
  expect(screen.getByTestId('user').props.children).toBe('8');
  await act(async () => { answer.resolve({ data: { user: USER, accessToken: 'late', refreshToken: 'late' } }); await confirming; });
  expect(screen.getByTestId('user').props.children).toBe('8');
  expect(mockStorage.accessToken).toBe('apple');
});

it('takes back tokens written for an attempt that went stale meanwhile', async () => {
  const screen = await renderAuth();
  mockApi.register.mockResolvedValue(created);
  await act(async () => { await auth.register('new@example.com', 'long-enough-1', 'New'); });
  mockApi.verifyEmail.mockResolvedValue({ data: { user: USER, accessToken: 'late', refreshToken: 'late' } });
  const syncing = held<void>();
  mockSyncPreferences.mockReturnValueOnce(syncing.promise);
  let confirming: Promise<void>;
  act(() => { confirming = auth.confirmEmail('123456'); });
  await waitFor(() => expect(mockStorage.accessToken).toBe('late'));
  act(() => { auth.forgetPendingSignIn(); });
  await act(async () => { syncing.resolve(); await confirming; });
  expect(screen.getByTestId('user').props.children).toBe('none');
  expect(mockStorage.accessToken).toBeUndefined();
});

it('opens nothing for a registration answered after the form was left (review R3-24)', async () => {
  await renderAuth();
  const answer = held<any>();
  mockApi.register.mockReturnValue(answer.promise);
  let pending: Promise<any>;
  act(() => { pending = auth.register('new@example.com', 'long-enough-1', 'New'); });
  act(() => { auth.forgetPendingSignIn(); });
  let result: any = 'unset';
  await act(async () => { answer.resolve(created); result = await pending; });
  expect(result).toBeNull();
  expect(auth.pendingEmail).toBeNull();
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
