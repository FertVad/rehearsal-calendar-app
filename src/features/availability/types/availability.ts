/**
 * Type definitions for Availability feature
 */

export interface TimeSlot {
  start: string;
  end: string;
}

export interface SlotValidation {
  isValid: boolean;
  error?: string;
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

export interface DayData {
  day: number;
  isPadding: boolean;
}
