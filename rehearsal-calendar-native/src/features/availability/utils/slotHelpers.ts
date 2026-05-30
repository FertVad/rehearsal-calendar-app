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

