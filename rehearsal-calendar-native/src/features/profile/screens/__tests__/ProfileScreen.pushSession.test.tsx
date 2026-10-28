/**
 * Turning push on belongs to the session it was begun in (review 2 of cause
 * fix 20).
 *
 * Before: the profile waited for the prompt and the registration, then saved
 * the setting through whatever session was on by then, and the result was
 * written as this device's state whoever it was for. A slow answer and an
 * ordinary change of account turned the next person's notifications on, with
 * their own tokens. Only the session's background attempt checked that its
 * session was still on.
 *
 * The real AuthProvider, ProfileScreen and registration service; only the
 * system, the storage and the API are stood in for.
 */
import React from 'react';
import { AppState } from 'react-native';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '../../../../contexts/AuthContext';
import ProfileScreen from '../ProfileScreen';
import { resetSessionForTests } from '../../../../shared/services/session';
import { getPushDeviceState } from '../../../../shared/services/notifications';

const mockApi = {
  getMe: jest.fn(),
  login: jest.fn(),
  registerPushToken: jest.fn(),
  unregisterPushToken: jest.fn(() => Promise.resolve({ data: {} })),
  updateMe: jest.fn(),
  logout: jest.fn(() => Promise.resolve({ data: {} })),
};
jest.mock('../../../../shared/services/api', () => ({
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
jest.mock('../../../../shared/utils/storage', () => ({ syncUserPreferences: jest.fn(() => Promise.resolve()) }));
jest.mock('../../../../shared/utils/calendarMappings', () => ({ resetConnectionCache: jest.fn() }));
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../i18n/translations').translations.en, language: 'en', setLanguage: jest.fn() }),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, [effect]),
}));
jest.mock('../../../../shared/components', () => ({
  GlassButton: () => null,
  SkeletonLoader: () => null,
  UserAvatar: () => null,
}));
// The preset leaves Switch out; a view carries its props.
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  const React = require('react');
  return Object.assign(Object.create(RN), { Switch: (props: any) => React.createElement(RN.View, props) });
});
jest.mock('../../../../shared/components/AppModal', () => ({ AppModal: () => null }));

const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const ANNA = { id: 7, email: 'anna@example.com', firstName: 'Anna', createdAt: '2026-09-26T00:00:00Z', timezone: zone, notificationsEnabled: false };
const BORIS = { id: 8, email: 'boris@example.com', firstName: 'Boris', createdAt: '2026-09-26T00:00:00Z', timezone: zone, notificationsEnabled: false };

const getPermissions = Notifications.getPermissionsAsync as jest.Mock;
const requestPermissions = Notifications.requestPermissionsAsync as jest.Mock;

let auth: ReturnType<typeof useAuth>;
const navigation: any = { navigate: jest.fn() };
function App() {
  auth = useAuth();
  if (!auth.user) return null;
  return <ProfileScreen key={auth.user.id} navigation={navigation} route={{ key: 'p', name: 'ProfileMain' } as any} />;
}

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  Object.values(mockApi).forEach((fn) => fn.mockReset());
  mockApi.unregisterPushToken.mockResolvedValue({ data: {} });
  mockApi.logout.mockResolvedValue({ data: {} });
  mockApi.getMe.mockResolvedValue({ data: { user: ANNA } });
  mockApi.updateMe.mockImplementation((data: any) => Promise.resolve({ data: { user: { ...auth.user, ...data } } }));
  getPermissions.mockReset();
  requestPermissions.mockReset();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((() => ({ remove: () => {} })) as any);
  resetSessionForTests();
  mockStorage.accessToken = 'anna-access';
  mockStorage.refreshToken = 'anna-refresh';
});

it("a late answer to Anna's switch changes neither Boris's setting nor this device's state (review 2)", async () => {
  getPermissions.mockResolvedValue({ status: 'undetermined' });
  requestPermissions.mockImplementation(async () => {
    getPermissions.mockResolvedValue({ status: 'granted' });
    return { status: 'granted' };
  });
  const view = render(<AuthProvider><App /></AuthProvider>);
  await waitFor(() => expect(auth.user?.id).toBe(7), { timeout: 5000 });
  await act(async () => {});

  // Anna turns notifications on; her registration is slow to answer.
  let answerAnna!: (value: unknown) => void;
  mockApi.registerPushToken.mockImplementationOnce(() => new Promise((resolve) => { answerAnna = resolve; }));
  await act(async () => { fireEvent(view.getByTestId('profile-notifications'), 'valueChange', true); });
  await waitFor(() => expect(mockApi.registerPushToken).toHaveBeenCalledTimes(1));

  // She signs out, Boris signs in — his notifications off, and this phone's
  // token not reaching the server for him.
  mockApi.registerPushToken.mockRejectedValue(new Error('Network Error'));
  await act(async () => { await auth.logout(); });
  mockApi.login.mockResolvedValue({ data: { user: BORIS, accessToken: 'boris-access', refreshToken: 'boris-refresh' } });
  await act(async () => { await auth.login('boris@example.com', 'secret'); });
  await waitFor(() => expect(getPushDeviceState()).toBe('failed'));

  // Anna's answer comes now.
  await act(async () => { answerAnna({ data: {} }); });
  await act(async () => {});

  expect(mockApi.updateMe).not.toHaveBeenCalledWith({ notificationsEnabled: true });
  expect(auth.user).toMatchObject({ id: 8, notificationsEnabled: false });
  expect(getPushDeviceState()).toBe('failed');
});
