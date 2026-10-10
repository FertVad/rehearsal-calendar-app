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
  requestPasswordReset: jest.fn(),
  confirmPasswordReset: jest.fn(),
  requestEmailChange: jest.fn(),
  confirmEmailChange: jest.fn(),
};
jest.mock('../../shared/services/api', () => ({
  authAPI: new Proxy({}, { get: (_target, key: string) => (...args: any[]) => (mockApi as any)[key](...args) }),
}));

const mockStorage: Record<string, string> = {};
// A read the test holds until it decides: key → the promise the next read waits for.
const mockHeldReads: Record<string, Promise<void>> = {};
// A key whose write storage refuses, after writing the pairs before it.
const mockRefusedWrite: { key: string | null } = { key: null };
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async (key: string) => {
    const hold = mockHeldReads[key];
    if (hold) { delete mockHeldReads[key]; await hold; }
    return mockStorage[key] ?? null;
  },
  setItem: (key: string, value: string) => { mockStorage[key] = value; return Promise.resolve(); },
  removeItem: (key: string) => { delete mockStorage[key]; return Promise.resolve(); },
  multiSet: (pairs: [string, string][]) => {
    for (const [k, v] of pairs) {
      if (k === mockRefusedWrite.key) return Promise.reject(new Error('write refused'));
      mockStorage[k] = v;
    }
    return Promise.resolve();
  },
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
  Object.keys(mockHeldReads).forEach((k) => delete mockHeldReads[k]);
  mockRefusedWrite.key = null;
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

// A sign-in commits when its answer's turn to write comes. That is the last
// point where leaving cancels it; from there it runs to the end, and the
// credentials are written last (review R3-30, R3-31).
it('finishes a sign-in whose writing has begun, even if the person leaves meanwhile (review R3-31)', async () => {
  const screen = await renderAuth();
  mockApi.register.mockResolvedValue(created);
  await act(async () => { await auth.register('new@example.com', 'long-enough-1', 'New'); });
  mockApi.verifyEmail.mockResolvedValue({ data: { user: USER, accessToken: 'late', refreshToken: 'late' } });
  const syncing = held<void>();
  mockSyncPreferences.mockReturnValueOnce(syncing.promise);
  let confirming: Promise<void>;
  act(() => { confirming = auth.confirmEmail('123456'); });
  await waitFor(() => expect(mockSyncPreferences).toHaveBeenCalled());
  act(() => { auth.forgetPendingSignIn(); });
  await act(async () => { syncing.resolve(); await confirming; });
  expect(screen.getByTestId('user').props.children).toBe('7');
  expect(mockStorage.accessToken).toBe('late');
  expect(auth.pendingEmail).toBeNull();
});

it('writes no credentials when a step before them fails (review R3-30)', async () => {
  const screen = await renderAuth();
  mockApi.register.mockResolvedValue(created);
  await act(async () => { await auth.register('new@example.com', 'long-enough-1', 'New'); });
  mockApi.verifyEmail.mockResolvedValue({ data: { user: USER, accessToken: 'half', refreshToken: 'half' } });
  mockSyncPreferences.mockRejectedValueOnce(new Error('storage refused'));
  let failure: unknown;
  await act(async () => { await auth.confirmEmail('123456').catch((error) => { failure = error; }); });
  expect(failure).toBeDefined();
  expect(screen.getByTestId('user').props.children).toBe('none');
  expect(mockStorage.accessToken).toBeUndefined();
  expect(mockStorage.refreshToken).toBeUndefined();
  expect(mockStorage.cachedUser).toBeUndefined();
});

it('leaves no credentials behind when the person left and a step then failed (review R3-30)', async () => {
  const screen = await renderAuth();
  mockApi.register.mockResolvedValue(created);
  await act(async () => { await auth.register('new@example.com', 'long-enough-1', 'New'); });
  mockApi.verifyEmail.mockResolvedValue({ data: { user: USER, accessToken: 'cancelled', refreshToken: 'cancelled' } });
  const syncing = held<void>();
  mockSyncPreferences.mockReturnValueOnce(syncing.promise);
  let confirming: Promise<void>;
  act(() => { confirming = auth.confirmEmail('123456'); });
  await waitFor(() => expect(mockSyncPreferences).toHaveBeenCalled());
  act(() => { auth.forgetPendingSignIn(); });
  await act(async () => { syncing.reject(new Error('storage refused')); await confirming; });
  expect(screen.getByTestId('user').props.children).toBe('none');
  expect(mockStorage.accessToken).toBeUndefined();
  expect(mockStorage.refreshToken).toBeUndefined();
  expect(mockStorage.cachedUser).toBeUndefined();
});

it('takes back a credential write that storage refused part-way (review R3-30)', async () => {
  const screen = await renderAuth();
  mockApi.register.mockResolvedValue(created);
  await act(async () => { await auth.register('new@example.com', 'long-enough-1', 'New'); });
  mockApi.verifyEmail.mockResolvedValue({ data: { user: USER, accessToken: 'half', refreshToken: 'half' } });
  mockRefusedWrite.key = 'refreshToken';
  let failure: unknown;
  await act(async () => { await auth.confirmEmail('123456').catch((error) => { failure = error; }); });
  expect(failure).toBeDefined();
  expect(screen.getByTestId('user').props.children).toBe('none');
  expect(mockStorage.accessToken).toBeUndefined();
});

it('two sign-ins of the same account in a row leave it signed in with its tokens (review R3-29)', async () => {
  const screen = await renderAuth();
  mockApi.register.mockResolvedValue(created);
  await act(async () => { await auth.register('new@example.com', 'long-enough-1', 'New'); });
  // The server issues equal tokens to the same account within a second.
  mockApi.verifyEmail.mockResolvedValue({ data: { user: USER, accessToken: 'same', refreshToken: 'same' } });
  const syncing = held<void>();
  mockSyncPreferences.mockReturnValueOnce(syncing.promise);
  let first: Promise<void>;
  act(() => { first = auth.confirmEmail('123456'); });
  await waitFor(() => expect(mockSyncPreferences).toHaveBeenCalled());
  act(() => { auth.forgetPendingSignIn(); });
  mockApi.loginWithApple.mockResolvedValue({ data: { user: USER, accessToken: 'same', refreshToken: 'same' } });
  let second: Promise<any>;
  act(() => { second = auth.loginWithApple('apple-token'); });
  await act(async () => { syncing.resolve(); await first; await second; });
  expect(screen.getByTestId('user').props.children).toBe('7');
  expect(mockStorage.accessToken).toBe('same');
  expect(mockStorage.refreshToken).toBe('same');
});

it('an attempt left while it waits for its turn writes and wipes nothing (review R3-29, R3-31)', async () => {
  const screen = await renderAuth();
  Object.assign(mockStorage, { 'calendar-sync-owner': '8', 'calendar-export-mappings': 'mappings of 8', 'availability-cache': 'cache of 8' });
  mockApi.register.mockResolvedValue(created);
  await act(async () => { await auth.register('new@example.com', 'long-enough-1', 'New'); });
  // Account 8 signs in with Apple, and its writing is held part-way.
  mockApi.loginWithApple.mockResolvedValue({ data: { user: OTHER, accessToken: 'apple', refreshToken: 'apple' } });
  const syncing = held<void>();
  mockSyncPreferences.mockReturnValueOnce(syncing.promise);
  let apple: Promise<any>;
  act(() => { apple = auth.loginWithApple('apple-token'); });
  await waitFor(() => expect(mockSyncPreferences).toHaveBeenCalledTimes(1));
  // The confirmation for 7 is answered and waits behind it; then the person leaves.
  mockApi.verifyEmail.mockResolvedValue({ data: { user: USER, accessToken: 'late', refreshToken: 'late' } });
  let confirming: Promise<void>;
  act(() => { confirming = auth.confirmEmail('123456'); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  act(() => { auth.forgetPendingSignIn(); });
  await act(async () => { syncing.resolve(); await apple; await confirming; });
  expect(screen.getByTestId('user').props.children).toBe('8');
  expect(mockStorage.accessToken).toBe('apple');
  expect(mockStorage['calendar-sync-owner']).toBe('8');
  expect(mockStorage['calendar-export-mappings']).toBe('mappings of 8');
  expect(mockStorage['availability-cache']).toBe('cache of 8');
});

it('a newer sign-in starts writing only after the earlier one has finished (review R3-29)', async () => {
  const screen = await renderAuth();
  mockApi.register.mockResolvedValue(created);
  await act(async () => { await auth.register('new@example.com', 'long-enough-1', 'New'); });
  mockApi.verifyEmail.mockResolvedValue({ data: { user: USER, accessToken: 'late', refreshToken: 'late' } });
  const syncing = held<void>();
  mockSyncPreferences.mockReturnValueOnce(syncing.promise);
  let first: Promise<void>;
  act(() => { first = auth.confirmEmail('123456'); });
  await waitFor(() => expect(mockSyncPreferences).toHaveBeenCalled());
  mockApi.loginWithApple.mockResolvedValue({ data: { user: OTHER, accessToken: 'apple', refreshToken: 'apple' } });
  let second: Promise<any>;
  act(() => { second = auth.loginWithApple('apple-token'); });
  // The newer sign-in has its answer but waits: the device is still the first one's.
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  expect(mockStorage['calendar-sync-owner']).toBe('7');
  await act(async () => { syncing.resolve(); await first; await second; });
  expect(screen.getByTestId('user').props.children).toBe('8');
  expect(mockStorage.accessToken).toBe('apple');
  expect(mockStorage['calendar-sync-owner']).toBe('8');
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

// Password reset (R3): the request is the same for any address; a confirmed
// code is a sign-in, through the one session write.
it('asks for a reset code for the normalized address, without a session', async () => {
  const screen = await renderAuth();
  mockApi.requestPasswordReset.mockResolvedValue({ data: { status: 'reset_requested' } });
  let address: any;
  await act(async () => { address = await auth.requestPasswordReset(' Anna@Example.com '); });
  expect(address).toBe('anna@example.com');
  expect(mockApi.requestPasswordReset).toHaveBeenCalledWith('anna@example.com');
  expect(screen.getByTestId('user').props.children).toBe('none');
});

it('signs in with the pair a confirmed reset answers with', async () => {
  const screen = await renderAuth();
  mockApi.confirmPasswordReset.mockResolvedValue({ data: { user: USER, accessToken: 'access', refreshToken: 'refresh' } });
  await act(async () => { await auth.resetPassword('new@example.com', '123456', 'long-enough-1'); });
  expect(mockApi.confirmPasswordReset).toHaveBeenCalledWith('new@example.com', '123456', 'long-enough-1');
  expect(mockStorage.accessToken).toBe('access');
  expect(mockStorage.refreshToken).toBe('refresh');
  expect(screen.getByTestId('user').props.children).toBe('7');
});

it('signs nobody in when a reset answers after the person left (review R3-24)', async () => {
  const screen = await renderAuth();
  const answer = held<any>();
  mockApi.confirmPasswordReset.mockReturnValue(answer.promise);
  let resetting: Promise<void>;
  act(() => { resetting = auth.resetPassword('new@example.com', '123456', 'long-enough-1'); });
  act(() => { auth.forgetPendingSignIn(); });
  await act(async () => { answer.resolve({ data: { user: USER, accessToken: 'late', refreshToken: 'late' } }); await resetting; });
  expect(screen.getByTestId('user').props.children).toBe('none');
  expect(mockStorage.accessToken).toBeUndefined();
});

it('keeps a refused reset code with the server code to show', async () => {
  await renderAuth();
  mockApi.confirmPasswordReset.mockRejectedValue({ response: { status: 400, data: { error: 'The code is not valid', code: 'CODE_LOCKED' } } });
  let failure: any;
  await act(async () => { failure = await auth.resetPassword('new@example.com', '000000', 'long-enough-1').catch((error) => error); });
  expect(failure.code).toBe('CODE_LOCKED');
  expect(mockStorage.accessToken).toBeUndefined();
});

// Changing the address (R3: HP01): the server revokes every session, this
// one's too, and answers with the pair that works now.
async function signedIn() {
  const screen = await renderAuth();
  mockApi.login.mockResolvedValue({ data: { user: USER, accessToken: 'old-access', refreshToken: 'old-refresh' } });
  await act(async () => { await auth.login('new@example.com', 'long-enough-1'); });
  return screen;
}

it('asks for both codes and returns what happened to each email', async () => {
  await signedIn();
  mockApi.requestEmailChange.mockResolvedValue({ data: { status: 'codes_sent', delivery: { newAddress: 'sent', currentAddress: 'failed' } } });
  let delivery: any;
  await act(async () => { delivery = await auth.requestEmailChange(' Moved@Example.com', 'long-enough-1'); });
  expect(mockApi.requestEmailChange).toHaveBeenCalledWith('moved@example.com', 'long-enough-1');
  expect(delivery).toEqual({ newAddress: 'sent', currentAddress: 'failed' });
});

it('keeps the session with the new pair and the new address after a confirmed change', async () => {
  await signedIn();
  const moved = { ...USER, email: 'moved@example.com' };
  mockApi.confirmEmailChange.mockResolvedValue({ data: { user: moved, accessToken: 'new-access', refreshToken: 'new-refresh' } });
  await act(async () => { await auth.confirmEmailChange('222222', '111111'); });
  expect(mockApi.confirmEmailChange).toHaveBeenCalledWith('222222', '111111');
  expect(mockStorage.accessToken).toBe('new-access');
  expect(mockStorage.refreshToken).toBe('new-refresh');
  expect(JSON.parse(mockStorage.cachedUser).email).toBe('moved@example.com');
  expect(auth.user?.email).toBe('moved@example.com');
});

it('keeps the old pair and says which code was wrong when the change is refused', async () => {
  await signedIn();
  mockApi.confirmEmailChange.mockRejectedValue({ response: { status: 400, data: {
    error: 'The code is not valid', code: 'CODE_INVALID', field: 'currentCode' } } });
  let failure: any;
  await act(async () => { failure = await auth.confirmEmailChange('222222', '000000').catch((error) => error); });
  expect([failure.code, failure.details.field]).toEqual(['CODE_INVALID', 'currentCode']);
  expect(mockStorage.accessToken).toBe('old-access');
  expect(auth.user?.email).toBe('new@example.com');
});
