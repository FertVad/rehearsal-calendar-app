/**
 * Sign-in leads to the password reset (R3), and the form (T-015).
 *
 * Before R3: there was no way from sign-in to a forgotten password. The server
 * had the reset, and the contract sends a legacy owner whose password a
 * Google proof removed to it — but nothing in the app opened it.
 *
 * Before T-015: an empty form was sent and answered with an alert; Return in
 * the address closed the keyboard and Return in the password did nothing; the
 * password's hint was a row of dots, and it could not be shown.
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
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
    GlassButton: ({ title, onPress, disabled, loading, testID }: any) => React.createElement(TouchableOpacity,
      { testID, onPress: disabled || loading ? undefined : onPress, disabled: disabled || loading, accessibilityState: { disabled: !!disabled } },
      React.createElement(Text, null, title)),
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
  (Alert.alert as jest.Mock).mockReset();
  navigation.navigate.mockReset();
  Object.assign(mockAuth, { busy: false, error: null, login: jest.fn(() => Promise.resolve()), loginWithGoogle: jest.fn(), loginWithApple: jest.fn() });
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

it('keeps "Sign In" off until both fields are filled, and sends no alert', async () => {
  const view = screen();
  expect(view.getByTestId('login-submit').props.accessibilityState?.disabled).toBe(true);
  await act(async () => { fireEvent.press(view.getByTestId('login-submit')); });
  fireEvent.changeText(view.getByTestId('login-email'), 'anna@example.com');
  expect(view.getByTestId('login-submit').props.accessibilityState?.disabled).toBe(true);
  await act(async () => { fireEvent.press(view.getByTestId('login-submit')); });
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(mockAuth.login).not.toHaveBeenCalled();
  fireEvent.changeText(view.getByTestId('login-password'), 'secret-1');
  expect(view.getByTestId('login-submit').props.accessibilityState?.disabled).toBe(false);
});

it('Return goes from the address to the password, and Return there signs in', async () => {
  const view = screen();
  const email = view.getByTestId('login-email');
  const password = view.getByTestId('login-password');
  expect(email.props.returnKeyType).toBe('next');
  expect(password.props.returnKeyType).toBe('go');
  fireEvent.changeText(email, 'anna@example.com');
  fireEvent.changeText(password, 'secret-1');
  await act(async () => { fireEvent(password, 'submitEditing'); });
  expect(mockAuth.login).toHaveBeenCalledWith('anna@example.com', 'secret-1');
});

it('a failed sign-in is said once, under the fields, not again in an alert', async () => {
  const { AuthFlowError } = require('../../utils/authErrors');
  const failure = new AuthFlowError('Invalid credentials', undefined, 401);
  mockAuth.login.mockRejectedValue(failure);
  const view = screen();
  fireEvent.changeText(view.getByTestId('login-email'), 'anna@example.com');
  fireEvent.changeText(view.getByTestId('login-password'), 'wrong-one');
  await act(async () => { fireEvent.press(view.getByTestId('login-submit')); });
  expect(Alert.alert).not.toHaveBeenCalled();
});

it('an address waiting for its code still opens the code screen', async () => {
  const { AuthFlowError } = require('../../utils/authErrors');
  mockAuth.login.mockRejectedValue(new AuthFlowError('Not verified', 'EMAIL_NOT_VERIFIED', 403, { email: 'anna@example.com' }));
  const view = screen();
  fireEvent.changeText(view.getByTestId('login-email'), 'Anna@Example.com');
  fireEvent.changeText(view.getByTestId('login-password'), 'secret-1');
  await act(async () => { fireEvent.press(view.getByTestId('login-submit')); });
  expect(navigation.navigate).toHaveBeenCalledWith('VerifyEmail', { email: 'anna@example.com' });
  expect(Alert.alert).not.toHaveBeenCalled();
});

it('names the password field by its word, and shows the password on request', () => {
  const view = screen();
  const password = view.getByTestId('login-password');
  expect(password.props.placeholder).toBe(t.auth.password);
  expect(password.props.secureTextEntry).toBe(true);
  fireEvent.press(view.getByLabelText(t.auth.showPassword));
  expect(view.getByTestId('login-password').props.secureTextEntry).toBe(false);
  fireEvent.press(view.getByLabelText(t.auth.hidePassword));
  expect(view.getByTestId('login-password').props.secureTextEntry).toBe(true);
});

it('leads to registration from the link at the foot', () => {
  const view = screen();
  fireEvent.press(view.getByText(t.auth.noAccount));
  expect(navigation.navigate).toHaveBeenCalledWith('Register');
});
