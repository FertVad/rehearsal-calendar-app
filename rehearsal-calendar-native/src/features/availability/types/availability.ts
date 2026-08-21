/**
 * Type definitions for Availability feature
 */

export interface TimeSlot {
  start: string;
  end: string;
}

/** Which rule a slot broke. Validation stays free of i18n; the screen
 *  turns the key into text so the message follows the user's language. */
export type SlotValidationError = 'endBeforeStart' | 'overlap';

export interface SlotValidation {
  isValid: boolean;
  error?: SlotValidationError;
}

export type DayMode = 'free' | 'busy' | 'custom';

export interface DayState {
  mode: DayMode;
  slots: TimeSlot[];
}

export interface AvailabilityData {
  [date: string]: DayState;
}

export interface MonthData {
  year: number;
  month: number;
}
