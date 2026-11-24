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
import { getLocales } from 'expo-localization';
import { appLanguage, syncUserPreferences } from '../../shared/utils/storage';

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

// T-291. Before: with nothing stored the app opened in English whatever the
// phone's language — the welcome, sign-in, registration and onboarding too.
describe('the first launch, before any language is chosen', () => {
  const phone = (...tags: string[]) => (getLocales as jest.Mock).mockReturnValue(
    tags.map((tag) => ({ languageTag: tag, languageCode: tag.split('-')[0] })));

  afterEach(() => (getLocales as jest.Mock).mockReset().mockReturnValue([{ languageTag: 'en-US', languageCode: 'en' }]));

  const shown = async () => {
    const screen = render(<I18nProvider><Probe /></I18nProvider>);
    await waitFor(() => expect(screen.getByTestId('language')).toBeTruthy());
    return screen;
  };

  it.each([
    [['he-IL', 'ru-RU'], 'ru'],
    [['he-IL'], 'en'],
    [['es-MX'], 'es'],
    [['de-AT', 'ru-RU'], 'de'],
  ])('a phone in %p opens the app in %s, and nothing is stored', async (tags, expected) => {
    phone(...tags);
    const screen = await shown();
    expect(screen.getByTestId('language').props.children).toBe(expected);
    expect(mockStorage.userLanguage).toBeUndefined();
  });

  it('a phone that answers nothing opens it in English', async () => {
    phone();
    expect((await shown()).getByTestId('language').props.children).toBe('en');
  });

  it('a language chosen before decides over the phone', async () => {
    phone('ru-RU');
    mockStorage.userLanguage = 'de';
    const screen = await shown();
    await waitFor(() => expect(screen.getByTestId('language').props.children).toBe('de'));
  });

  it('signing into an account in English switches to English, as before', async () => {
    phone('ru-RU');
    const screen = await shown();
    expect(screen.getByTestId('language').props.children).toBe('ru');

    await act(async () => { await syncUserPreferences({ locale: 'en' }); });

    expect(screen.getByTestId('language').props.children).toBe('en');
    expect(mockStorage.userLanguage).toBe('en');
  });

  it('the calendar export follows the phone too', async () => {
    phone('es-ES');
    expect(await appLanguage()).toBe('es');
    mockStorage.userLanguage = 'de';
    expect(await appLanguage()).toBe('de');
  });
});

it('keeps the language when the account names one the app does not have', async () => {
  mockStorage.userLanguage = 'de';
  const screen = render(<I18nProvider><Probe /></I18nProvider>);
  await waitFor(() => expect(screen.getByTestId('language').props.children).toBe('de'));

  await act(async () => { await syncUserPreferences({ locale: 'xx' }); });

  expect(screen.getByTestId('language').props.children).toBe('de');
});
