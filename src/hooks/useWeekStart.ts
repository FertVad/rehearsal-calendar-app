import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';

export type WeekStartDay = 'monday' | 'sunday';

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

/**
 * Get the offset for a day of week based on week start preference.
 * @param weekStart - Week start preference ('monday' or 'sunday')
 * @param dayOfWeek - Day of week from Date.getDay() (0=Sunday, 6=Saturday)
 * @returns Offset value (0-6) where 0 is the start of the week
 */
export function getDayOffset(weekStart: WeekStartDay, dayOfWeek: number): number {
  if (weekStart === 'monday') {
    // Convert Sunday (0) to 6, and Monday (1) to 0
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  }
  // For Sunday start, use as-is
  return dayOfWeek;
}

/**
 * Get the start of the week for a given date based on week start preference.
 * @param date - The date to get the week start for
 * @param weekStart - Week start preference ('monday' or 'sunday')
 * @returns Date object representing the start of the week
 */
export function getWeekStart(date: Date, weekStart: WeekStartDay): Date {
  const day = date.getDay();
  const offset = getDayOffset(weekStart, day);

  const weekStartDate = new Date(date);
  weekStartDate.setDate(date.getDate() - offset);
  weekStartDate.setHours(0, 0, 0, 0);

  return weekStartDate;
}

/**
 * Get the end of the week for a given date based on week start preference.
 * @param date - The date to get the week end for
 * @param weekStart - Week start preference ('monday' or 'sunday')
 * @returns Date object representing the end of the week
 */
export function getWeekEnd(date: Date, weekStart: WeekStartDay): Date {
  const weekStartDate = getWeekStart(date, weekStart);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekStartDate.getDate() + 6);
  weekEndDate.setHours(23, 59, 59, 999);

  return weekEndDate;
}
