/**
 * AsyncStorage utility functions for user preferences
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    { key: 'userLanguage', value: user.locale },
    { key: 'weekStartDay', value: user.weekStartDay },
  ];

  const itemsToSet = preferences
    .filter(p => p.value !== undefined)
    .map(p => [p.key, p.value!] as [string, string]);

  if (itemsToSet.length > 0) {
    await AsyncStorage.multiSet(itemsToSet);
  }
};
