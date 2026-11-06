/**
 * A failure is said on the screen whose attempt it was, and only while the
 * person is there (T-224).
 *
 * Before: the AuthProvider kept one error for every screen, and both forms
 * showed it; it was cleared only by the next attempt. A wrong password, then
 * "Create account", left "Wrong email or password" under the registration's
 * fields, a Google refusal went the same way, and a refused registration
 * stayed on sign-in after going back to it.
 *
 * Both forms are mounted at once with the real AuthProvider, as in the stack:
 * sign-in stays under registration. Their navigation is a stand-in that says
 * when a screen is left (blur) and come back to (focus).
 */
import React from 'react';
import { Alert, View } from 'react-native';
import { render, fireEvent, act, waitFor, within } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../../../../contexts/AuthContext';
import LoginScreen from '../LoginScreen';
import RegisterScreen from '../RegisterScreen';
import { translations } from '../../../../i18n/translations';
import { authErrorMessage, toAuthFlowError } from '../../utils/authErrors';

const t = translations.en;
const mockLogin = jest.fn();
const mockRegister = jest.fn();
const mockLoginWithGoogle = jest.fn();
jest.mock('../../../../shared/services/api', () => ({
  authAPI: {
    getMe: jest.fn(),
    login: (...args: any[]) => mockLogin(...args),
    register: (...args: any[]) => mockRegister(...args),
    loginWithGoogle: (...args: any[]) => mockLoginWithGoogle(...args),
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
const mockGoogle: { response: any } = { response: null };
jest.mock('../../../../shared/services/googleAuth', () => ({
  useGoogleAuth: () => ({ request: {}, response: mockGoogle.response, promptAsync: jest.fn() }),
  getGoogleIdToken: () => 'google-id-token',
}));
jest.mock('../../../../shared/services/appleAuth', () => ({
  signInWithApple: jest.fn(),
  isAppleAuthAvailable: () => Promise.resolve(false),
}));

/** A screen's navigation that can say it was left or come back to. */
function screenNavigation() {
  const listeners: Record<string, Set<() => void>> = {};
  return {
    navigate: jest.fn(),
    popTo: jest.fn(),
    addListener: jest.fn((type: string, callback: () => void) => {
      (listeners[type] ??= new Set()).add(callback);
      return () => listeners[type].delete(callback);
    }),
    emit: (type: 'blur' | 'focus') => act(() => { listeners[type]?.forEach((callback) => callback()); }),
  };
}

let auth: ReturnType<typeof useAuth>;
function Capture() { auth = useAuth(); return null; }

const WRONG = { response: { status: 401, data: { error: 'Invalid credentials' } } };
const UNAVAILABLE = { response: { status: 503, data: { error: 'Email is not available right now', code: 'EMAIL_UNAVAILABLE' } } };

function stack(options: { register?: boolean } = {}) {
  const login = screenNavigation();
  const register = screenNavigation();
  const view = render(
    <AuthProvider>
      <Capture />
      <View testID="login-screen">
        <LoginScreen navigation={login as any} route={{ key: 'l', name: 'Login' } as any} />
      </View>
      {options.register !== false && (
        <View testID="register-screen">
          <RegisterScreen navigation={register as any} route={{ key: 'r', name: 'Register' } as any} />
        </View>
      )}
    </AuthProvider>,
  );
  const on = (id: 'login-screen' | 'register-screen') => within(view.getByTestId(id));
  return { view, login, register, on };
}

async function failSignIn(view: ReturnType<typeof render>) {
  fireEvent.changeText(view.getByTestId('login-email'), 'nobody@example.com');
  fireEvent.changeText(view.getByTestId('login-password'), 'wrong-password-1');
  await act(async () => { fireEvent.press(view.getByTestId('login-submit')); });
}

async function failRegistration(view: ReturnType<typeof render>) {
  fireEvent.changeText(view.getByTestId('register-first-name'), 'Viola');
  fireEvent.changeText(view.getByTestId('register-email'), 'viola@example.com');
  fireEvent.changeText(view.getByTestId('register-password'), 'long-enough-1');
  fireEvent.changeText(view.getByTestId('register-confirm'), 'long-enough-1');
  await act(async () => { fireEvent.press(view.getByTestId('register-submit')); });
}

beforeEach(() => {
  mockLogin.mockReset();
  mockRegister.mockReset();
  mockLoginWithGoogle.mockReset();
  mockGoogle.response = null;
  (Alert.alert as jest.Mock).mockClear();
});

it('a refused sign-in is said on sign-in only, and is gone after registration and back', async () => {
  mockLogin.mockRejectedValue(WRONG);
  const { view, login, on } = stack();
  await waitFor(() => expect(auth.loading).toBe(false));
  await failSignIn(view);
  expect(on('login-screen').getByText(t.auth.invalidCredentials)).toBeTruthy();
  expect(on('register-screen').queryByText(t.auth.invalidCredentials)).toBeNull();

  // "Create account": sign-in stays mounted under registration.
  await login.emit('blur');
  expect(on('register-screen').queryByText(t.auth.invalidCredentials)).toBeNull();
  // Back to sign-in: the old refusal is not waiting there.
  await login.emit('focus');
  expect(view.queryByText(t.auth.invalidCredentials)).toBeNull();
});

it('a refused Google sign-in is not carried to registration', async () => {
  const refusal = { response: { status: 500, data: { error: 'Google is down' } } };
  const said = authErrorMessage(t, toAuthFlowError(refusal, 'Google sign-in failed'));
  mockLoginWithGoogle.mockRejectedValue(refusal);
  mockGoogle.response = { type: 'success' };
  const { login, on } = stack();
  await waitFor(() => expect(mockLoginWithGoogle).toHaveBeenCalled());
  await act(async () => undefined);
  await login.emit('blur');
  expect(on('register-screen').queryByText(said)).toBeNull();
});

it('a Google refusal that comes after leaving for registration is not alerted over it', async () => {
  let refuse!: (reason: unknown) => void;
  mockLoginWithGoogle.mockReturnValue(new Promise((_, reject) => { refuse = reject; }));
  mockGoogle.response = { type: 'success' };
  const { login } = stack();
  await waitFor(() => expect(mockLoginWithGoogle).toHaveBeenCalled());

  // "Create account" while Google is still being asked.
  await login.emit('blur');
  await act(async () => { refuse({ response: { status: 500, data: { error: 'Google is down' } } }); });
  expect(Alert.alert).not.toHaveBeenCalled();
});

it('a Google refusal while on sign-in is still alerted there', async () => {
  mockLoginWithGoogle.mockRejectedValue({ response: { status: 500, data: { error: 'Google is down' } } });
  mockGoogle.response = { type: 'success' };
  stack();
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith(t.auth.googleSignInError, expect.any(String)));
});

it('a refused registration is said on registration only, and not on sign-in after going back', async () => {
  mockRegister.mockRejectedValue(UNAVAILABLE);
  const { view, login, on } = stack();
  await waitFor(() => expect(auth.loading).toBe(false));
  await login.emit('blur');
  await failRegistration(view);
  expect(on('register-screen').getByText(t.auth.emailUnavailable)).toBeTruthy();
  expect(on('login-screen').queryByText(t.auth.emailUnavailable)).toBeNull();

  // "Already have an account?": popTo('Login') takes registration away.
  fireEvent.press(view.getByText(t.auth.alreadyHaveAccount));
  view.rerender(
    <AuthProvider>
      <Capture />
      <View testID="login-screen">
        <LoginScreen navigation={login as any} route={{ key: 'l', name: 'Login' } as any} />
      </View>
    </AuthProvider>,
  );
  await login.emit('focus');
  expect(view.queryByText(t.auth.emailUnavailable)).toBeNull();
});
