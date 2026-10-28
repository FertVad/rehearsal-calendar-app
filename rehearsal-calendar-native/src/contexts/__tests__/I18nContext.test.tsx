/**
 * The account's language reaches the screen already showing (cause fix 12:
 * HC01).
 *
 * The provider reads the stored language once, when it mounts — before anyone
 * signs in. Signing in wrote the account's language to storage and left the
 * screen in the old one until the next launch; switching accounts kept the
 * previous person's language on screen.
 */
import React from 'react';
import { Text } from 'react-native';
import { render, act, waitFor } from '@testing-library/react-native';
import { I18nProvider, useI18n } from '../I18nContext';
import { syncUserPreferences } from '../../shared/utils/storage';

const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (k: string) => Promise.resolve(mockStorage[k] ?? null),
  setItem: (k: string, v: string) => { mockStorage[k] = v; return Promise.resolve(); },
  multiSet: (pairs: [string, string][]) => { pairs.forEach(([k, v]) => { mockStorage[k] = v; }); return Promise.resolve(); },
}));

function Probe() {
  const { language } = useI18n();
  return <Text testID="language">{language}</Text>;
}

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
});

it('switches to the language of the account that signs in', async () => {
  mockStorage.userLanguage = 'en';
  const screen = render(<I18nProvider><Probe /></I18nProvider>);
  await waitFor(() => expect(screen.getByTestId('language').props.children).toBe('en'));

  await act(async () => { await syncUserPreferences({ locale: 'ru' }); });

  expect(screen.getByTestId('language').props.children).toBe('ru');
  expect(mockStorage.userLanguage).toBe('ru');
});

it('keeps the language when the account names one the app does not have', async () => {
  mockStorage.userLanguage = 'de';
  const screen = render(<I18nProvider><Probe /></I18nProvider>);
  await waitFor(() => expect(screen.getByTestId('language').props.children).toBe('de'));

  await act(async () => { await syncUserPreferences({ locale: 'xx' }); });

  expect(screen.getByTestId('language').props.children).toBe('de');
});
