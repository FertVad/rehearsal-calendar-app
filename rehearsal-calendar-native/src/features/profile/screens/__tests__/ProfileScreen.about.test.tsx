/**
 * The profile's About section (T-011). "Help" had no onPress: a row with a
 * chevron that did nothing. And "Version" was "1.0.0" written into the screen,
 * whatever was built. Help opens the support page, served by the app's own
 * server, in the app's language; the version is the build's.
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import ProfileScreen from '../ProfileScreen';

const mockLanguage = { current: 'ru' };
const mockOpenURL = jest.fn((_url: string) => Promise.resolve());
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '2.4.1' } },
}));
jest.mock('../../../../shared/services/api', () => ({
  authAPI: { registerPushToken: jest.fn(), unregisterPushToken: jest.fn(() => Promise.resolve()) },
  supportPageUrl: (language: string) => `http://127.0.0.1:3001/support?lang=${language}`,
}));
jest.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { firstName: 'Masha', email: 'm@example.com' }, loading: false }),
}));
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({
    t: require('../../../../i18n/translations').translations[mockLanguage.current],
    language: mockLanguage.current,
    setLanguage: jest.fn(),
  }),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, [effect]),
}));
jest.mock('../../../../shared/components', () => ({
  GlassButton: () => null,
  SkeletonLoader: () => null,
  UserAvatar: () => null,
}));
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  const React = require('react');
  return Object.assign(Object.create(RN), {
    Switch: (props: any) => React.createElement(RN.View, props),
    Linking: { openURL: (url: string) => mockOpenURL(url) },
  });
});
jest.mock('../../../../shared/components/AppModal', () => ({ AppModal: () => null }));

async function profile() {
  const view = render(<ProfileScreen navigation={{ navigate: jest.fn() } as any} route={{ key: 'p', name: 'ProfileMain' } as any} />);
  await act(async () => {});
  return view;
}

beforeEach(() => mockOpenURL.mockClear());

it('opens the support page in the app’s language from Help', async () => {
  mockLanguage.current = 'ru';
  const view = await profile();
  fireEvent.press(view.getByText('Помощь'));
  expect(mockOpenURL).toHaveBeenCalledWith('http://127.0.0.1:3001/support?lang=ru');
});

it('shows the version the app was built as, not one written into the screen', async () => {
  mockLanguage.current = 'en';
  const view = await profile();
  expect(view.getByText('2.4.1')).toBeTruthy();
  expect(view.queryByText('1.0.0')).toBeNull();
});
