/**
 * Sign-in leads to the password reset (R3).
 *
 * Before: there was no way from sign-in to a forgotten password. The server
 * had the reset, and the contract sends a legacy owner whose password a
 * Google proof removed to it — but nothing in the app opened it.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import LoginScreen from '../LoginScreen';
import { translations } from '../../../../i18n/translations';

const t = translations.en;
const mockAuth: any = {};
jest.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../i18n/translations').translations.en, language: 'en' }),
}));
jest.mock('../../../../shared/components', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    GlassButton: ({ title, onPress, disabled, loading }: any) => React.createElement(TouchableOpacity,
      { onPress: disabled || loading ? undefined : onPress, disabled: disabled || loading }, React.createElement(Text, null, title)),
    GoogleSignInButton: () => null,
  };
});
jest.mock('expo-apple-authentication', () => ({
  AppleAuthenticationButton: () => null, AppleAuthenticationButtonType: {}, AppleAuthenticationButtonStyle: {},
}), { virtual: true });
jest.mock('../../../../shared/services/googleAuth', () => ({
  useGoogleAuth: () => ({ request: null, response: null, promptAsync: jest.fn() }),
  getGoogleIdToken: () => null,
}));
jest.mock('../../../../shared/services/appleAuth', () => ({
  signInWithApple: jest.fn(),
  isAppleAuthAvailable: () => Promise.resolve(false),
}));

const navigation: any = { navigate: jest.fn() };
const screen = () => render(<LoginScreen navigation={navigation} route={{ key: 'l', name: 'Login' } as any} />);

beforeEach(() => {
  navigation.navigate.mockReset();
  Object.assign(mockAuth, { busy: false, error: null, login: jest.fn(), loginWithGoogle: jest.fn(), loginWithApple: jest.fn() });
});

it('opens the reset with the address already typed', () => {
  const view = screen();
  fireEvent.changeText(view.getByTestId('login-email'), ' Anna@Example.com ');
  fireEvent.press(view.getByText(t.auth.forgotPassword));
  expect(navigation.navigate).toHaveBeenCalledWith('ResetPassword', { email: 'anna@example.com' });
});

it('opens the reset with an empty address when none was typed', () => {
  const view = screen();
  fireEvent.press(view.getByText(t.auth.forgotPassword));
  expect(navigation.navigate).toHaveBeenCalledWith('ResetPassword', { email: '' });
});
