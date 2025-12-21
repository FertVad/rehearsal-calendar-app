/**
 * Calendar Sync Types
 * Types for calendar export/import functionality
 */

import { Calendar } from 'expo-calendar';

/**
 * Calendar event mapping (rehearsal → calendar event)
 */
export interface EventMapping {
  eventId: string;           // Calendar event ID
  calendarId: string;         // Calendar ID where event is stored
  lastSynced: string;         // ISO timestamp of last sync
}

/**
 * Calendar sync settings (export + import)
 */
export interface CalendarSyncSettings {
  // Export settings (App → Calendar)
  exportEnabled: boolean;
  exportCalendarId: string | null;
  lastExportTime: string | null; // ISO timestamp

  // Import settings (Calendar → App)
  importEnabled: boolean;
  importCalendarIds: string[];  // Multiple calendars can be selected
  importInterval: 'manual' | 'always' | '15min' | 'hourly' | '6hours' | 'daily';
  lastImportTime: string | null; // ISO timestamp
}

/**
 * Sync status
 */
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

/**
 * Device calendar info (from expo-calendar)
 */
export type DeviceCalendar = Calendar;

/**
 * Rehearsal with project info (for display purposes)
 */
export interface RehearsalWithProject {
  id: string;
  projectId: string;
  projectName: string;
  startsAt: string;      // ISO timestamp
  endsAt: string;        // ISO timestamp
  location?: string;
  title?: string;
  description?: string;
}

/**
 * Imported event mapping (calendar event → availability slot)
 * Phase 2: Import tracking
 */
export interface ImportedEventMap {
  [eventId: string]: {
    availabilitySlotId: string;  // ID of created availability slot
    calendarId: string;           // Which calendar this event came from
    lastImported: string;         // ISO timestamp of last import
  };
}

/**
 * Result of import operation
 * Phase 2: Import feedback
 */
export interface ImportResult {
  success: number;    // Number of events successfully imported
  failed: number;     // Number of events that failed to import
  skipped: number;    // Number of events skipped (already imported)
  errors: string[];   // Array of error messages
}

/**
 * Availability slot format for API
 * Phase 2: Calendar → App import
 */
export interface AvailabilitySlot {
  userId?: string;
  startsAt: string;   // ISO 8601 timestamp
  endsAt: string;     // ISO 8601 timestamp
  type: 'busy' | 'available' | 'tentative';
  source: 'manual' | 'rehearsal' | 'google_calendar' | 'apple_calendar';
  external_event_id?: string;  // Calendar event ID for tracking
  title?: string;
  notes?: string;
  is_all_day?: boolean;
}
