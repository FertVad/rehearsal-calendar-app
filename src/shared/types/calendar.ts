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
 * Calendar sync settings (export only for Phase 1)
 */
export interface CalendarSyncSettings {
  // Export settings
  exportEnabled: boolean;
  exportCalendarId: string | null;

  // Status
  lastExportTime: string | null; // ISO timestamp
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
