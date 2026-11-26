/**
 * Deleting the account takes back what the export put in this phone's
 * calendar (T-409).
 *
 * The events «Гамлет: репетиция» stayed in the calendar for good: the mappings
 * that say which events are the app's are the server's, and DELETE /me took
 * them with the account, so nothing could find the events afterwards. Now the
 * deletion removes them first, as "Remove Exported Rehearsals" does (T-270):
 * Auto Sync off both ways, then the removal, then DELETE /me. The account is
 * deleted whatever the calendar does, and what stayed is counted, not made up.
 *
 * Through the real AuthProvider and the real calendar sync service; below it,
 * the calendar module and the server are stand-ins.
 */
import React from 'react';
import { Text } from 'react-native';
import { render, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../AuthContext';
import { resetSessionForTests } from '../../shared/services/session';

const order: string[] = [];

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

const mockCalendar = {
  checkCalendarPermissions: jest.fn(),
  removeAllExportedEvents: jest.fn(),
};
jest.mock('../../shared/services/calendar', () => ({
  checkCalendarPermissions: (...args: any[]) => mockCalendar.checkCalendarPermissions(...args),
  removeAllExportedEvents: (...args: any[]) => mockCalendar.removeAllExportedEvents(...args),
  importCalendarEventsToAvailability: jest.fn(),
  removeAllImportedSlots: jest.fn(),
  syncAllRehearsals: jest.fn(),
  syncRehearsalToCalendar: jest.fn(),
  unsyncRehearsal: jest.fn(),
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
jest.mock('../../shared/utils/calendarMappings', () => ({
  resetConnectionCache: jest.fn(),
  getAllMappings: jest.fn(),
}));

const USER = { id: 7, email: 'hamlet@example.com', firstName: 'Hamlet', createdAt: '2026-11-25T00:00:00Z',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
const SYNC_ON = {
  exportEnabled: true,
  exportCalendarId: 'cal-1',
  importEnabled: true,
  importCalendarIds: ['cal-1'],
  importInterval: 'always',
};
let auth: ReturnType<typeof useAuth>;

function Probe() {
  auth = useAuth();
  return <Text testID="user">{auth.user ? String(auth.user.id) : 'none'}</Text>;
}

async function signedIn() {
  const screen = render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(auth.loading).toBe(false));
  mockApi.login.mockResolvedValue({ data: { user: USER, accessToken: 'access', refreshToken: 'refresh' } });
  await act(async () => { await auth.login('hamlet@example.com', 'long-enough-1'); });
  // Auto Sync on, both ways, as after the export put the rehearsals in.
  mockStorage['calendar-sync-settings'] = JSON.stringify(SYNC_ON);
  return screen;
}

async function deleteAccount() {
  let result: any;
  await act(async () => { result = await auth.deleteAccount(); });
  return result;
}

/** What the removal found when it ran: the settings, and whether `loading` was up. */
let atRemoval: { settings: any; loading: boolean } | null;

beforeEach(() => {
  order.length = 0;
  atRemoval = null;
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  Object.values(mockApi).forEach((fn) => fn.mockReset());
  Object.values(mockApple).forEach((fn) => fn.mockReset());
  Object.values(mockCalendar).forEach((fn) => fn.mockReset());
  mockApi.logout.mockImplementation(() => Promise.resolve({ data: {} }));
  mockApi.updateMe.mockImplementation(() => Promise.resolve({ data: {} }));
  mockApi.getAuthProviders.mockResolvedValue({ data: { providers: [{ providerType: 'apple' }] } });
  mockApple.isAppleAuthAvailable.mockResolvedValue(true);
  mockApple.confirmAppleForDeletion.mockImplementation(async () => {
    order.push('apple');
    return 'apple-code';
  });
  mockApi.deleteMe.mockImplementation(async () => {
    order.push('DELETE /me');
    return { data: { deletedProjects: 0 } };
  });
  mockCalendar.checkCalendarPermissions.mockResolvedValue(true);
  mockCalendar.removeAllExportedEvents.mockImplementation(async () => {
    order.push('remove exported');
    atRemoval = { settings: JSON.parse(mockStorage['calendar-sync-settings']), loading: auth.loading };
    return { success: 3, failed: 0, errors: [] };
  });
  resetSessionForTests();
});

it('removes the exported events before DELETE /me, after Apple, and says nothing more when all went', async () => {
  const screen = await signedIn();

  const result = await deleteAccount();

  expect(order).toEqual(['apple', 'remove exported', 'DELETE /me']);
  expect(result).toEqual({ deletedProjects: 0, calendarEventsLeft: 0 });
  expect(screen.getByTestId('user').props.children).toBe('none');
  // Not under `loading`: the navigator would be swapped for a spinner (pitfall 9).
  expect(atRemoval?.loading).toBe(false);
});

it('turns Auto Sync off both ways before removing, as the switch does', async () => {
  await signedIn();

  await deleteAccount();

  expect(atRemoval?.settings).toMatchObject({
    exportEnabled: false,
    importEnabled: false,
    importCalendarIds: [],
    importInterval: 'manual',
  });
});

it('runs as the session of the person deleting', async () => {
  await signedIn();

  await deleteAccount();

  // The session's stamp is handed down, so the change of owner waits for it.
  const [, session] = mockCalendar.removeAllExportedEvents.mock.calls[0];
  expect(session).toEqual(expect.anything());
});

it('deletes the account when events would not go, and says how many stayed', async () => {
  const screen = await signedIn();
  mockCalendar.removeAllExportedEvents.mockImplementation(async () => {
    order.push('remove exported');
    return { success: 1, failed: 2, errors: ['Event a: read-only', 'Event b: read-only'] };
  });

  const result = await deleteAccount();

  expect(order).toEqual(['apple', 'remove exported', 'DELETE /me']);
  expect(result.calendarEventsLeft).toBe(2);
  expect(screen.getByTestId('user').props.children).toBe('none');
});

it('deletes the account when the removal fails outright, and does not claim all went', async () => {
  const screen = await signedIn();
  mockCalendar.removeAllExportedEvents.mockRejectedValue(
    new Error('Calendar mappings unavailable: server failed and nothing is cached')
  );

  const result = await deleteAccount();

  expect(mockApi.deleteMe).toHaveBeenCalledTimes(1);
  expect(result.calendarEventsLeft).toBeNull();
  expect(screen.getByTestId('user').props.children).toBe('none');
});

it('without calendar access deletes the account and counts what this phone recorded exporting', async () => {
  const screen = await signedIn();
  mockCalendar.checkCalendarPermissions.mockResolvedValue(false);
  mockStorage['calendar-export-mappings'] = JSON.stringify({
    '1': { eventId: 'e1', calendarId: 'cal-1' },
    '2': { eventId: 'e2', calendarId: 'cal-1' },
  });
  mockStorage['calendar-export-leftovers'] = JSON.stringify({ e0: { rehearsalId: '1' } });

  const result = await deleteAccount();

  expect(mockCalendar.removeAllExportedEvents).not.toHaveBeenCalled();
  expect(mockApi.deleteMe).toHaveBeenCalledTimes(1);
  expect(result.calendarEventsLeft).toBe(3);
  expect(screen.getByTestId('user').props.children).toBe('none');
});

it('puts Auto Sync back as it was when DELETE /me fails after the removal', async () => {
  const screen = await signedIn();
  mockApi.deleteMe.mockImplementation(async () => {
    order.push('DELETE /me');
    throw Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });
  });

  await act(async () => {
    await expect(auth.deleteAccount()).rejects.toBeTruthy();
  });

  expect(order).toEqual(['apple', 'remove exported', 'DELETE /me']);
  // The account lives on: its calendar is not left switched off without a
  // word; the next run puts the removed events back.
  expect(JSON.parse(mockStorage['calendar-sync-settings'])).toMatchObject(SYNC_ON);
  expect(screen.getByTestId('user').props.children).toBe('7');
});

it('without calendar access and nothing exported here, says nothing more', async () => {
  await signedIn();
  mockCalendar.checkCalendarPermissions.mockResolvedValue(false);

  const result = await deleteAccount();

  expect(mockApi.deleteMe).toHaveBeenCalledTimes(1);
  expect(result.calendarEventsLeft).toBe(0);
});
