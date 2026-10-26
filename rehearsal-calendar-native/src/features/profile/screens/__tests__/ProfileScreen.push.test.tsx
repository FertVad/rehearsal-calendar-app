/**
 * The profile's notifications switch says what this phone will get (cause
 * fix 20).
 *
 * Before: turning it on saved the setting, ignored what registering came to,
 * and buzzed success — over a refused permission or a token the server never
 * got (GC02). And it showed the account's setting alone, on for every new
 * account, so after "Later" in onboarding it read on with nothing allowed
 * (GC01).
 *
 * Review: the first fix made the switch read off without the permission and
 * kept its own "can be notified", read from the permission on focus. A token
 * the server refused read as registered after a tab change; the setting could
 * not be turned off on a phone that had refused; an answer given in Settings
 * was not seen by the open profile. Now the switch is the account's setting
 * and what this phone came to is the session's one state, shown below it.
 */
import React from 'react';
import { Alert, AppState } from 'react-native';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import ProfileScreen from '../ProfileScreen';
import { translations } from '../../../../i18n/translations';
import { keepPushRegistered } from '../../../../shared/services/notifications';

const t = translations.en;
const mockAuth: any = {};
const mockRegisterPushToken = jest.fn();
jest.mock('../../../../shared/services/api', () => ({
  authAPI: {
    registerPushToken: (...args: any[]) => mockRegisterPushToken(...args),
    unregisterPushToken: jest.fn(() => Promise.resolve()),
  },
}));
jest.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => mockAuth }));
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

const getPermissions = Notifications.getPermissionsAsync as jest.Mock;
const requestPermissions = Notifications.requestPermissionsAsync as jest.Mock;

const navigation: any = { navigate: jest.fn() };
async function profile() {
  const view = render(<ProfileScreen navigation={navigation} route={{ key: 'p', name: 'ProfileMain' } as any} />);
  // The permission read on focus lands first, as it does long before a finger does.
  await act(async () => {});
  return view;
}
const theSwitch = (view: Awaited<ReturnType<typeof profile>>) => view.getByTestId('profile-notifications');
const notice = (view: Awaited<ReturnType<typeof profile>>) => view.queryByTestId('profile-notifications-device');

// The session keeps this device registered, as AuthContext does once signed in.
let appStateHandlers: ((state: string) => void)[] = [];
let stopSession: (() => void) | undefined;
async function signedIn() {
  stopSession = keepPushRegistered();
  await act(async () => {});
}
const comeForward = async () => {
  await act(async () => { appStateHandlers.forEach((handler) => handler('active')); });
};
afterEach(() => {
  stopSession?.();
  stopSession = undefined;
});

beforeEach(() => {
  (Alert.alert as jest.Mock).mockReset();
  getPermissions.mockReset();
  requestPermissions.mockReset();
  mockRegisterPushToken.mockReset();
  mockRegisterPushToken.mockResolvedValue({ data: {} });
  appStateHandlers = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, handler: any) => {
    appStateHandlers.push(handler);
    return { remove: () => { appStateHandlers = appStateHandlers.filter((h) => h !== handler); } };
  }) as any);
  Object.assign(mockAuth, {
    user: { id: 7, email: 'anna@example.com', firstName: 'Anna', notificationsEnabled: false },
    loading: false,
    updateUser: jest.fn(() => Promise.resolve()),
    logout: jest.fn(),
    deleteAccount: jest.fn(),
  });
});

it('says a refused permission, offers Settings, and saves nothing (GC02)', async () => {
  getPermissions.mockResolvedValue({ status: 'denied' });
  requestPermissions.mockResolvedValue({ status: 'denied' });
  const view = await profile();
  await act(async () => { fireEvent(theSwitch(view), 'valueChange', true); });

  expect(Alert.alert).toHaveBeenCalledWith(t.profile.pushDeniedTitle, t.profile.pushDeniedMessage, expect.arrayContaining([
    expect.objectContaining({ text: t.profile.openSettings }),
  ]));
  expect(mockAuth.updateUser).not.toHaveBeenCalled();
  expect(theSwitch(view).props.value).toBe(false);
});

it('says a token the server never got, and leaves the switch off (GC02)', async () => {
  getPermissions.mockResolvedValue({ status: 'granted' });
  mockRegisterPushToken.mockRejectedValue(new Error('Network Error'));
  const view = await profile();
  await act(async () => { fireEvent(theSwitch(view), 'valueChange', true); });

  expect(Alert.alert).toHaveBeenCalledWith(t.profile.errorTitle, t.profile.pushFailed);
  expect(mockAuth.updateUser).not.toHaveBeenCalled();
  expect(theSwitch(view).props.value).toBe(false);
});

it('saves the setting once the device is registered', async () => {
  getPermissions.mockResolvedValueOnce({ status: 'undetermined' }).mockResolvedValue({ status: 'undetermined' });
  requestPermissions.mockResolvedValue({ status: 'granted' });
  const view = await profile();
  await act(async () => { fireEvent(theSwitch(view), 'valueChange', true); });

  expect(requestPermissions).toHaveBeenCalledTimes(1);
  expect(mockRegisterPushToken).toHaveBeenCalledTimes(1);
  expect(mockAuth.updateUser).toHaveBeenCalledWith({ notificationsEnabled: true });
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(theSwitch(view).props.value).toBe(true);
});

it('says this phone is not allowed while the account setting is on, asking nothing (GC01)', async () => {
  mockAuth.user.notificationsEnabled = true;
  getPermissions.mockResolvedValue({ status: 'undetermined' });
  await signedIn();
  const view = await profile();
  expect(notice(view)).toHaveTextContent(t.profile.pushNotAllowedHere, { exact: false });
  expect(requestPermissions).not.toHaveBeenCalled();

  // Asked from the notice, once the person taps it.
  requestPermissions.mockResolvedValue({ status: 'granted' });
  await act(async () => { fireEvent.press(notice(view)!); });
  expect(requestPermissions).toHaveBeenCalledTimes(1);
  expect(mockRegisterPushToken).toHaveBeenCalledTimes(1);
  expect(notice(view)).toBeNull();
});

it('keeps saying a token the server refused after the profile is opened again (review 1)', async () => {
  mockAuth.user.notificationsEnabled = true;
  getPermissions.mockResolvedValue({ status: 'granted' });
  mockRegisterPushToken.mockRejectedValue(new Error('Internal Server Error'));
  await signedIn();
  const first = await profile();
  expect(notice(first)).toHaveTextContent(t.profile.pushNotRegisteredHere, { exact: false });
  first.unmount();

  // Another tab and back: the permission is granted, the token still is not on the server.
  const again = await profile();
  expect(notice(again)).toHaveTextContent(t.profile.pushNotRegisteredHere, { exact: false });
});

it('turns the account setting off on a phone that refused, without asking (review 2)', async () => {
  mockAuth.user.notificationsEnabled = true;
  getPermissions.mockResolvedValue({ status: 'denied' });
  await signedIn();
  const view = await profile();
  expect(theSwitch(view).props.value).toBe(true);

  await act(async () => { fireEvent(theSwitch(view), 'valueChange', false); });
  expect(mockAuth.updateUser).toHaveBeenCalledWith({ notificationsEnabled: false });
  expect(requestPermissions).not.toHaveBeenCalled();
  expect(theSwitch(view).props.value).toBe(false);
  expect(notice(view)).toBeNull();
});

it('sees an answer given in Settings when the app comes forward (review 3)', async () => {
  mockAuth.user.notificationsEnabled = true;
  getPermissions.mockResolvedValue({ status: 'denied' });
  await signedIn();
  const view = await profile();
  expect(notice(view)).toHaveTextContent(t.profile.pushNotAllowedHere, { exact: false });

  // Allowed in Settings: the session registers, the open profile shows it.
  getPermissions.mockResolvedValue({ status: 'granted' });
  await comeForward();
  expect(mockRegisterPushToken).toHaveBeenCalledTimes(1);
  expect(notice(view)).toBeNull();
  expect(theSwitch(view).props.value).toBe(true);

  // Taken back in Settings: said again, nothing registered anew.
  getPermissions.mockResolvedValue({ status: 'denied' });
  await comeForward();
  expect(notice(view)).toHaveTextContent(t.profile.pushNotAllowedHere, { exact: false });
  expect(mockRegisterPushToken).toHaveBeenCalledTimes(1);
});
