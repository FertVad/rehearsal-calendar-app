import { DayMode, DayState, TimeSlot } from '../types';

/**
 * Helper to apply changes to all selected dates
 * Reduces code duplication in add/remove/update slot operations
 */
export function applyToSelectedDates(
  availability: Record<string, DayState>,
  selectedDates: string[],
  getDayState: (date: string) => DayState,
  updateFn: (currentState: DayState, dateKey: string) => DayState
): Record<string, DayState> {
  const updated = { ...availability };
  selectedDates.forEach(dateKey => {
    const currentState = getDayState(dateKey);
    updated[dateKey] = updateFn(currentState, dateKey);
  });
  return updated;
}

/**
 * Parse time string (HH:MM) to Date object
 */
export function parseTimeToDate(timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/**
 * Format Date object to time string (HH:MM)
 */
export function formatDateToTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
