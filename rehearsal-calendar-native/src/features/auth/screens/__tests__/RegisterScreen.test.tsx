/**
 * The registration form says what went wrong in the app's language (R3).
 *
 * Before: the context kept the server's English message and the form printed
 * it under the fields, so after the localized alert was closed "Email is not
 * available right now" stayed on a Russian screen. Codes the server can send
 * for this form — a name, the password rule, a taken address — each have
 * their own message, and a registration answered after the form was left
 * opens nothing (review R3-24, R3-25).
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import RegisterScreen from '../RegisterScreen';
import { AuthFlowError } from '../../utils/authErrors';
import { translations } from '../../../../i18n/translations';

const t = translations.ru;
const mockAuth: any = {};
jest.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../i18n/translations').translations.ru, language: 'ru' }),
}));
jest.mock('../../../../shared/components', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    GlassButton: ({ title, onPress, disabled, loading, testID }: any) => React.createElement(TouchableOpacity,
      { testID, onPress: disabled || loading ? undefined : onPress, disabled: disabled || loading, accessibilityState: { disabled: !!disabled } },
      React.createElement(Text, null, title)),
  };
});

const navigation: any = { navigate: jest.fn(), popTo: jest.fn() };
const form = () => render(<RegisterScreen navigation={navigation} route={{ key: 'r', name: 'Register' } as any} />);
function fill(view: ReturnType<typeof form>, values: { first?: string; last?: string; email?: string; password?: string; confirm?: string }) {
  fireEvent.changeText(view.getByTestId('register-first-name'), values.first ?? 'Анна');
  if (values.last !== undefined) fireEvent.changeText(view.getByTestId('register-last-name'), values.last);
  fireEvent.changeText(view.getByTestId('register-email'), values.email ?? 'anna@example.com');
  fireEvent.changeText(view.getByTestId('register-password'), values.password ?? 'long-enough-1');
  fireEvent.changeText(view.getByTestId('register-confirm'), values.confirm ?? values.password ?? 'long-enough-1');
}
const submit = (view: ReturnType<typeof form>) => act(async () => { fireEvent.press(view.getByTestId('register-submit')); });

beforeEach(() => {
  (Alert.alert as jest.Mock).mockReset();
  navigation.navigate.mockReset();
  navigation.popTo.mockReset();
  Object.assign(mockAuth, {
    busy: false,
    error: null,
    register: jest.fn(() => Promise.resolve({ email: 'anna@example.com', delivery: 'sent' })),
    forgetPendingSignIn: jest.fn(),
  });
});

it('shows a failure under the fields in the app language, never the server English', () => {
  mockAuth.error = new AuthFlowError('Email is not available right now', 'EMAIL_UNAVAILABLE', 503);
  const view = form();
  expect(view.getByText(t.auth.emailUnavailable)).toBeTruthy();
  expect(view.queryByText('Email is not available right now')).toBeNull();
});

it('alerts in the app language on a refused registration', async () => {
  mockAuth.register.mockRejectedValue(new AuthFlowError('Email is not available right now', 'EMAIL_UNAVAILABLE', 503));
  const view = form();
  fill(view, {});
  await act(async () => { fireEvent.press(view.getByText(t.auth.registerButton)); });
  expect(Alert.alert).toHaveBeenCalledWith(t.auth.registerError, t.auth.emailUnavailable);
});

it('names the server name rule rather than repeating its English', async () => {
  mockAuth.register.mockRejectedValue(new AuthFlowError('firstName must be 1 to 100 characters', 'NAME_INVALID', 400));
  const view = form();
  fill(view, {});
  await act(async () => { fireEvent.press(view.getByText(t.auth.registerButton)); });
  expect(Alert.alert).toHaveBeenCalledWith(t.auth.registerError, t.auth.nameInvalid);
});

it('stops a name of spaces and an over-long password before asking the server', async () => {
  const view = form();
  fill(view, { first: '   ' });
  expect(view.getByTestId('register-submit').props.accessibilityState?.disabled).toBe(true);
  await submit(view);
  fill(view, { password: 'я'.repeat(37) }); // 74 bytes in UTF-8
  await submit(view);
  expect(view.getByText(t.auth.passwordRule)).toBeTruthy();
  expect(mockAuth.register).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
});

it('counts the password in characters like the server, not in UTF-16 units', async () => {
  const view = form();
  fill(view, { password: '😀'.repeat(4) }); // 8 units, 4 characters
  await submit(view);
  expect(view.getByText(t.auth.passwordRule)).toBeTruthy();
  expect(mockAuth.register).not.toHaveBeenCalled();
});

it('keeps the button off until the required fields are filled, with no alert (T-015)', async () => {
  const view = form();
  expect(view.getByTestId('register-submit').props.accessibilityState?.disabled).toBe(true);
  await submit(view);
  fill(view, { confirm: '' });
  expect(view.getByTestId('register-submit').props.accessibilityState?.disabled).toBe(true);
  await submit(view);
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(mockAuth.register).not.toHaveBeenCalled();
  fireEvent.changeText(view.getByTestId('register-confirm'), 'long-enough-1');
  expect(view.getByTestId('register-submit').props.accessibilityState?.disabled).toBe(false);
});

it('says each problem under its own field, not in an alert, and forgets it on an edit (T-015)', async () => {
  const view = form();
  fill(view, { last: 'я'.repeat(101), email: 'not-an-address', confirm: 'something-else' });
  await submit(view);
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(mockAuth.register).not.toHaveBeenCalled();
  expect(view.getByText(t.auth.nameInvalid)).toBeTruthy();
  expect(view.getByText(t.auth.invalidEmail)).toBeTruthy();
  expect(view.getByText(t.auth.passwordsMismatch)).toBeTruthy();
  fireEvent.changeText(view.getByTestId('register-email'), 'anna@example.com');
  expect(view.queryByText(t.auth.invalidEmail)).toBeNull();
  expect(view.getByText(t.auth.passwordsMismatch)).toBeTruthy();
});

it('Return goes field to field, and the last one sends the form (T-015)', async () => {
  const view = form();
  const ids = ['register-first-name', 'register-last-name', 'register-email', 'register-password'];
  ids.forEach((id) => expect(view.getByTestId(id).props.returnKeyType).toBe('next'));
  expect(view.getByTestId('register-confirm').props.returnKeyType).toBe('go');
  fill(view, {});
  await act(async () => { fireEvent(view.getByTestId('register-confirm'), 'submitEditing'); });
  expect(mockAuth.register).toHaveBeenCalledWith('anna@example.com', 'long-enough-1', 'Анна', undefined, 'ru');
});

it('names the rule under the password from the rule itself, and shows the password on request (T-015)', () => {
  const { PASSWORD_MIN_LENGTH } = require('../../utils/accountRules');
  const view = form();
  expect(view.getByText(t.auth.passwordHint(PASSWORD_MIN_LENGTH))).toBeTruthy();
  expect(t.auth.passwordHint(PASSWORD_MIN_LENGTH)).toBe('Минимум 8 символов');
  expect(view.getByTestId('register-password').props.placeholder).toBe(t.auth.password);
  expect(view.getAllByLabelText(t.auth.showPassword)).toHaveLength(2);
  fireEvent.press(view.getAllByLabelText(t.auth.showPassword)[0]);
  expect(view.getByTestId('register-password').props.secureTextEntry).toBe(false);
});

it('offers both sign-in and a password reset for a taken address (R3 contract)', async () => {
  mockAuth.register.mockRejectedValue(new AuthFlowError('Taken', 'EMAIL_TAKEN', 409));
  const view = form();
  fill(view, { email: 'Anna@Example.com' });
  await act(async () => { fireEvent.press(view.getByText(t.auth.registerButton)); });
  const buttons = (Alert.alert as jest.Mock).mock.calls[0][2] as { text: string; onPress?: () => void }[];
  expect(buttons.map((button) => button.text)).toEqual([t.common.cancel, t.auth.loginButton, t.auth.resetPassword]);
  buttons[2].onPress?.();
  expect(navigation.navigate).toHaveBeenCalledWith('ResetPassword', { email: 'anna@example.com' });
});

it('opens the code screen, or nothing when the answer came after leaving', async () => {
  const view = form();
  fill(view, {});
  await act(async () => { fireEvent.press(view.getByText(t.auth.registerButton)); });
  expect(navigation.navigate).toHaveBeenCalledWith('VerifyEmail', { email: 'anna@example.com', delivery: 'sent' });
  navigation.navigate.mockReset();
  mockAuth.register.mockResolvedValue(null);
  await act(async () => { fireEvent.press(view.getByText(t.auth.registerButton)); });
  expect(navigation.navigate).not.toHaveBeenCalled();
});

it('leaves the flow from its own button, not only on unmount (review R3-28)', () => {
  const view = form();
  fireEvent.press(view.getByText(t.auth.alreadyHaveAccount));
  expect(mockAuth.forgetPendingSignIn).toHaveBeenCalledTimes(1);
  expect(navigation.popTo).toHaveBeenCalledWith('Login');
  expect(navigation.navigate).not.toHaveBeenCalled();
});

it('drops a registration in flight when the form is left', () => {
  const view = form();
  view.unmount();
  expect(mockAuth.forgetPendingSignIn).toHaveBeenCalledTimes(1);
});
