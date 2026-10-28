/**
 * Only the person's own action shows the system push prompt (cause fix 20,
 * GC01).
 *
 * Before: the notifications hook asked whenever the tabs mounted for someone
 * whose account had notifications on — every new account — so "Later" on the
 * onboarding screen was answered by the prompt a moment later. iOS shows it
 * once; a refusal then can only be undone in Settings.
 */
import React from 'react';
import { renderHook, render, fireEvent, act } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { useNotifications } from '../useNotifications';
import NotificationsScreen from '../../../features/onboarding/screens/NotificationsScreen';
import { translations } from '../../../i18n/translations';

const t = translations.en;
const mockUser: { current: any } = { current: null };
const mockRegisterPushToken = jest.fn();
jest.mock('../../services/api', () => ({
  authAPI: { registerPushToken: (...args: any[]) => mockRegisterPushToken(...args) },
}));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser.current }) }));
jest.mock('../../../contexts/UnreadContext', () => {
  const refresh = jest.fn();
  const markRead = jest.fn();
  return { useUnread: () => ({ refresh, markRead }) };
});
jest.mock('../useAutoCalendarSync', () => ({ runAutoSync: jest.fn(() => Promise.resolve()) }));
jest.mock('../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../i18n/translations').translations.en, language: 'en' }),
}));
jest.mock('../../../features/onboarding/hooks/useOnboarding', () => ({ useOnboarding: () => ({ skipOnboarding: jest.fn() }) }));
jest.mock('../../../features/onboarding/components', () => {
  const React = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');
  return {
    OnboardingStep: ({ children, onNext, nextButtonTitle, secondaryAction }: any) => React.createElement(View, null,
      children,
      React.createElement(TouchableOpacity, { onPress: onNext }, React.createElement(Text, null, nextButtonTitle)),
      React.createElement(TouchableOpacity, { onPress: secondaryAction.onPress }, React.createElement(Text, null, secondaryAction.title))),
  };
});

const getPermissions = Notifications.getPermissionsAsync as jest.Mock;
const requestPermissions = Notifications.requestPermissionsAsync as jest.Mock;

beforeEach(() => {
  getPermissions.mockReset();
  getPermissions.mockResolvedValue({ status: 'undetermined' });
  requestPermissions.mockReset();
  requestPermissions.mockResolvedValue({ status: 'granted' });
  mockRegisterPushToken.mockReset();
  mockRegisterPushToken.mockResolvedValue({ data: {} });
  mockUser.current = { id: 7, notificationsEnabled: true };
});

it('does not ask when the tabs mount for someone with notifications on (GC01)', async () => {
  renderHook(() => useNotifications());
  await act(async () => {});
  expect(requestPermissions).not.toHaveBeenCalled();
});

it('"Later" asks nothing; "Allow" asks once', async () => {
  const navigation: any = { navigate: jest.fn(), goBack: jest.fn() };
  const view = render(<NotificationsScreen navigation={navigation} route={{ key: 'n', name: 'Notifications' } as any} />);

  await act(async () => { fireEvent.press(view.getByText(t.onboarding.notifications.later)); });
  expect(requestPermissions).not.toHaveBeenCalled();
  expect(navigation.navigate).toHaveBeenLastCalledWith('WeekStart');

  navigation.navigate.mockClear();
  await act(async () => { fireEvent.press(view.getByText(t.onboarding.notifications.allow)); });
  expect(requestPermissions).toHaveBeenCalledTimes(1);
  expect(mockRegisterPushToken).toHaveBeenCalledTimes(1);
  expect(navigation.navigate).toHaveBeenLastCalledWith('WeekStart');
});
