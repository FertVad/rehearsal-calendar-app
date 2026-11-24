/**
 * A Google or Apple sign-in carries the language the app shows, and the app
 * stays in it (T-291).
 *
 * Before: the app opened in English whatever the phone's language, and the
 * sign-in sent only the provider's token, so the account Google or Apple
 * created was English — its notifications and emails too — and a person who
 * had switched the app to Russian before signing in was switched back.
 *
 * The real language provider, sign-in screen, AuthProvider and API client;
 * the phone is a Russian one, the network a stand-in that records what is sent
 * and answers as the server does for a new account in the language it got.
 */
import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { getLocales } from 'expo-localization';
import api from '../../../../shared/services/api';
import { I18nProvider, useI18n } from '../../../../contexts/I18nContext';
import { AuthProvider, useAuth } from '../../../../contexts/AuthContext';
import LoginScreen from '../LoginScreen';

const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (key: string) => Promise.resolve(mockStorage[key] ?? null),
  setItem: (key: string, value: string) => { mockStorage[key] = value; return Promise.resolve(); },
  removeItem: (key: string) => { delete mockStorage[key]; return Promise.resolve(); },
  multiGet: (keys: string[]) => Promise.resolve(keys.map((k) => [k, mockStorage[k] ?? null])),
  multiSet: (pairs: [string, string][]) => { pairs.forEach(([k, v]) => { mockStorage[k] = v; }); return Promise.resolve(); },
  multiRemove: (keys: string[]) => { keys.forEach((k) => delete mockStorage[k]); return Promise.resolve(); },
  clear: () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); return Promise.resolve(); },
}));
jest.mock('../../../../shared/services/notifications', () => ({
  unregisterPushToken: jest.fn(() => Promise.resolve()),
  keepPushRegistered: jest.fn(() => () => undefined),
}));
jest.mock('../../../../shared/utils/calendarMappings', () => ({ resetConnectionCache: jest.fn() }));
jest.mock('../../../../shared/components', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    GlassButton: ({ title, onPress, disabled, loading, testID }: any) => React.createElement(TouchableOpacity,
      { testID, onPress: disabled || loading ? undefined : onPress, disabled: disabled || loading }, React.createElement(Text, null, title)),
    GoogleSignInButton: () => null,
  };
});
jest.mock('expo-apple-authentication', () => {
  const React = require('react');
  const { TouchableOpacity } = require('react-native');
  return {
    AppleAuthenticationButton: ({ onPress }: any) => React.createElement(TouchableOpacity, { testID: 'apple-sign-in', onPress }),
    AppleAuthenticationButtonType: {}, AppleAuthenticationButtonStyle: {},
  };
}, { virtual: true });
const mockGoogle: { response: any } = { response: null };
jest.mock('../../../../shared/services/googleAuth', () => ({
  useGoogleAuth: () => ({ request: {}, response: mockGoogle.response, promptAsync: jest.fn() }),
  getGoogleIdToken: () => 'google-id-token',
}));
jest.mock('../../../../shared/services/appleAuth', () => ({
  signInWithApple: () => Promise.resolve({ identityToken: 'apple-id-token', user: { givenName: 'Anna' } }),
  isAppleAuthAvailable: () => Promise.resolve(true),
}));

/** What reached the server, and the server's answers for the account it created. */
let sent: { url: string; body: any }[];
let account: any;
const originalAdapter = api.defaults.adapter;
beforeAll(() => {
  api.defaults.adapter = ((config: any) => {
    const body = config.data ? JSON.parse(config.data) : undefined;
    sent.push({ url: config.url, body });
    if (config.url === '/auth/apple' || config.url === '/auth/google') {
      // As the server since T-291: a new account takes the language sent.
      const locale = ['ru', 'en', 'es', 'de'].includes(body?.locale) ? body.locale : 'en';
      account = { id: 'u1', email: 'anna@example.com', firstName: 'Anna', locale, timezone: 'Europe/Moscow',
        weekStartDay: 'monday', onboardingCompleted: false };
    } else if (config.url === '/auth/me' && body) {
      account = { ...account, ...body };
    }
    const user = account;
    const data = config.url === '/auth/me' ? { user } : { user, accessToken: 'a', refreshToken: 'r', isNewUser: true, linked: false };
    return Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config, request: {} });
  }) as any;
});
afterAll(() => { api.defaults.adapter = originalAdapter; });

let shown: string;
function Language() { shown = useI18n().language; return <Text>{shown}</Text>; }
let auth: ReturnType<typeof useAuth>;
function Capture() { auth = useAuth(); return null; }

const navigation: any = { navigate: jest.fn(), popTo: jest.fn(), addListener: jest.fn(() => () => undefined) };
const app = () => render(
  <I18nProvider>
    <AuthProvider>
      <Capture />
      <Language />
      <LoginScreen navigation={navigation} route={{ key: 'l', name: 'Login' } as any} />
    </AuthProvider>
  </I18nProvider>,
);

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  sent = [];
  account = undefined;
  auth = undefined as any;
  mockGoogle.response = null;
  (getLocales as jest.Mock).mockReturnValue([{ languageTag: 'ru-RU', languageCode: 'ru' }]);
});
afterEach(() => {
  (getLocales as jest.Mock).mockReturnValue([{ languageTag: 'en-US', languageCode: 'en' }]);
});

it('Apple: a Russian phone signs in with ru, and the app stays in Russian', async () => {
  const view = app();
  await waitFor(() => expect(auth.loading).toBe(false));
  expect(shown).toBe('ru');
  await act(async () => { fireEvent.press(await view.findByTestId('apple-sign-in')); });
  await waitFor(() => expect(auth.user).toBeTruthy());
  expect(sent.find((request) => request.url === '/auth/apple')?.body).toMatchObject({ idToken: 'apple-id-token', locale: 'ru' });
  expect(shown).toBe('ru');
});

it('Google: a Russian phone signs in with ru, and the app stays in Russian', async () => {
  mockGoogle.response = { type: 'success' };
  app();
  await waitFor(() => expect(auth.user).toBeTruthy());
  expect(sent.find((request) => request.url === '/auth/google')?.body).toMatchObject({ idToken: 'google-id-token', locale: 'ru' });
  expect(shown).toBe('ru');
});

it('a language picked before signing in is the one sent, over the phone', async () => {
  mockStorage.userLanguage = 'de';
  const view = app();
  await waitFor(() => expect(shown).toBe('de'));
  await act(async () => { fireEvent.press(await view.findByTestId('apple-sign-in')); });
  await waitFor(() => expect(auth.user).toBeTruthy());
  expect(sent.find((request) => request.url === '/auth/apple')?.body.locale).toBe('de');
  expect(shown).toBe('de');
});
