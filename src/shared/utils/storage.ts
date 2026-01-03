/**
 * AsyncStorage utility functions for user preferences
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  timezone?: string;
  locale?: string;
  weekStartDay?: 'monday' | 'sunday';
}

/**
 * Sync user preferences to AsyncStorage for offline access
 * Syncs: timezone, locale, weekStartDay
 */
export const syncUserPreferences = async (user: User): Promise<void> => {
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
