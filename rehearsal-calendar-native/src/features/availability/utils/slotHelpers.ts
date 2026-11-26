import { DayState } from '../types';

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
    // An edited day is the person's own, whatever it says now: a weekend's
    // default it held is replaced by their save (T-406).
    const { weekendDefault: _replaced, ...next } = updateFn(currentState, dateKey);
    updated[dateKey] = next;
  });
  return updated;
}

