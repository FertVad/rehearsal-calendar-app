/**
 * Changing the sign-in address (R3: HP01).
 *
 * The server sends a code to the current address and one to the new address,
 * and asks for the password when the account has one (review R3-19). The
 * screen asks for the password only then, names which address each code went
 * to — and which email did not go out — and shows a wrong code under the
 * field it belongs to. A confirmed change has replaced the session; the
 * context writes the new one.
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import ChangeEmailScreen from '../ChangeEmailScreen';
import { AuthFlowError } from '../../../auth/utils/authErrors';
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
const mockProviders = jest.fn();
jest.mock('../../../../shared/services/api', () => ({ authAPI: { getAuthProviders: () => mockProviders() } }));

const navigation: any = { goBack: jest.fn() };
const screen = () => render(<ChangeEmailScreen navigation={navigation} route={{ key: 'c', name: 'ChangeEmail' } as any} />);
const methods = (...types: string[]) => Promise.resolve({ data: { providers: types.map((providerType) => ({ providerType })) } });
const SENT = { newAddress: 'sent', currentAddress: 'sent' };

async function requestCodes(view: ReturnType<typeof screen>, values: { email?: string; password?: string } = {}) {
  fireEvent.changeText(view.getByTestId('change-new-email'), values.email ?? ' New@Example.com ');
  if (values.password !== undefined) fireEvent.changeText(view.getByTestId('change-password'), values.password);
  await act(async () => { fireEvent.press(view.getByText(t.profile.sendCodes)); });
}

beforeEach(() => {
  jest.useFakeTimers();
  (Alert.alert as jest.Mock).mockReset();
  navigation.goBack.mockReset();
  mockProviders.mockReset();
  mockProviders.mockImplementation(() => methods('email'));
  Object.assign(mockAuth, {
    busy: false,
    user: { id: 7, email: 'anna@example.com', firstName: 'Anna', createdAt: '2026-09-26T00:00:00Z' },
    requestEmailChange: jest.fn(() => Promise.resolve(SENT)),
    confirmEmailChange: jest.fn(() => Promise.resolve()),
  });
});
afterEach(() => jest.useRealTimers());

// The sign-in methods arrive in a resolved promise; this lets it land.
const methodsLoaded = () => act(async () => undefined);

it('with a password: asks for it and sends it with the new address', async () => {
  const view = screen();
  await methodsLoaded();
  await requestCodes(view, { password: 'long-enough-1' });
  expect(mockAuth.requestEmailChange).toHaveBeenCalledWith('new@example.com', 'long-enough-1');
  expect(view.getByText(t.profile.currentAddressCode('anna@example.com'))).toBeTruthy();
  expect(view.getByText(t.profile.newAddressCode('new@example.com'))).toBeTruthy();
});

it('with a password: does not send without it', async () => {
  const view = screen();
  await methodsLoaded();
  await requestCodes(view);
  expect(mockAuth.requestEmailChange).not.toHaveBeenCalled();
  expect(view.getByText(t.auth.fillAllFields)).toBeTruthy();
});

it('Google or Apple only: no password to ask for, the codes alone (review R3-19)', async () => {
  mockProviders.mockImplementation(() => methods('google'));
  const view = screen();
  await methodsLoaded();
  expect(view.queryByTestId('change-password')).toBeNull();
  await requestCodes(view);
  expect(mockAuth.requestEmailChange).toHaveBeenCalledWith('new@example.com', undefined);
});

it('refuses the current address before asking the server', async () => {
  const view = screen();
  await requestCodes(view, { email: 'Anna@example.com', password: 'long-enough-1' });
  expect(view.getByText(t.auth.emailUnchanged)).toBeTruthy();
  expect(mockAuth.requestEmailChange).not.toHaveBeenCalled();
});

it('says which email did not go out', async () => {
  mockAuth.requestEmailChange.mockResolvedValue({ newAddress: 'failed', currentAddress: 'unknown' });
  const view = screen();
  await requestCodes(view, { password: 'long-enough-1' });
  expect(view.getByText(t.profile.deliveryFailedTo('new@example.com'))).toBeTruthy();
  expect(view.getByText(t.profile.deliveryUnknownTo('anna@example.com'))).toBeTruthy();
});

it('says a taken address and a wrong password in the app language', async () => {
  mockAuth.requestEmailChange.mockRejectedValueOnce(new AuthFlowError('Taken', 'EMAIL_TAKEN', 409, { field: 'newEmail' }));
  const view = screen();
  await requestCodes(view, { password: 'long-enough-1' });
  expect(view.getByText(t.profile.emailTakenByOther)).toBeTruthy();
  mockAuth.requestEmailChange.mockRejectedValueOnce(
    new AuthFlowError('Current password is incorrect', 'CURRENT_PASSWORD_INVALID', 403, { field: 'currentPassword' }));
  await requestCodes(view, { password: 'wrong-password' });
  expect(view.getByText(t.auth.currentPasswordInvalid)).toBeTruthy();
});

it('confirms with both codes and leaves once the address has changed', async () => {
  const view = screen();
  await requestCodes(view, { password: 'long-enough-1' });
  fireEvent.changeText(view.getByTestId('change-current-code'), '111111');
  fireEvent.changeText(view.getByTestId('change-new-code'), '222222');
  await act(async () => { fireEvent.press(view.getByText(t.profile.confirmChange)); });
  expect(mockAuth.confirmEmailChange).toHaveBeenCalledWith('222222', '111111');
  const [title, message, buttons] = (Alert.alert as jest.Mock).mock.calls[0];
  expect([title, message]).toEqual([t.profile.emailChangedTitle, t.profile.emailChanged('new@example.com')]);
  buttons[0].onPress();
  expect(navigation.goBack).toHaveBeenCalled();
});

it('shows a wrong code under the field it belongs to', async () => {
  mockAuth.confirmEmailChange.mockRejectedValue(new AuthFlowError('The code is not valid', 'CODE_INVALID', 400, { field: 'currentCode' }));
  const view = screen();
  await requestCodes(view, { password: 'long-enough-1' });
  fireEvent.changeText(view.getByTestId('change-current-code'), '111111');
  fireEvent.changeText(view.getByTestId('change-new-code'), '222222');
  await act(async () => { fireEvent.press(view.getByText(t.profile.confirmChange)); });
  expect(view.getByTestId('change-current-code-error').props.children).toBe(t.auth.codeInvalid);
  expect(view.queryByTestId('change-new-code-error')).toBeNull();
  expect(Alert.alert).not.toHaveBeenCalled();
});

it('asks for the codes again after the minute, or as long as the server says', async () => {
  const view = screen();
  await requestCodes(view, { password: 'long-enough-1' });
  expect(view.getByText(t.auth.resendIn(60))).toBeTruthy();
  for (let second = 0; second < 60; second++) act(() => { jest.advanceTimersByTime(1000); });
  mockAuth.requestEmailChange.mockRejectedValueOnce(new AuthFlowError('Wait', 'RATE_LIMITED', 429, { retryAfter: 42 }));
  await act(async () => { fireEvent.press(view.getByText(t.profile.resendCodes)); });
  expect(mockAuth.requestEmailChange).toHaveBeenLastCalledWith('new@example.com', 'long-enough-1');
  expect(view.getByText(t.auth.rateLimited(42))).toBeTruthy();
  expect(view.getByText(t.auth.resendIn(42))).toBeTruthy();
});
