/**
 * Resetting a forgotten password with the emailed code (R3: A01).
 *
 * The request answers the same whether or not the address has an account, so
 * the screen says "if there is an account" and never more. The new password
 * meets the server's rule before anything is sent; the code and the password
 * go together, and a confirmed reset signs in. Leaving the screen drops a
 * confirmation still in flight, like the code screen does.
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import ResetPasswordScreen from '../ResetPasswordScreen';
import { AuthFlowError } from '../../utils/authErrors';
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
  };
});

const navigation: any = { popTo: jest.fn() };
const screen = (email?: string) =>
  render(<ResetPasswordScreen navigation={navigation} route={{ key: 'r', name: 'ResetPassword', params: { email } } as any} />);

async function requestCode(view: ReturnType<typeof screen>) {
  await act(async () => { fireEvent.press(view.getByText(t.auth.resetSendCode)); });
}
function fillReset(view: ReturnType<typeof screen>, values: { code?: string; password?: string; confirm?: string }) {
  fireEvent.changeText(view.getByTestId('reset-code'), values.code ?? '123456');
  fireEvent.changeText(view.getByTestId('reset-password'), values.password ?? 'long-enough-1');
  fireEvent.changeText(view.getByTestId('reset-confirm'), values.confirm ?? values.password ?? 'long-enough-1');
}

beforeEach(() => {
  jest.useFakeTimers();
  navigation.popTo.mockReset();
  Object.assign(mockAuth, {
    busy: false,
    requestPasswordReset: jest.fn((email: string) => Promise.resolve(email.trim().toLowerCase())),
    resetPassword: jest.fn(() => Promise.resolve()),
    forgetPendingSignIn: jest.fn(),
  });
});
afterEach(() => jest.useRealTimers());

it('asks for a code for the address it was given and says only "if there is an account"', async () => {
  const view = screen('anna@example.com');
  expect(view.getByDisplayValue('anna@example.com')).toBeTruthy();
  await requestCode(view);
  expect(mockAuth.requestPasswordReset).toHaveBeenCalledWith('anna@example.com');
  expect(view.getByText(t.auth.resetCodeSent('anna@example.com'))).toBeTruthy();
  expect(view.getByText(t.auth.resendIn(60))).toBeTruthy();
});

it('does not ask the server about an address that is not one', async () => {
  const view = screen('anna@');
  await requestCode(view);
  expect(mockAuth.requestPasswordReset).not.toHaveBeenCalled();
  expect(view.getByText(t.auth.invalidEmail)).toBeTruthy();
});

it('sends the code and the new password, for the address the code went to', async () => {
  const view = screen(' Anna@Example.com');
  await requestCode(view);
  fillReset(view, { code: '12a34 56' });
  await act(async () => { fireEvent.press(view.getByText(t.auth.resetButton)); });
  expect(mockAuth.resetPassword).toHaveBeenCalledWith('anna@example.com', '123456', 'long-enough-1');
});

it('holds a password the server would refuse, and a mismatch, before sending', async () => {
  const view = screen('anna@example.com');
  await requestCode(view);
  fillReset(view, { password: '😀'.repeat(4) });
  await act(async () => { fireEvent.press(view.getByText(t.auth.resetButton)); });
  expect(view.getByText(t.auth.passwordRule)).toBeTruthy();
  fillReset(view, { password: 'long-enough-1', confirm: 'long-enough-2' });
  await act(async () => { fireEvent.press(view.getByText(t.auth.resetButton)); });
  expect(view.getByText(t.auth.passwordsMismatch)).toBeTruthy();
  expect(mockAuth.resetPassword).not.toHaveBeenCalled();
});

it('says a refused code in the app language and stays', async () => {
  mockAuth.resetPassword.mockRejectedValue(new AuthFlowError('The code is not valid', 'CODE_EXPIRED', 400));
  const view = screen('anna@example.com');
  await requestCode(view);
  fillReset(view, {});
  await act(async () => { fireEvent.press(view.getByText(t.auth.resetButton)); });
  expect(view.getByText(t.auth.codeExpired)).toBeTruthy();
  expect(view.queryByText('The code is not valid')).toBeNull();
});

it('resends after the minute, and goes back for another address', async () => {
  const view = screen('anna@example.com');
  await requestCode(view);
  for (let second = 0; second < 60; second++) act(() => { jest.advanceTimersByTime(1000); });
  await act(async () => { fireEvent.press(view.getByText(t.auth.resendCode)); });
  expect(mockAuth.requestPasswordReset).toHaveBeenCalledTimes(2);
  fireEvent.press(view.getByText(t.auth.otherAddress));
  expect(view.getByText(t.auth.resetSendCode)).toBeTruthy();
  expect(view.queryByTestId('reset-code')).toBeNull();
});

it('shows a missing mail service in the app language', async () => {
  mockAuth.requestPasswordReset.mockRejectedValue(new AuthFlowError('Email is not available right now', 'EMAIL_UNAVAILABLE', 503));
  const view = screen('anna@example.com');
  await requestCode(view);
  expect(view.getByText(t.auth.emailUnavailable)).toBeTruthy();
  expect(view.queryByTestId('reset-code')).toBeNull();
});

it('drops a reset in flight when the screen is left any way', () => {
  const view = screen('anna@example.com');
  fireEvent.press(view.getByText(t.auth.backToLogin));
  expect(navigation.popTo).toHaveBeenCalledWith('Login');
  view.unmount();
  expect(mockAuth.forgetPendingSignIn).toHaveBeenCalledTimes(2);
});
