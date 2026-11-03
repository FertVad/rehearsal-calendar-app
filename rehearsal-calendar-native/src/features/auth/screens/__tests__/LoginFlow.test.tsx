/**
 * A failed sign-in is said once, under the fields (T-015).
 *
 * Before: the form alerted the failure and the AuthProvider's error showed the
 * same words under the fields, so a wrong password was said twice. The alert
 * is gone; here the real AuthProvider shows that everything the alert used to
 * say — a wrong password, no network, the server failing, too many tries — is
 * under the fields instead.
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../../../../contexts/AuthContext';
import LoginScreen from '../LoginScreen';
import { translations } from '../../../../i18n/translations';

const t = translations.en;
const mockLogin = jest.fn();
jest.mock('../../../../shared/services/api', () => ({
  authAPI: {
    getMe: jest.fn(),
    login: (...args: any[]) => mockLogin(...args),
    updateMe: jest.fn(() => Promise.resolve({ data: {} })),
  },
}));
const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (key: string) => Promise.resolve(mockStorage[key] ?? null),
  setItem: (key: string, value: string) => { mockStorage[key] = value; return Promise.resolve(); },
  removeItem: (key: string) => { delete mockStorage[key]; return Promise.resolve(); },
  multiSet: (pairs: [string, string][]) => { pairs.forEach(([k, v]) => { mockStorage[k] = v; }); return Promise.resolve(); },
  multiRemove: (keys: string[]) => { keys.forEach((k) => delete mockStorage[k]); return Promise.resolve(); },
}));
jest.mock('../../../../shared/utils/storage', () => ({ syncUserPreferences: jest.fn(() => Promise.resolve()) }));
jest.mock('../../../../shared/services/notifications', () => ({
  unregisterPushToken: jest.fn(() => Promise.resolve()),
  keepPushRegistered: jest.fn(() => () => undefined),
}));
jest.mock('../../../../shared/utils/calendarMappings', () => ({ resetConnectionCache: jest.fn() }));
jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../i18n/translations').translations.en, language: 'en' }),
}));
jest.mock('../../../../shared/components', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    GlassButton: ({ title, onPress, disabled, loading, testID }: any) => React.createElement(TouchableOpacity,
      { testID, onPress: disabled || loading ? undefined : onPress, disabled: disabled || loading }, React.createElement(Text, null, title)),
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
let auth: ReturnType<typeof useAuth>;
function Capture() { auth = useAuth(); return null; }

beforeEach(() => {
  (Alert.alert as jest.Mock).mockReset();
  mockLogin.mockReset();
});

const refusals: [string, unknown, string][] = [
  ['a wrong password', { response: { status: 401, data: { error: 'Invalid credentials' } } }, t.auth.invalidCredentials],
  ['no network', Object.assign(new Error('Network Error'), { request: {} }), t.auth.noConnection],
  ['the server failing', { response: { status: 500, data: { error: 'Internal error' } } }, t.auth.requestFailed],
  ['too many tries', { response: { status: 429, data: { error: 'Slow down', code: 'RATE_LIMITED', retryAfter: 30 } } }, t.auth.rateLimited(30)],
];

it.each(refusals)('%s is said under the fields, once', async (_name, refusal, message) => {
  mockLogin.mockRejectedValue(refusal);
  const view = render(<AuthProvider><Capture /><LoginScreen navigation={navigation} route={{ key: 'l', name: 'Login' } as any} /></AuthProvider>);
  await waitFor(() => expect(auth.loading).toBe(false));
  fireEvent.changeText(view.getByTestId('login-email'), 'anna@example.com');
  fireEvent.changeText(view.getByTestId('login-password'), 'secret-1');
  await act(async () => { fireEvent.press(view.getByTestId('login-submit')); });
  expect(view.getAllByText(message)).toHaveLength(1);
  expect(Alert.alert).not.toHaveBeenCalled();
});
