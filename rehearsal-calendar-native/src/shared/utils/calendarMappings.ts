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
import { listDeviceCalendarIds } from '../services/calendar/deviceCalendars';
import {
  saveEventMapping as saveToAsyncStorage,
  getEventMapping as getFromAsyncStorage,
  removeEventMapping as removeFromAsyncStorage,
  getAllMappings as getAllFromAsyncStorage,
  clearAllMappings as clearAllFromAsyncStorage,
} from './calendarStorage';

// Connection cache
//
// Keyed by the calendar and nothing else, so it has to be cleared when a
// different person signs in on the same device. Otherwise the second user's
// mappings are posted against the first user's connection id, the server
// rejects every one of them for not owning it, and saveEventMapping swallows
// the failure — leaving their exported rehearsals recorded nowhere.
let connectionCache: { id: number; deviceCalendarId: string } | null = null;

/** Forget the connection. Called when the device changes hands. */
export function resetConnectionCache(): void {
  connectionCache = null;
}

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

type Mapping = { eventId: string; calendarId: string; lastSynced: string };
type ServerMapping = {
  internal_event_id: number | string;
  external_event_id: string;
  device_calendar_id: string;
  last_sync_at: string;
};

/**
 * This device's export mappings on the server, one per rehearsal: the newest.
 *
 * The server keeps a mapping per connection, and a connection is one calendar
 * of one device, so a rehearsal exported from two phones has two. They were
 * folded into one per rehearsal with the oldest winning, and the export then
 * worked with an event id from the other phone — which means nothing here, so
 * it recreated the event, or, by coincidence, names another event on this one
 * (ES02). Only mappings recorded under a calendar this device has are its own
 * (deviceCalendars.ts); among them the newest is the one in use — a rehearsal
 * moved to another calendar keeps its old mapping until it is removed.
 */
async function thisDeviceServerMappings(): Promise<Map<string, Mapping>> {
  const [response, calendars] = await Promise.all([
    calendarSyncAPI.getMappings('rehearsal'),
    listDeviceCalendarIds(),
  ]);
  const here = new Set(calendars);
  const time = (value: string) => new Date(value).getTime() || 0;
  const newest = new Map<string, Mapping>();
  for (const row of (response.data.mappings || []) as ServerMapping[]) {
    if (!here.has(row.device_calendar_id)) continue;
    const rehearsalId = String(row.internal_event_id);
    const held = newest.get(rehearsalId);
    if (held && time(held.lastSynced) >= time(row.last_sync_at)) continue;
    newest.set(rehearsalId, {
      eventId: row.external_event_id,
      calendarId: row.device_calendar_id,
      lastSynced: row.last_sync_at,
    });
  }
  return newest;
}

/**
 * Get event mapping (try DB first, fallback to AsyncStorage)
 */
export async function getEventMapping(
  rehearsalId: string
): Promise<{ eventId: string; calendarId: string; lastSynced: string } | null> {
  try {
    // Try database first (primary source), within this device's calendars.
    const result = (await thisDeviceServerMappings()).get(String(rehearsalId));

    if (result) {

      // Update AsyncStorage cache
      await saveToAsyncStorage(rehearsalId, result.eventId, result.calendarId);

      return result;
    }
  } catch (error: any) {
    // A missing mapping comes back as null, so anything landing here is a real
    // failure — the local cache is the fallback.
    console.error('[CalendarMappings] DB lookup failed, falling back to AsyncStorage:', error);
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

    // Remove from database — this device's mapping only. Another phone that
    // exported the same rehearsal keeps its own (ES02).
    try {
      await calendarSyncAPI.deleteMappingByEvent('rehearsal', rehearsalId, await listDeviceCalendarIds());
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
    // Try database first, within this device's calendars
    const result = Object.fromEntries(await thisDeviceServerMappings());

    // Merged with what is held locally, not substituted for it.
    //
    // A mapping reaches the server only if saveEventMapping got that far — one
    // failed request, or a connection id that could not be established, and it
    // exists on this device alone. Answering with the server's rows only made
    // those invisible: "remove all exported" walked past their events and left
    // them in the calendar while reporting success, and the import had nothing
    // to exclude them by.
    //
    // The server wins where both know a rehearsal: it is the shared record, and
    // a local entry can be left over from a device that has since been wiped.
    const cached = await getAllFromAsyncStorage();
    return { ...cached, ...result };
  } catch (error) {
    console.error('[CalendarMappings] Failed to get mappings from DB, falling back to AsyncStorage:', error);

    const cached = await getAllFromAsyncStorage();
    if (Object.keys(cached).length > 0) return cached;

    // Neither the server nor the cache could answer, and "nothing exported" is
    // not the same claim as "I could not find out". The import uses this list
    // to leave our own exported rehearsals alone; handed an empty one it takes
    // every rehearsal it put in the calendar and stores it back as somebody's
    // busy time — for a rehearsal they are already on, counted twice. So say
    // so, and let the caller give up on this run rather than guess.
    //
    // Reachable on a fresh install or straight after a user switch, when the
    // cache is empty by design and one failed request is all it takes.
    throw new Error('Calendar mappings unavailable: server failed and nothing is cached');
  }
}

/**
 * Clear all mappings (both DB and AsyncStorage)
 */
export async function clearAllMappings(): Promise<void> {
  try {
    // Clear AsyncStorage
    await clearAllFromAsyncStorage();

    // Clear database — this device's mappings, in one request. It used to
    // delete every mapping of the person, so "remove all exported" on one
    // phone left the other's events in its calendar with nothing pointing at
    // them (ES02).
    try {
      await calendarSyncAPI.deleteMappings('rehearsal', await listDeviceCalendarIds());
    } catch (error) {
      console.error('[CalendarMappings] Failed to clear DB mappings:', error);
    }
  } catch (error) {
    console.error('[CalendarMappings] Failed to clear mappings:', error);
    throw error;
  }
}
