/**
 * Calendar Storage Utilities
 * AsyncStorage management for calendar sync
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventMapping, CalendarSyncSettings } from '../types/calendar';

import { logger } from './logger';
// Storage keys
const KEYS = {
  EXPORT_MAPPINGS: 'calendar-export-mappings',
  // Per-event import records, from before the server reconciled imports. Only
  // cleared now, never written.
  IMPORT_TRACKING: 'calendar-import-tracking',
  // How many imported rows the server holds for this device's calendars, as
  // the last sync reported.
  IMPORT_COUNT: 'calendar-import-count',
  SYNC_SETTINGS: 'calendar-sync-settings',
  // Exported events already decided to be taken back, whose removal has not
  // gone through yet: the old copy of a move to another calendar (EX02).
  EXPORT_LEFTOVERS: 'calendar-export-leftovers',
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

async function updateStored<T>(key: string, change: (current: T) => T, empty: T): Promise<T> {
  const previous = writeQueues.get(key) ?? Promise.resolve();

  const run = previous
    .catch(() => {
      // A failure ahead of us in the queue is that caller's to report.
    })
    .then(async () => {
      const json = await AsyncStorage.getItem(key);
      const current: T = json ? JSON.parse(json) : empty;
      const next = change(current);
      await AsyncStorage.setItem(key, JSON.stringify(next));
      return next;
    });

  writeQueues.set(key, run);

  try {
    return await run;
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
 * Save event mapping for a rehearsal.
 *
 * `lastSynced` is when the mapping was written — now, for one written here;
 * the server's own time, for one copied from the server. Never when it was
 * read: calendarMappings.ts picks between this record and the server's by it.
 */
export async function saveEventMapping(
  rehearsalId: string,
  eventId: string,
  calendarId: string,
  lastSynced: string = new Date().toISOString()
): Promise<void> {
  try {
    await updateStored<Record<string, unknown>>(
      KEYS.EXPORT_MAPPINGS,
      (mappings) => ({
        ...mappings,
        [rehearsalId]: { eventId, calendarId, lastSynced },
      }),
      {}
    );
  } catch (error) {
    logger.error('[CalendarStorage] Failed to save event mapping:', error);
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
    logger.error('[CalendarStorage] Failed to get event mapping:', error);
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
    logger.error('[CalendarStorage] Failed to remove event mapping:', error);
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
    logger.error('[CalendarStorage] Failed to get all mappings:', error);
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
    logger.error('[CalendarStorage] Failed to clear mappings:', error);
    throw error;
  }
}

/**
 * ============================================================================
 * Leftover exported events (calendar eventId → rehearsalId)
 * ============================================================================
 *
 * A move to another calendar holds two copies of one rehearsal's event until
 * the old one is removed, and the mapping can name only one. The old copy is
 * written here before the mapping moves to the new one, and leaves only once
 * the calendar has confirmed it gone. Every export pass and "remove all" take
 * these back, so neither copy is ever left with nothing pointing at it.
 *
 * The device's, not the account's: an event this app put in this phone's
 * calendar and has already decided to remove.
 */

export async function addLeftoverEvent(eventId: string, rehearsalId: string): Promise<void> {
  await updateStored<Record<string, { rehearsalId: string }>>(
    KEYS.EXPORT_LEFTOVERS,
    (leftovers) => ({ ...leftovers, [eventId]: { rehearsalId: String(rehearsalId) } }),
    {}
  );
}

export async function removeLeftoverEvent(eventId: string): Promise<void> {
  await updateStored<Record<string, { rehearsalId: string }>>(
    KEYS.EXPORT_LEFTOVERS,
    ({ [eventId]: _removed, ...rest }) => rest,
    {}
  );
}

/** Throws when the list cannot be read: that is not the same as none. */
export async function getLeftoverEvents(): Promise<Record<string, { rehearsalId: string }>> {
  const stored = await AsyncStorage.getItem(KEYS.EXPORT_LEFTOVERS);
  return stored ? JSON.parse(stored) : {};
}

/**
 * ============================================================================
 * Sync Settings
 * ============================================================================
 */

/** Stored settings with every field present (older ones lack the import half). */
function completeSettings(settings: Partial<CalendarSyncSettings> = {}): CalendarSyncSettings {
  return {
    exportEnabled: settings.exportEnabled || false,
    exportCalendarId: settings.exportCalendarId || null,
    lastExportTime: settings.lastExportTime || null,
    importEnabled: settings.importEnabled || false,
    importCalendarIds: settings.importCalendarIds || [],
    importInterval: settings.importInterval || 'manual',
    lastImportTime: settings.lastImportTime || null,
  };
}

/**
 * Get sync settings
 */
export async function getSyncSettings(): Promise<CalendarSyncSettings> {
  try {
    const settingsJson = await AsyncStorage.getItem(KEYS.SYNC_SETTINGS);
    return completeSettings(settingsJson ? JSON.parse(settingsJson) : {});
  } catch (error) {
    logger.error('[CalendarStorage] Failed to get sync settings:', error);
    // Return default settings on error
    return completeSettings();
  }
}

/**
 * Change the fields named, and only those; returns the settings as saved.
 *
 * The one way settings are written (cause fix 18). They used to be saved
 * whole, from whatever copy the caller held — a screen's state from its last
 * render — so a change of calendar wrote back the "last import" that copy had,
 * over the one the sync had just stamped, and a sync holding an old copy could
 * put back a setting switched off since (EO04). A patch on the stored value,
 * queued with the sync's own stamps, leaves alone what it does not name.
 * Throws when it cannot be saved: the caller must not show it as saved.
 */
export async function updateSyncSettings(
  patch: Partial<CalendarSyncSettings>
): Promise<CalendarSyncSettings> {
  try {
    return completeSettings(await updateStored<Partial<CalendarSyncSettings>>(
      KEYS.SYNC_SETTINGS,
      (settings) => ({ ...completeSettings(settings), ...patch }),
      {}
    ));
  } catch (error) {
    logger.error('[CalendarStorage] Failed to save sync settings:', error);
    throw error;
  }
}

/**
 * Update last export time
 */
export async function updateLastExportTime(): Promise<void> {
  try {
    // Through the queue, like the import's stamp below: the two land in the
    // same object in the same run.
    await updateStored<CalendarSyncSettings>(
      KEYS.SYNC_SETTINGS,
      (settings) => ({ ...settings, lastExportTime: new Date().toISOString() }),
      {} as CalendarSyncSettings
    );
  } catch (error) {
    logger.error('[CalendarStorage] Failed to update last export time:', error);
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
 * The number of imported events the server holds for this device's calendars.
 *
 * It used to be counted from a local record of every event imported, which the
 * server's reconcile made redundant (R7): the server answers each sync with the
 * count, and that is what the sync screen shows. Before this device's first
 * such sync, the old record's size stands in.
 */
export async function setImportedEventsCount(count: number): Promise<void> {
  await AsyncStorage.setItem(KEYS.IMPORT_COUNT, String(count));
}

/** Throws when the count cannot be read: that is not the same as none. */
export async function getImportedEventsCount(): Promise<number> {
  const stored = await AsyncStorage.getItem(KEYS.IMPORT_COUNT);
  if (stored !== null) return Number(stored) || 0;
  const legacy = await AsyncStorage.getItem(KEYS.IMPORT_TRACKING);
  return legacy ? Object.keys(JSON.parse(legacy)).length : 0;
}

/** Forget this device's import count, and the old per-event record with it. */
export async function clearAllImportedEvents(): Promise<void> {
  await AsyncStorage.multiRemove([KEYS.IMPORT_COUNT, KEYS.IMPORT_TRACKING]);
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
    logger.error('[CalendarStorage] Failed to update last import time:', error);
    throw error;
  }
}
