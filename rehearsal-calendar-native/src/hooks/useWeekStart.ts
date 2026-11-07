import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCalendars } from 'expo-localization';
import { useAuth } from '../contexts/AuthContext';

export type WeekStartDay = 'monday' | 'sunday';

/**
 * The first day of the week as the phone's region has it: Sunday where the
 * region starts the week on Sunday (firstWeekday 1), Monday everywhere else.
 * Written to the profile once, at the end of onboarding, in place of a step
 * that asked (T-022; HIG: "Respect people's systemwide settings").
 */
export const phoneWeekStart = (): WeekStartDay =>
  getCalendars()[0]?.firstWeekday === 1 ? 'sunday' : 'monday';

/**
 * Hook to get the current week start preference from user settings.
 * Falls back to AsyncStorage for offline support, and defaults to 'monday'.
 */
export function useWeekStart(): WeekStartDay {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState<WeekStartDay>('monday');

  useEffect(() => {
    const loadWeekStart = async () => {
      // First try to get from user object (database)
      if (user?.weekStartDay) {
        setWeekStart(user.weekStartDay);
        return;
      }

      // Fall back to AsyncStorage for offline support
      try {
        const cached = await AsyncStorage.getItem('weekStartDay');
        if (cached === 'monday' || cached === 'sunday') {
          setWeekStart(cached);
        }
      } catch (error) {
        // Ignore errors, use default 'monday'
      }
    };

    loadWeekStart();
  }, [user?.weekStartDay]);

  return weekStart;
}
