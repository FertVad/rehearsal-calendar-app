/**
 * Calendar Storage Utilities
 * AsyncStorage management for calendar sync
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventMapping, CalendarSyncSettings, ImportedEventMap } from '../types/calendar';

// Storage keys
const KEYS = {
  EXPORT_MAPPINGS: 'calendar-export-mappings',
  IMPORT_TRACKING: 'calendar-import-tracking',
  SYNC_SETTINGS: 'calendar-sync-settings',
};


/**
 * Change one stored value without losing the change beside it.
 *
 * Every one of these keys holds a map, and every writer read it, changed one
 * entry and wrote the whole thing back. Fine one at a time; the import saves
 * fifty at once and the export ten, all reading the same starting state and
 * each writing its own version over the last. Roughly one survived. The local
 * record of what had been imported was therefore mostly fiction — which is what
 * the sync screen counts, and what the import consults before deciding an event
 * is new.
 *
 * Writes to a given key are queued behind each other, so each one sees what the
 * one before it wrote. Different keys do not wait on each other.
 */
const writeQueues = new Map<string, Promise<unknown>>();

async function updateStored<T>(key: string, change: (current: T) => T, empty: T): Promise<void> {
  const previous = writeQueues.get(key) ?? Promise.resolve();

  const run = previous
    .catch(() => {
      // A failure ahead of us in the queue is that caller's to report.
    })
    .then(async () => {
      const json = await AsyncStorage.getItem(key);
      const current: T = json ? JSON.parse(json) : empty;
      await AsyncStorage.setItem(key, JSON.stringify(change(current)));
    });

  writeQueues.set(key, run);

  try {
    await run;
  } finally {
    if (writeQueues.get(key) === run) writeQueues.delete(key);
  }
}

/**
 * ============================================================================
 * Export Mappings (rehearsalId → calendar eventId)
 * ============================================================================
 */

/**
 * Save event mapping for a rehearsal
 */
export async function saveEventMapping(
  rehearsalId: string,
  eventId: string,
  calendarId: string
): Promise<void> {
  try {
    await updateStored<Record<string, unknown>>(
      KEYS.EXPORT_MAPPINGS,
      (mappings) => ({
        ...mappings,
        [rehearsalId]: { eventId, calendarId, lastSynced: new Date().toISOString() },
      }),
      {}
    );
  } catch (error) {
    console.error('[CalendarStorage] Failed to save event mapping:', error);
    throw error;
  }
}

/**
 * Get event mapping for a rehearsal
 */
export async function getEventMapping(
  rehearsalId: string
): Promise<EventMapping | null> {
  try {
    const mappingsJson = await AsyncStorage.getItem(KEYS.EXPORT_MAPPINGS);
    if (!mappingsJson) return null;

    const mappings = JSON.parse(mappingsJson);
    return mappings[rehearsalId] || null;
  } catch (error) {
    console.error('[CalendarStorage] Failed to get event mapping:', error);
    return null;
  }
}

/**
 * Remove event mapping for a rehearsal
 */
export async function removeEventMapping(rehearsalId: string): Promise<void> {
  try {
    await updateStored<Record<string, unknown>>(
      KEYS.EXPORT_MAPPINGS,
      ({ [rehearsalId]: _removed, ...rest }) => rest,
      {}
    );
  } catch (error) {
    console.error('[CalendarStorage] Failed to remove event mapping:', error);
    throw error;
  }
}

/**
 * Get all event mappings
 */
export async function getAllMappings(): Promise<Record<string, EventMapping>> {
  try {
    const mappingsJson = await AsyncStorage.getItem(KEYS.EXPORT_MAPPINGS);
    return mappingsJson ? JSON.parse(mappingsJson) : {};
  } catch (error) {
    console.error('[CalendarStorage] Failed to get all mappings:', error);
    return {};
  }
}

/**
 * Clear all event mappings
 */
export async function clearAllMappings(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEYS.EXPORT_MAPPINGS);
  } catch (error) {
    console.error('[CalendarStorage] Failed to clear mappings:', error);
    throw error;
  }
}

/**
 * ============================================================================
 * Sync Settings
 * ============================================================================
 */

/**
 * Get sync settings
 */
export async function getSyncSettings(): Promise<CalendarSyncSettings> {
  try {
    const settingsJson = await AsyncStorage.getItem(KEYS.SYNC_SETTINGS);
    if (!settingsJson) {
      // Default settings
      return {
        // Export settings
        exportEnabled: false,
        exportCalendarId: null,
        lastExportTime: null,
        // Import settings
        importEnabled: false,
        importCalendarIds: [],
        importInterval: 'manual',
        lastImportTime: null,
      };
    }

    const settings = JSON.parse(settingsJson);
    // Ensure import settings exist (for backward compatibility)
    return {
      exportEnabled: settings.exportEnabled || false,
      exportCalendarId: settings.exportCalendarId || null,
      lastExportTime: settings.lastExportTime || null,
      importEnabled: settings.importEnabled || false,
      importCalendarIds: settings.importCalendarIds || [],
      importInterval: settings.importInterval || 'manual',
      lastImportTime: settings.lastImportTime || null,
    };
  } catch (error) {
    console.error('[CalendarStorage] Failed to get sync settings:', error);
    // Return default settings on error
    return {
      // Export settings
      exportEnabled: false,
      exportCalendarId: null,
      lastExportTime: null,
      // Import settings
      importEnabled: false,
      importCalendarIds: [],
      importInterval: 'manual',
      lastImportTime: null,
    };
  }
}

/**
 * Save sync settings
 */
export async function saveSyncSettings(
  settings: CalendarSyncSettings
): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.SYNC_SETTINGS, JSON.stringify(settings));
  } catch (error) {
    console.error('[CalendarStorage] Failed to save sync settings:', error);
    throw error;
  }
}

/**
 * Update last export time
 */
export async function updateLastExportTime(): Promise<void> {
  try {
    const settings = await getSyncSettings();
    settings.lastExportTime = new Date().toISOString();
    await saveSyncSettings(settings);
  } catch (error) {
    console.error('[CalendarStorage] Failed to update last export time:', error);
    throw error;
  }
}

/**
 * Check if rehearsal is synced
 */
export async function isRehearsalSynced(rehearsalId: string): Promise<boolean> {
  const mapping = await getEventMapping(rehearsalId);
  return mapping !== null;
}

/**
 * Get count of synced rehearsals
 */
export async function getSyncedRehearsalsCount(): Promise<number> {
  const mappings = await getAllMappings();
  return Object.keys(mappings).length;
}

/**
 * ============================================================================
 * Import Tracking (calendar eventId → availability slotId)
 * Phase 2: Import from Calendar
 * ============================================================================
 */

/**
 * Save imported event mapping
 */
export async function saveImportedEvent(
  eventId: string,
  availabilitySlotId: string,
  calendarId: string
): Promise<void> {
  try {
    await updateStored<ImportedEventMap>(
      KEYS.IMPORT_TRACKING,
      (tracking) => ({
        ...tracking,
        [eventId]: { availabilitySlotId, calendarId, lastImported: new Date().toISOString() },
      }),
      {}
    );
  } catch (error) {
    console.error('[CalendarStorage] Failed to save imported event:', error);
    throw error;
  }
}

/**
 * Get all imported events
 */
export async function getImportedEvents(): Promise<ImportedEventMap> {
  try {
    const trackingJson = await AsyncStorage.getItem(KEYS.IMPORT_TRACKING);
    return trackingJson ? JSON.parse(trackingJson) : {};
  } catch (error) {
    console.error('[CalendarStorage] Failed to get imported events:', error);
    return {};
  }
}

/**
 * Remove imported event tracking
 */
export async function removeImportedEvent(eventId: string): Promise<void> {
  try {
    await updateStored<ImportedEventMap>(
      KEYS.IMPORT_TRACKING,
      ({ [eventId]: _removed, ...rest }) => rest,
      {}
    );
  } catch (error) {
    console.error('[CalendarStorage] Failed to remove imported event:', error);
    throw error;
  }
}

/**
 * Clear all imported event tracking
 */
export async function clearAllImportedEvents(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEYS.IMPORT_TRACKING);
  } catch (error) {
    console.error('[CalendarStorage] Failed to clear imported events:', error);
    throw error;
  }
}

/**
 * Get count of imported events
 */
export async function getImportedEventsCount(): Promise<number> {
  const tracking = await getImportedEvents();
  return Object.keys(tracking).length;
}

/**
 * Update last import time
 */
export async function updateLastImportTime(): Promise<void> {
  try {
    // Through the queue, because the export stamps its own timestamp into the
    // same object in the same run. Read-change-write on both sides means one of
    // the two timestamps is written from a copy taken before the other landed,
    // and is lost.
    await updateStored<CalendarSyncSettings>(
      KEYS.SYNC_SETTINGS,
      (settings) => ({ ...settings, lastImportTime: new Date().toISOString() }),
      {} as CalendarSyncSettings
    );
  } catch (error) {
    console.error('[CalendarStorage] Failed to update last import time:', error);
    throw error;
  }
}
