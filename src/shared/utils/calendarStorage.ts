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
    const mappingsJson = await AsyncStorage.getItem(KEYS.EXPORT_MAPPINGS);
    const mappings = mappingsJson ? JSON.parse(mappingsJson) : {};

    mappings[rehearsalId] = {
      eventId,
      calendarId,
      lastSynced: new Date().toISOString(),
    };

    await AsyncStorage.setItem(KEYS.EXPORT_MAPPINGS, JSON.stringify(mappings));
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
    const mappingsJson = await AsyncStorage.getItem(KEYS.EXPORT_MAPPINGS);
    if (!mappingsJson) return;

    const mappings = JSON.parse(mappingsJson);
    delete mappings[rehearsalId];

    await AsyncStorage.setItem(KEYS.EXPORT_MAPPINGS, JSON.stringify(mappings));
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
    const trackingJson = await AsyncStorage.getItem(KEYS.IMPORT_TRACKING);
    const tracking: ImportedEventMap = trackingJson ? JSON.parse(trackingJson) : {};

    tracking[eventId] = {
      availabilitySlotId,
      calendarId,
      lastImported: new Date().toISOString(),
    };

    await AsyncStorage.setItem(KEYS.IMPORT_TRACKING, JSON.stringify(tracking));
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
    const trackingJson = await AsyncStorage.getItem(KEYS.IMPORT_TRACKING);
    if (!trackingJson) return;

    const tracking: ImportedEventMap = JSON.parse(trackingJson);
    delete tracking[eventId];

    await AsyncStorage.setItem(KEYS.IMPORT_TRACKING, JSON.stringify(tracking));
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
    const settings = await getSyncSettings();
    settings.lastImportTime = new Date().toISOString();
    await saveSyncSettings(settings);
  } catch (error) {
    console.error('[CalendarStorage] Failed to update last import time:', error);
    throw error;
  }
}
