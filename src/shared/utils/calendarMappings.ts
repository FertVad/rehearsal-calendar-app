/**
 * Calendar Event Mappings Manager
 *
 * Hybrid storage approach:
 * - Primary: Database (via API) - reliable, survives app reinstall
 * - Secondary: AsyncStorage - for offline access
 *
 * This fixes the duplicate events issue caused by lost AsyncStorage mappings.
 */

import { Platform } from 'react-native';
import { calendarSyncAPI } from '../services/api';
import {
  saveEventMapping as saveToAsyncStorage,
  getEventMapping as getFromAsyncStorage,
  removeEventMapping as removeFromAsyncStorage,
  getAllMappings as getAllFromAsyncStorage,
  clearAllMappings as clearAllFromAsyncStorage,
} from './calendarStorage';

// Connection cache
let connectionCache: { id: number; deviceCalendarId: string } | null = null;

/**
 * Get or create calendar connection for device calendar
 */
export async function getOrCreateConnection(
  deviceCalendarId: string,
  deviceCalendarName?: string
): Promise<number | null> {
  try {
    // Check cache
    if (connectionCache && connectionCache.deviceCalendarId === deviceCalendarId) {
      return connectionCache.id;
    }

    // Get existing connections
    const response = await calendarSyncAPI.getConnections();
    const connections = response.data.connections || [];

    // Find connection for this calendar
    const existing = connections.find(
      (c: any) => c.device_calendar_id === deviceCalendarId
    );

    if (existing) {
      connectionCache = { id: existing.id, deviceCalendarId };
      return existing.id;
    }

    // Create new connection
    const provider = Platform.OS === 'ios' ? 'apple' : 'google';
    const createResponse = await calendarSyncAPI.createOrUpdateConnection({
      provider,
      deviceCalendarId,
      deviceCalendarName,
      syncEnabled: true,
      syncDirection: 'both',
    });

    const newConnection = createResponse.data.connection;
    connectionCache = { id: newConnection.id, deviceCalendarId };
    return newConnection.id;
  } catch (error) {
    console.error('[CalendarMappings] Failed to get/create connection:', error);
    return null;
  }
}

/**
 * Save event mapping (both DB and AsyncStorage)
 */
export async function saveEventMapping(
  rehearsalId: string,
  eventId: string,
  calendarId: string
): Promise<void> {
  try {
    // Save to AsyncStorage first (for offline access)
    await saveToAsyncStorage(rehearsalId, eventId, calendarId);

    // Get or create connection
    const connectionId = await getOrCreateConnection(calendarId);
    if (!connectionId) {
      return;
    }

    // Save to database (primary source of truth)
    await calendarSyncAPI.createOrUpdateMapping({
      connectionId,
      eventType: 'rehearsal',
      internalEventId: rehearsalId,
      externalEventId: eventId,
      syncDirection: 'export',
    });
  } catch (error) {
    console.error('[CalendarMappings] Failed to save mapping to DB:', error);
    // Fallback: at least AsyncStorage is saved
  }
}

/**
 * Get event mapping (try DB first, fallback to AsyncStorage)
 */
export async function getEventMapping(
  rehearsalId: string
): Promise<{ eventId: string; calendarId: string; lastSynced: string } | null> {
  try {
    // Try database first (primary source)
    const response = await calendarSyncAPI.getMappingByEvent('rehearsal', rehearsalId);
    const mapping = response.data.mapping;

    if (mapping) {
      // Convert DB format to expected format
      const result = {
        eventId: mapping.external_event_id,
        calendarId: mapping.device_calendar_id,
        lastSynced: mapping.last_sync_at,
      };

      // Update AsyncStorage cache
      await saveToAsyncStorage(rehearsalId, result.eventId, result.calendarId);

      return result;
    }
  } catch (error: any) {
    // If 404, no mapping exists - continue to AsyncStorage check
    if (error.response?.status !== 404) {
      console.error('[CalendarMappings] DB lookup failed, falling back to AsyncStorage:', error);
    }
  }

  // Fallback: check AsyncStorage (for offline or if DB failed)
  return await getFromAsyncStorage(rehearsalId);
}

/**
 * Remove event mapping (both DB and AsyncStorage)
 */
export async function removeEventMapping(rehearsalId: string): Promise<void> {
  try {
    // Remove from AsyncStorage
    await removeFromAsyncStorage(rehearsalId);

    // Remove from database
    try {
      await calendarSyncAPI.deleteMappingByEvent('rehearsal', rehearsalId);
    } catch (error: any) {
      // 404 is okay - mapping doesn't exist
      if (error.response?.status !== 404) {
        console.error('[CalendarMappings] Failed to remove from DB:', error);
      }
    }
  } catch (error) {
    console.error('[CalendarMappings] Failed to remove mapping:', error);
    throw error;
  }
}

/**
 * Get all mappings (try DB first, fallback to AsyncStorage)
 */
export async function getAllMappings(): Promise<Record<string, { eventId: string; calendarId: string; lastSynced: string }>> {
  try {
    // Try database first
    const response = await calendarSyncAPI.getMappings('rehearsal');
    const mappings = response.data.mappings || [];

    // Convert to expected format
    const result: Record<string, { eventId: string; calendarId: string; lastSynced: string }> = {};
    for (const mapping of mappings) {
      result[mapping.internal_event_id] = {
        eventId: mapping.external_event_id,
        calendarId: mapping.device_calendar_id,
        lastSynced: mapping.last_sync_at,
      };
    }

    // Update AsyncStorage cache
    // Note: This is a simplification, ideally we'd sync each one individually
    return result;
  } catch (error) {
    console.error('[CalendarMappings] Failed to get mappings from DB, falling back to AsyncStorage:', error);
    // Fallback to AsyncStorage
    return await getAllFromAsyncStorage();
  }
}

/**
 * Clear all mappings (both DB and AsyncStorage)
 */
export async function clearAllMappings(): Promise<void> {
  try {
    // Clear AsyncStorage
    await clearAllFromAsyncStorage();

    // Clear database - get all connections and delete mappings
    try {
      const response = await calendarSyncAPI.getMappings('rehearsal');
      const mappings = response.data.mappings || [];

      // Delete each mapping
      for (const mapping of mappings) {
        await calendarSyncAPI.deleteMapping(mapping.id);
      }
    } catch (error) {
      console.error('[CalendarMappings] Failed to clear DB mappings:', error);
    }
  } catch (error) {
    console.error('[CalendarMappings] Failed to clear mappings:', error);
    throw error;
  }
}
