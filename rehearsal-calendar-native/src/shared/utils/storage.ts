/**
 * AsyncStorage utility functions for user preferences
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { Language, translations } from '../../i18n/translations';

/**
 * Where the language chosen in Rehearsly is kept: written by the profile's
 * language picker (I18nContext) and by the account's preferences below.
 */
export const LANGUAGE_STORAGE_KEY = 'userLanguage';

/**
 * The language of a phone on which nobody chose one in Rehearsly yet (T-291):
 * the first of the phone's preferred languages, in its order, that the app has
 * — es-MX is es — and English when it has none of them. Read each time and
 * never stored, so until someone signs in or picks a language the app follows
 * the phone.
 */
export function phoneLanguage(): Language {
  try {
    for (const { languageCode } of getLocales()) {
      const code = languageCode?.toLowerCase();
      if (code && Object.prototype.hasOwnProperty.call(translations, code)) return code as Language;
    }
  } catch {
    // No answer from the phone: English, as before.
  }
  return 'en';
}

/**
 * The app's language now, for code outside the screens — the calendar export
 * (T-276). The same answer I18nContext starts from: the stored choice — the
 * profile's or the account's — and the phone's language when there is none.
 */
export async function appLanguage(): Promise<Language> {
  const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  return saved && saved in translations ? (saved as Language) : phoneLanguage();
}

interface User {
  timezone?: string;
  locale?: string;
  weekStartDay?: 'monday' | 'sunday';
}

// The account's language, for the screen already showing (HC01): the
// I18nContext reads the stored one only when it mounts, which is before
// anybody signs in.
const languageListeners = new Set<(locale: string) => void>();

export function onAccountLanguage(listener: (locale: string) => void): () => void {
  languageListeners.add(listener);
  return () => {
    languageListeners.delete(listener);
  };
}

/**
 * Sync user preferences to AsyncStorage for offline access
 * Syncs: timezone, locale, weekStartDay
 */
export const syncUserPreferences = async (user: User): Promise<void> => {
  if (user.locale) {
    const locale = user.locale;
    languageListeners.forEach((listener) => listener(locale));
  }

  const preferences = [
    { key: 'timezone', value: user.timezone },
    { key: LANGUAGE_STORAGE_KEY, value: user.locale },
    { key: 'weekStartDay', value: user.weekStartDay },
  ];

  const itemsToSet = preferences
    .filter(p => p.value !== undefined)
    .map(p => [p.key, p.value!] as [string, string]);

  if (itemsToSet.length > 0) {
    await AsyncStorage.multiSet(itemsToSet);
  }
};
