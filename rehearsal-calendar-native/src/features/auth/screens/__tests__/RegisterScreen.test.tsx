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
    GlassButton: ({ title, onPress, disabled, loading }: any) => React.createElement(TouchableOpacity,
      { onPress: disabled || loading ? undefined : onPress, disabled: disabled || loading }, React.createElement(Text, null, title)),
  };
});

const navigation: any = { navigate: jest.fn(), popTo: jest.fn() };
const form = () => render(<RegisterScreen navigation={navigation} route={{ key: 'r', name: 'Register' } as any} />);
function fill(view: ReturnType<typeof form>, values: { first?: string; email?: string; password?: string; confirm?: string }) {
  fireEvent.changeText(view.getByPlaceholderText(t.auth.firstNamePlaceholder), values.first ?? 'Анна');
  fireEvent.changeText(view.getByPlaceholderText(t.auth.emailPlaceholder), values.email ?? 'anna@example.com');
  fireEvent.changeText(view.getByPlaceholderText(t.auth.passwordMinLength), values.password ?? 'long-enough-1');
  fireEvent.changeText(view.getByPlaceholderText(t.auth.confirmPasswordPlaceholder), values.confirm ?? values.password ?? 'long-enough-1');
}

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
  await act(async () => { fireEvent.press(view.getByText(t.auth.registerButton)); });
  expect(Alert.alert).toHaveBeenLastCalledWith(t.common.error, t.auth.fillAllFields);
  fill(view, { password: 'я'.repeat(37) }); // 74 bytes in UTF-8
  await act(async () => { fireEvent.press(view.getByText(t.auth.registerButton)); });
  expect(Alert.alert).toHaveBeenLastCalledWith(t.common.error, t.auth.passwordRule);
  expect(mockAuth.register).not.toHaveBeenCalled();
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
