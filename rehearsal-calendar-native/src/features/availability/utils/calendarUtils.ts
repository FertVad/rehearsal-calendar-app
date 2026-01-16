/**
 * Calendar utility functions
 */
import { Spacing } from '../../../shared/constants/colors';
import { MonthData } from '../types/availability';
import { MONTH_TITLE_HEIGHT, WEEKDAY_ROW_HEIGHT, DAY_ROW_HEIGHT } from '../constants/availabilityConstants';
import { WeekStartDay } from '../../../hooks/useWeekStart';

/**
 * Generate months data for calendar
 */
export const generateMonths = (count: number): (MonthData & { key: string })[] => {
  const months: (MonthData & { key: string })[] = [];
  const today = new Date();

  for (let i = 0; i < count; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
    months.push({
      year: date.getFullYear(),
      month: date.getMonth(),
      key: `${date.getFullYear()}-${date.getMonth()}`,
    });
  }

  return months;
};

/**
 * Get days in month with padding for week alignment
 */
export const getDaysInMonth = (
  year: number,
  month: number,
  weekStart: WeekStartDay = 'monday'
): (number | null)[] => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  // Get day of week (0 = Sunday, 6 = Saturday)
  let startDayOfWeek = firstDay.getDay();

  // Convert based on week start preference
  if (weekStart === 'monday') {
    // Convert to Monday = 0, Sunday = 6
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
  }
  // For Sunday start, use as-is (Sunday = 0, Saturday = 6)

  const days: (number | null)[] = [];

  // Add empty cells for days before month starts
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(null);
  }

  // Add days of month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  return days;
};

/**
 * Format date as YYYY-MM-DD
 */
export const formatDate = (year: number, month: number, day: number): string => {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/**
 * Get day status based on availability data
 */
export const getDayStatus = (
  date: string,
  availability: { [date: string]: { mode: string } }
): 'free' | 'busy' | 'partial' | 'none' => {
  const state = availability[date];
  if (!state) return 'none';
  if (state.mode === 'free') return 'free';
  if (state.mode === 'busy') return 'busy';
  return 'partial';
};

/**
 * Calculate scroll offset for a specific date
 */
export const calculateDateOffset = (
  targetYear: number,
  targetMonth: number,
  targetDay: number,
  months: { year: number; month: number; key: string }[],
  weekStart: WeekStartDay = 'monday'
): number => {
  let offset = Spacing.xl; // Initial padding

  for (let i = 0; i < months.length; i++) {
    const m = months[i];

    if (m.year === targetYear && m.month === targetMonth - 1) {
      // Found the month, now calculate position within it
      offset += MONTH_TITLE_HEIGHT;
      offset += WEEKDAY_ROW_HEIGHT;

      // Calculate which row the day is in
      const firstDay = new Date(m.year, m.month, 1);
      let startDayOfWeek = firstDay.getDay();

      // Convert based on week start preference
      if (weekStart === 'monday') {
        startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
      }

      const dayIndex = startDayOfWeek + targetDay - 1;
      const rowIndex = Math.floor(dayIndex / 7);

      offset += rowIndex * DAY_ROW_HEIGHT;

      return offset;
    }

    // Add height of this month
    const firstDay = new Date(m.year, m.month, 1);
    const lastDay = new Date(m.year, m.month + 1, 0);
    let startDayOfWeek = firstDay.getDay();

    // Convert based on week start preference
    if (weekStart === 'monday') {
      startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    }

    const totalCells = startDayOfWeek + lastDay.getDate();
    const numRows = Math.ceil(totalCells / 7);

    const monthHeight = MONTH_TITLE_HEIGHT + WEEKDAY_ROW_HEIGHT + (numRows * DAY_ROW_HEIGHT) + Spacing.xl;
    offset += monthHeight;
  }

  return offset;
};
