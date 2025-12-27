/**
 * Calendar Sync Service - Modular Architecture
 *
 * Exports all calendar sync functions organized by operation type:
 * - Permissions: requestCalendarPermissions, checkCalendarPermissions
 * - Management: getDeviceCalendars, getDefaultCalendar
 * - Export: syncRehearsalToCalendar, unsyncRehearsal, syncAllRehearsals, removeAllExportedEvents
 * - Import: importCalendarEventsToAvailability, removeAllImportedSlots
 */

// Permissions
export {
  requestCalendarPermissions,
  checkCalendarPermissions,
} from './permissions';

// Calendar Management
export {
  getDeviceCalendars,
  getDefaultCalendar,
} from './management';

// Export Functions (App → Calendar)
export {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  syncRehearsalToCalendar,
  unsyncRehearsal,
  syncAllRehearsals,
  removeAllExportedEvents,
} from './export';

// Import Functions (Calendar → App)
export {
  getCalendarEvents,
  importCalendarEventsToAvailability,
  removeAllImportedSlots,
} from './import';

// Re-export types for convenience
export type { BatchSyncResult, ImportResult } from '../../types/calendar';
