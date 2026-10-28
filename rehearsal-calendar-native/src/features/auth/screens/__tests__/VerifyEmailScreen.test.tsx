/**
 * The screen where the emailed code is entered (R3).
 *
 * From registration a code was just sent, so resending waits out the
 * server's minute; from a sign-in nothing was sent now, so it does not. The
 * server's codes become messages in the app's language, and when the address
 * turns out to be confirmed already — or the app forgot the password — the
 * screen sends the person back to sign in.
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import VerifyEmailScreen from '../VerifyEmailScreen';
import { AuthFlowError } from '../../utils/authErrors';
import { translations } from '../../../../i18n/translations';

const t = translations.en;
const mockAuth: any = {};
jest.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../i18n/translations').translations.en, language: 'en' }),
}));

// The real button draws a gradient from an ESM package Jest does not
// transform; the screen's logic is under test, not the button.
jest.mock('../../../../shared/components', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    GlassButton: ({ title, onPress, disabled, loading }: any) => React.createElement(TouchableOpacity,
      { onPress: disabled || loading ? undefined : onPress, disabled: disabled || loading }, React.createElement(Text, null, title)),
  };
});

const navigation: any = { navigate: jest.fn(), popTo: jest.fn() };
const screen = (params: any) => render(<VerifyEmailScreen navigation={navigation} route={{ key: 'v', name: 'VerifyEmail', params } as any} />);

beforeEach(() => {
  jest.useFakeTimers();
  navigation.navigate.mockReset();
  navigation.popTo.mockReset();
  Object.assign(mockAuth, {
    pendingEmail: 'new@example.com',
    busy: false,
    confirmEmail: jest.fn(() => Promise.resolve()),
    resendConfirmation: jest.fn(() => Promise.resolve('sent')),
    forgetPendingSignIn: jest.fn(),
  });
});
afterEach(() => jest.useRealTimers());

it('after registering: names the address, waits a minute to resend, sends only digits', async () => {
  const view = screen({ email: 'new@example.com', delivery: 'sent' });
  expect(view.getByText(t.auth.verifySubtitle('new@example.com'))).toBeTruthy();
  expect(view.getByText(t.auth.resendIn(60))).toBeTruthy();
  fireEvent.changeText(view.getByTestId('verify-code'), '12a34 56');
  await act(async () => { fireEvent.press(view.getByText(t.auth.verifyButton)); });
  expect(mockAuth.confirmEmail).toHaveBeenCalledWith('123456');
});

it('does not claim a code went out when the email was refused or unanswered (review R3-26)', () => {
  for (const delivery of ['failed', 'unknown']) {
    const view = screen({ email: 'new@example.com', delivery });
    expect(view.getByText(delivery === 'failed' ? t.auth.deliveryFailed : t.auth.deliveryUnknown)).toBeTruthy();
    expect(view.getByText(t.auth.verifySubtitleUnsent('new@example.com'))).toBeTruthy();
    expect(view.queryByText(t.auth.verifySubtitle('new@example.com'))).toBeNull();
    view.unmount();
  }
});

it('says the code went out once a resend is accepted', async () => {
  const view = screen({ email: 'new@example.com', delivery: 'failed' });
  // The countdown sets one timer per second, each after the last re-render.
  for (let second = 0; second < 60; second++) act(() => { jest.advanceTimersByTime(1000); });
  expect(view.getByText(t.auth.resendCode)).toBeTruthy();
  await act(async () => { fireEvent.press(view.getByText(t.auth.resendCode)); });
  expect(view.getByText(t.auth.verifySubtitle('new@example.com'))).toBeTruthy();
  expect(view.getByText(t.auth.codeResent)).toBeTruthy();
});

it('drops the confirmation when the screen is left any way (review R3-24)', () => {
  const view = screen({ email: 'new@example.com', delivery: 'sent' });
  expect(mockAuth.forgetPendingSignIn).not.toHaveBeenCalled();
  view.unmount();
  expect(mockAuth.forgetPendingSignIn).toHaveBeenCalledTimes(1);
});

it('changes nothing when a resend answers after the person left', async () => {
  mockAuth.resendConfirmation.mockResolvedValue(null);
  const view = screen({ email: 'new@example.com' });
  await act(async () => { fireEvent.press(view.getByText(t.auth.resendCode)); });
  expect(view.queryByText(t.auth.codeResent)).toBeNull();
  expect(view.getByText(t.auth.resendCode)).toBeTruthy();
});

it('shows a wrong code in the app language and stays', async () => {
  mockAuth.confirmEmail.mockRejectedValue(new AuthFlowError('The code is not valid', 'CODE_INVALID', 400));
  const view = screen({ email: 'new@example.com', delivery: 'sent' });
  fireEvent.changeText(view.getByTestId('verify-code'), '000000');
  await act(async () => { fireEvent.press(view.getByText(t.auth.verifyButton)); });
  expect(view.getByText(t.auth.codeInvalid)).toBeTruthy();
  expect(mockAuth.forgetPendingSignIn).not.toHaveBeenCalled();
});

it('after a sign-in: explains, and resends at once; then waits', async () => {
  const view = screen({ email: 'new@example.com' });
  expect(view.getByText(t.auth.emailNotVerified)).toBeTruthy();
  await act(async () => { fireEvent.press(view.getByText(t.auth.resendCode)); });
  expect(mockAuth.resendConfirmation).toHaveBeenCalled();
  expect(view.getByText(t.auth.codeResent)).toBeTruthy();
  expect(view.getByText(t.auth.resendIn(60))).toBeTruthy();
  act(() => { jest.advanceTimersByTime(1000); });
  await waitFor(() => expect(view.getByText(t.auth.resendIn(59))).toBeTruthy());
});

it('waits as long as the server says when resending too soon', async () => {
  mockAuth.resendConfirmation.mockRejectedValue(new AuthFlowError('Wait', 'RATE_LIMITED', 429, { retryAfter: 42 }));
  const view = screen({ email: 'new@example.com' });
  await act(async () => { fireEvent.press(view.getByText(t.auth.resendCode)); });
  expect(view.getByText(t.auth.rateLimited(42))).toBeTruthy();
  expect(view.getByText(t.auth.resendIn(42))).toBeTruthy();
});

it('sends back to sign in when the address is already confirmed', async () => {
  mockAuth.confirmEmail.mockRejectedValue(new AuthFlowError('Already', 'ALREADY_VERIFIED', 409));
  const view = screen({ email: 'new@example.com', delivery: 'sent' });
  fireEvent.changeText(view.getByTestId('verify-code'), '123456');
  await act(async () => { fireEvent.press(view.getByText(t.auth.verifyButton)); });
  expect(mockAuth.forgetPendingSignIn).toHaveBeenCalled();
});

it('without remembered credentials, offers only the way back to sign in', () => {
  mockAuth.pendingEmail = null;
  const view = screen({ email: 'new@example.com', delivery: 'sent' });
  expect(view.getByText(t.auth.signInAgainToConfirm)).toBeTruthy();
  fireEvent.press(view.getByText(t.auth.backToLogin));
  expect(navigation.popTo).toHaveBeenCalledWith('Login');
  expect(view.queryByTestId('verify-code')).toBeNull();
});
