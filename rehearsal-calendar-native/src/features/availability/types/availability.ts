/**
 * Type definitions for Availability feature
 */

/** Where a row came from, when it is not the user's own. */
export type SlotSource = 'apple_calendar' | 'google_calendar' | 'rehearsal';

export interface TimeSlot {
  start: string;
  end: string;
  /** Set only on read-only rows, so the screen can say where they came from. */
  source?: SlotSource;
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
  /** The user's own slots. These are what a save writes. */
  slots: TimeSlot[];
  /**
   * Events read out of the phone's calendar, shown but not editable.
   *
   * Kept apart from `slots` rather than mixed in, for two reasons. A save
   * writes every entry in `slots` as a hand-entered row, so an imported event
   * sitting there would be copied into a manual one on each save. And the
   * editor addresses slots by index — interleaving rows nobody may edit would
   * make "remove the second one" mean different things in different places.
   */
  importedSlots?: TimeSlot[];
}

export interface AvailabilityData {
  [date: string]: DayState;
}

export interface MonthData {
  year: number;
  month: number;
}
