/**
 * The profile's notifications switch says what this phone will get (cause
 * fix 20).
 *
 * Before: turning it on saved the setting, ignored what registering came to,
 * and buzzed success — over a refused permission or a token the server never
 * got (GC02). And it showed the account's setting alone, on for every new
 * account, so after "Later" in onboarding it read on with nothing allowed
 * (GC01).
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import ProfileScreen from '../ProfileScreen';
import { translations } from '../../../../i18n/translations';

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

beforeEach(() => {
  (Alert.alert as jest.Mock).mockReset();
  getPermissions.mockReset();
  requestPermissions.mockReset();
  mockRegisterPushToken.mockReset();
  mockRegisterPushToken.mockResolvedValue({ data: {} });
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

it('reads off while nothing is allowed on this phone, though the account setting is on (GC01)', async () => {
  mockAuth.user.notificationsEnabled = true;
  getPermissions.mockResolvedValue({ status: 'undetermined' });
  const view = await profile();
  await waitFor(() => expect(theSwitch(view).props.value).toBe(false));
  expect(requestPermissions).not.toHaveBeenCalled();
});
