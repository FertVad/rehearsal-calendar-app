/**
 * Calendar Sync Service
 * Phase 1: Export rehearsals to device calendar
 * Phase 2: Import calendar events to availability
 */

import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import {
  DeviceCalendar,
  RehearsalWithProject,
  ImportResult,
  AvailabilitySlot,
} from '../types/calendar';
import {
  saveImportedEvent,
  getImportedEvents,
  getImportedEvent,
  removeImportedEvent,
  clearAllImportedEvents,
  updateLastImportTime,
  updateLastExportTime,
} from '../utils/calendarStorage';
import {
  saveEventMapping,
  getEventMapping,
  removeEventMapping,
  getAllMappings,
  clearAllMappings,
} from '../utils/calendarMappings';
import { availabilityAPI } from './api';

/**
 * ============================================================================
 * Permissions
 * ============================================================================
 */

/**
 * Request calendar permissions
 * Returns true if granted, false otherwise
 */
export async function requestCalendarPermissions(): Promise<boolean> {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    console.log('[CalendarSync] Permission status:', status);
    return status === 'granted';
  } catch (error) {
    console.error('[CalendarSync] Failed to request permissions:', error);
    return false;
  }
}

/**
 * Check if calendar permissions are granted
 */
export async function checkCalendarPermissions(): Promise<boolean> {
  try {
    const { status } = await Calendar.getCalendarPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('[CalendarSync] Failed to check permissions:', error);
    return false;
  }
}

/**
 * ============================================================================
 * Calendar Management
 * ============================================================================
 */

/**
 * Get list of writable calendars on device
 */
export async function getDeviceCalendars(): Promise<DeviceCalendar[]> {
  try {
    const hasPermission = await checkCalendarPermissions();
    if (!hasPermission) {
      console.log('[CalendarSync] No calendar permission');
      return [];
    }

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);

    // Filter to only writable calendars
    const writableCalendars = calendars.filter(cal => cal.allowsModifications);

    console.log(`[CalendarSync] Found ${writableCalendars.length} writable calendars`);
    return writableCalendars;
  } catch (error) {
    console.error('[CalendarSync] Failed to get calendars:', error);
    return [];
  }
}

/**
 * Get default calendar for platform
 * iOS: First writable calendar
 * Android: Primary calendar
 */
export async function getDefaultCalendar(): Promise<DeviceCalendar | null> {
  try {
    const calendars = await getDeviceCalendars();
    if (calendars.length === 0) return null;

    // Try to find primary calendar
    const primaryCalendar = calendars.find(cal => cal.isPrimary);
    if (primaryCalendar) return primaryCalendar;

    // Otherwise return first writable calendar
    return calendars[0];
  } catch (error) {
    console.error('[CalendarSync] Failed to get default calendar:', error);
    return null;
  }
}

/**
 * ============================================================================
 * Export Functions (App → Calendar)
 * ============================================================================
 */

/**
 * Check if event exists in calendar
 */
async function checkEventExists(eventId: string): Promise<boolean> {
  try {
    const event = await Calendar.getEventAsync(eventId);
    return event !== null && event !== undefined;
  } catch (error) {
    // Event doesn't exist or permission denied
    return false;
  }
}

/**
 * Find duplicate event in calendar by matching properties
 */
async function findDuplicateEvent(
  rehearsal: RehearsalWithProject,
  calendarId: string,
  startDate: Date,
  endDate: Date
): Promise<string | null> {
  try {
    // Search in a narrow time window (±1 day) for performance
    const searchStart = new Date(startDate);
    searchStart.setDate(searchStart.getDate() - 1);
    const searchEnd = new Date(endDate);
    searchEnd.setDate(searchEnd.getDate() + 1);

    const events = await Calendar.getEventsAsync([calendarId], searchStart, searchEnd);

    // Find event with matching properties
    const duplicateEvent = events.find(event => {
      const titleMatch = event.title === `Rehearsal: ${rehearsal.projectName}`;
      const startMatch = Math.abs(new Date(event.startDate).getTime() - startDate.getTime()) < 60000; // Within 1 minute
      const endMatch = Math.abs(new Date(event.endDate).getTime() - endDate.getTime()) < 60000;
      const locationMatch = event.location === (rehearsal.location || undefined);

      return titleMatch && startMatch && endMatch && locationMatch;
    });

    if (duplicateEvent) {
      console.log(`[CalendarSync] ⚠️ Found duplicate event: ${duplicateEvent.id}`);
      return duplicateEvent.id;
    }

    return null;
  } catch (error) {
    console.error('[CalendarSync] Error searching for duplicates:', error);
    return null;
  }
}

/**
 * Create calendar event from rehearsal
 * Includes duplicate detection to prevent multiple events for same rehearsal
 */
export async function createCalendarEvent(
  rehearsal: RehearsalWithProject,
  calendarId: string
): Promise<string | null> {
  try {
    const hasPermission = await checkCalendarPermissions();
    if (!hasPermission) {
      throw new Error('Calendar permission not granted');
    }

    const startDate = new Date(rehearsal.startsAt);
    const endDate = new Date(rehearsal.endsAt);

    // Check for duplicate events (prevents creating duplicates after AsyncStorage loss)
    const duplicateEventId = await findDuplicateEvent(rehearsal, calendarId, startDate, endDate);
    if (duplicateEventId) {
      console.log(`[CalendarSync] Using existing event ${duplicateEventId} instead of creating duplicate`);
      // Save mapping to existing event
      await saveEventMapping(rehearsal.id, duplicateEventId, calendarId);
      return duplicateEventId;
    }

    const eventDetails: Omit<Partial<Calendar.Event>, 'id' | 'organizer'> = {
      title: `Rehearsal: ${rehearsal.projectName}`,
      startDate,
      endDate,
      location: rehearsal.location || undefined,
      notes: `Project: ${rehearsal.projectName}\n\nCreated via Rehearsal Calendar app`,
      alarms: [
        {
          relativeOffset: -30, // 30 minutes before
          method: Calendar.AlarmMethod.ALERT,
        },
      ],
      availability: Calendar.Availability.BUSY,
    };

    console.log('[CalendarSync] Creating event:', eventDetails.title);
    const eventId = await Calendar.createEventAsync(calendarId, eventDetails);

    // Save mapping to database + AsyncStorage
    await saveEventMapping(rehearsal.id, eventId, calendarId);

    console.log(`[CalendarSync] Created event ${eventId} for rehearsal ${rehearsal.id}`);
    return eventId;
  } catch (error) {
    console.error('[CalendarSync] Failed to create event:', error);
    throw error;
  }
}

/**
 * Update existing calendar event
 */
export async function updateCalendarEvent(
  eventId: string,
  rehearsal: RehearsalWithProject
): Promise<void> {
  try {
    const hasPermission = await checkCalendarPermissions();
    if (!hasPermission) {
      throw new Error('Calendar permission not granted');
    }

    const eventDetails: Partial<Calendar.Event> = {
      title: `Rehearsal: ${rehearsal.projectName}`,
      startDate: new Date(rehearsal.startsAt),
      endDate: new Date(rehearsal.endsAt),
      location: rehearsal.location || undefined,
      notes: `Project: ${rehearsal.projectName}\n\nCreated via Rehearsal Calendar app`,
    };

    console.log('[CalendarSync] Updating event:', eventId);
    await Calendar.updateEventAsync(eventId, eventDetails);

    console.log(`[CalendarSync] Updated event ${eventId}`);
  } catch (error) {
    console.error('[CalendarSync] Failed to update event:', error);
    throw error;
  }
}

/**
 * Delete calendar event
 */
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  try {
    const hasPermission = await checkCalendarPermissions();
    if (!hasPermission) {
      throw new Error('Calendar permission not granted');
    }

    console.log('[CalendarSync] Deleting event:', eventId);
    await Calendar.deleteEventAsync(eventId);

    console.log(`[CalendarSync] Deleted event ${eventId}`);
  } catch (error) {
    console.error('[CalendarSync] Failed to delete event:', error);
    throw error;
  }
}

/**
 * Smart sync: Create or update calendar event for rehearsal
 * If rehearsal is already synced, update the event
 * Otherwise, create new event
 * Includes recovery logic for deleted events
 */
export async function syncRehearsalToCalendar(
  rehearsal: RehearsalWithProject,
  calendarId: string
): Promise<void> {
  try {
    // Check if already synced
    const mapping = await getEventMapping(rehearsal.id);

    if (mapping) {
      // Check if event still exists in calendar
      const eventExists = await checkEventExists(mapping.eventId);

      if (eventExists) {
        // Update existing event
        console.log(`[CalendarSync] Rehearsal ${rehearsal.id} already synced, updating...`);
        try {
          await updateCalendarEvent(mapping.eventId, rehearsal);
          // Update lastSynced timestamp
          await saveEventMapping(rehearsal.id, mapping.eventId, mapping.calendarId);
        } catch (error) {
          // Update failed, event might be deleted - recreate
          console.warn(`[CalendarSync] ⚠️ Update failed for event ${mapping.eventId}, recreating...`);
          await removeEventMapping(rehearsal.id);
          await createCalendarEvent(rehearsal, calendarId);
        }
      } else {
        // Event was deleted from calendar - recreate and update mapping
        console.warn(`[CalendarSync] ⚠️ Event ${mapping.eventId} no longer exists, recreating...`);
        await removeEventMapping(rehearsal.id);
        await createCalendarEvent(rehearsal, calendarId);
      }
    } else {
      // Create new event
      console.log(`[CalendarSync] Rehearsal ${rehearsal.id} not synced, creating...`);
      await createCalendarEvent(rehearsal, calendarId);
    }

    await updateLastExportTime();
  } catch (error) {
    console.error('[CalendarSync] Failed to sync rehearsal:', error);
    throw error;
  }
}

/**
 * Unsync rehearsal (remove from calendar)
 */
export async function unsyncRehearsal(rehearsalId: string): Promise<void> {
  try {
    const mapping = await getEventMapping(rehearsalId);
    if (!mapping) {
      console.log(`[CalendarSync] Rehearsal ${rehearsalId} not synced, nothing to do`);
      return;
    }

    // Delete calendar event
    await deleteCalendarEvent(mapping.eventId);

    // Remove mapping
    await removeEventMapping(rehearsalId);

    console.log(`[CalendarSync] Unsynced rehearsal ${rehearsalId}`);
  } catch (error) {
    console.error('[CalendarSync] Failed to unsync rehearsal:', error);
    throw error;
  }
}

/**
 * Export all rehearsals to calendar
 * Returns: { success: number, failed: number, errors: string[] }
 */
export interface BatchSyncResult {
  success: number;
  failed: number;
  errors: string[];
}

export async function syncAllRehearsals(
  rehearsals: RehearsalWithProject[],
  calendarId: string,
  onProgress?: (current: number, total: number) => void
): Promise<BatchSyncResult> {
  const result: BatchSyncResult = {
    success: 0,
    failed: 0,
    errors: [],
  };

  const total = rehearsals.length;
  const BATCH_SIZE = 10; // Process 10 rehearsals in parallel

  // Process in batches for better performance
  for (let i = 0; i < rehearsals.length; i += BATCH_SIZE) {
    const batch = rehearsals.slice(i, i + BATCH_SIZE);

    // Process batch in parallel
    const results = await Promise.allSettled(
      batch.map(rehearsal => syncRehearsalToCalendar(rehearsal, calendarId))
    );

    // Collect results
    results.forEach((res, idx) => {
      const rehearsal = batch[idx];
      if (res.status === 'fulfilled') {
        result.success++;
      } else {
        result.failed++;
        result.errors.push(`${rehearsal.projectName}: ${res.reason?.message || 'Unknown error'}`);
        console.error(`[CalendarSync] Failed to sync rehearsal ${rehearsal.id}:`, res.reason);
      }
    });

    // Report progress
    if (onProgress) {
      onProgress(Math.min(i + batch.length, total), total);
    }
  }

  await updateLastExportTime();

  console.log(`[CalendarSync] Batch sync complete: ${result.success} success, ${result.failed} failed`);
  return result;
}

/**
 * Remove all exported events from calendar
 * Uses database mappings as source of truth
 */
export async function removeAllExportedEvents(
  onProgress?: (current: number, total: number) => void
): Promise<BatchSyncResult> {
  try {
    // Get mappings from database (primary) or AsyncStorage (fallback)
    const mappings = await getAllMappings();
    const rehearsalIds = Object.keys(mappings);

    const result: BatchSyncResult = {
      success: 0,
      failed: 0,
      errors: [],
    };

    const total = rehearsalIds.length;
    const BATCH_SIZE = 10; // Delete 10 events in parallel

    console.log(`[CalendarSync] Removing ${total} exported events...`);

    // Process in batches for better performance
    for (let i = 0; i < rehearsalIds.length; i += BATCH_SIZE) {
      const batchIds = rehearsalIds.slice(i, i + BATCH_SIZE);

      // Delete batch in parallel
      const results = await Promise.allSettled(
        batchIds.map(async rehearsalId => {
          const eventId = mappings[rehearsalId].eventId;
          // Try to delete event from calendar
          await deleteCalendarEvent(eventId);
          // Remove mapping from DB + AsyncStorage
          await removeEventMapping(rehearsalId);
        })
      );

      // Collect results
      results.forEach((res, idx) => {
        const rehearsalId = batchIds[idx];
        const mapping = mappings[rehearsalId];
        if (res.status === 'fulfilled') {
          result.success++;
        } else {
          result.failed++;
          result.errors.push(`Event ${mapping.eventId}: ${res.reason?.message || 'Unknown error'}`);
          console.error(`[CalendarSync] Failed to delete event ${mapping.eventId}:`, res.reason);
        }
      });

      // Report progress
      if (onProgress) {
        onProgress(Math.min(i + batchIds.length, total), total);
      }
    }

    // Clear all remaining mappings (in case some deletions failed)
    await clearAllMappings();

    console.log(`[CalendarSync] Remove all complete: ${result.success} success, ${result.failed} failed`);
    return result;
  } catch (error) {
    console.error('[CalendarSync] Failed to remove all events:', error);
    throw error;
  }
}

/**
 * ============================================================================
 * Import Functions (Calendar → App)
 * Phase 2: Import calendar events as availability slots
 * ============================================================================
 */

/**
 * Get calendar events from selected calendars
 * Date range: -30 days to +365 days (to avoid performance issues)
 */
export async function getCalendarEvents(
  calendarIds: string[],
  startDate: Date,
  endDate: Date
): Promise<Calendar.Event[]> {
  try {
    const hasPermission = await checkCalendarPermissions();
    if (!hasPermission) {
      throw new Error('Calendar permission not granted');
    }

    // Log all available calendars for debugging
    console.log('=== CALENDAR IMPORT DEBUG ===');
    const allCalendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    console.log(`[CalendarSync] Total calendars on device: ${allCalendars.length}`);
    allCalendars.forEach(cal => {
      console.log(`  - ${cal.title} (ID: ${cal.id}, source: ${cal.source?.name || 'unknown'})`);
    });
    console.log(`[CalendarSync] Selected calendars for import: ${calendarIds.length}`);
    calendarIds.forEach(id => {
      const cal = allCalendars.find(c => c.id === id);
      console.log(`  - ${cal?.title || 'Unknown'} (ID: ${id})`);
    });
    console.log(`[CalendarSync] Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    let allEvents: Calendar.Event[] = [];

    for (const calendarId of calendarIds) {
      try {
        const events = await Calendar.getEventsAsync(
          [calendarId],
          startDate,
          endDate
        );
        allEvents = allEvents.concat(events);
        console.log(`[CalendarSync] Fetched ${events.length} events from calendar ${calendarId}`);

        // Log details of each event
        events.forEach((event, index) => {
          console.log(`  Event ${index + 1}: "${event.title}" (ID: ${event.id})`);
          console.log(`    Start: ${event.startDate}, End: ${event.endDate}`);
          console.log(`    AllDay: ${event.allDay}, Calendar: ${event.calendarId}`);
        });
      } catch (error) {
        console.error(`[CalendarSync] Failed to fetch events from calendar ${calendarId}:`, error);
        // Continue with other calendars
      }
    }

    console.log(`[CalendarSync] Total events fetched: ${allEvents.length}`);
    console.log('=== END CALENDAR IMPORT DEBUG ===');
    return allEvents;
  } catch (error) {
    console.error('[CalendarSync] Failed to get calendar events:', error);
    throw error;
  }
}

/**
 * Helper: Convert calendar event to ISO timestamps
 * Handles all-day events specially (UTC midnight)
 */
function convertEventToTimestamps(event: Calendar.Event): { startsAt: string; endsAt: string } {
  if (event.allDay) {
    // For all-day events, use UTC midnight to avoid timezone issues
    const eventStartDate = typeof event.startDate === 'string'
      ? new Date(event.startDate)
      : event.startDate;

    const year = eventStartDate.getFullYear();
    const month = String(eventStartDate.getMonth() + 1).padStart(2, '0');
    const day = String(eventStartDate.getDate()).padStart(2, '0');

    return {
      startsAt: `${year}-${month}-${day}T00:00:00.000Z`,
      endsAt: `${year}-${month}-${day}T23:59:59.999Z`,
    };
  } else {
    // Regular events - use standard ISO conversion
    const startsAt = typeof event.startDate === 'string'
      ? new Date(event.startDate).toISOString()
      : event.startDate.toISOString();
    const endsAt = typeof event.endDate === 'string'
      ? new Date(event.endDate).toISOString()
      : event.endDate.toISOString();

    return { startsAt, endsAt };
  }
}

/**
 * Full calendar sync: Import/Update/Delete calendar events as availability slots
 * - Adds new events
 * - Updates changed events (time, title)
 * - Deletes events removed from calendar
 * Returns: { success, failed, skipped, errors }
 */
export async function importCalendarEventsToAvailability(
  calendarIds: string[],
  onProgress?: (current: number, total: number) => void
): Promise<ImportResult> {
  const result: ImportResult = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Define date range: today to +365 days (future only)
    // Past events are irrelevant for availability planning
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0); // Start of today
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 365);

    console.log(`[CalendarSync] Syncing events from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // 1. Fetch current state (parallel for performance)
    const [events, dbResponse, exportedMappings] = await Promise.all([
      getCalendarEvents(calendarIds, startDate, endDate),
      availabilityAPI.getAll(),
      getAllMappings(),
    ]);

    console.log('[CalendarSync] API response structure check:', {
      hasData: !!dbResponse.data,
      hasAvailability: !!(dbResponse.data.availability || dbResponse.data),
      firstSlot: (dbResponse.data.availability || dbResponse.data || [])[0],
    });

    const total = events.length;
    console.log(`[CalendarSync] Found ${total} events in calendar`);
    if (events.length > 0) {
      console.log('[CalendarSync] Sample calendar events:', events.slice(0, 3).map(e => ({
        id: e.id,
        title: e.title,
        calendarId: e.calendarId,
      })));
    }

    // 2. Build lookup maps for fast comparison
    const exportedEventIds = new Set(
      Object.values(exportedMappings).map(m => m.eventId)
    );
    console.log(`[CalendarSync] Excluding ${exportedEventIds.size} exported rehearsals`);
    if (exportedEventIds.size > 0) {
      console.log('[CalendarSync] Exported event IDs:', Array.from(exportedEventIds).slice(0, 5));
    }

    // Get only imported calendar events (not manual, not rehearsals) within date range
    const dbSlots = (dbResponse.data.availability || dbResponse.data || []).filter((slot: any) => {
      const extId = slot.externalEventId || slot.external_event_id;
      const hasExternalId = !!extId;
      const isImported = slot.source === 'apple_calendar' || slot.source === 'google_calendar';
      const inRange = new Date(slot.startsAt) >= startDate && new Date(slot.startsAt) <= endDate;

      return hasExternalId && isImported && inRange;
    });
    console.log(`[CalendarSync] Found ${dbSlots.length} imported events in DB (within date range)`);
    if (dbSlots.length > 0) {
      console.log('[CalendarSync] Sample DB slots:', dbSlots.slice(0, 3).map((s: any) => ({
        id: s.id,
        extId: s.externalEventId || s.external_event_id,
        title: s.title,
        source: s.source,
      })));
    }

    // Map: external_event_id -> DB slot
    const dbEventMap = new Map(
      dbSlots.map((slot: any) => [slot.externalEventId || slot.external_event_id, slot])
    );

    // Map: event.id -> calendar event
    const calendarEventMap = new Map(
      events
        .filter(e => !exportedEventIds.has(e.id)) // Exclude exported rehearsals
        .map(e => [e.id, e])
    );

    // 3. Find changes
    const toDelete: string[] = []; // Event IDs to delete
    const toUpdate: any[] = []; // Events to update
    const toAdd: any[] = []; // Events to add

    console.log(`[CalendarSync] Comparison data:`, {
      dbEventMapSize: dbEventMap.size,
      calendarEventMapSize: calendarEventMap.size,
      exportedEventIdsSize: exportedEventIds.size,
    });

    // Find deleted events (in DB but not in calendar)
    for (const [eventId, dbSlot] of dbEventMap) {
      const id = eventId as string;
      const inCalendar = calendarEventMap.has(id);
      const isExported = exportedEventIds.has(id);

      if (!inCalendar && !isExported) {
        console.log(`[CalendarSync] ✓ Marking for deletion: ${id} (${(dbSlot as any).title})`);
        toDelete.push(id);
      }
    }

    if (toDelete.length > 0) {
      console.log(`[CalendarSync] Events to delete:`, toDelete);
    }

    // Find new/updated events
    for (const event of events) {
      // Skip exported rehearsals
      if (exportedEventIds.has(event.id)) {
        result.skipped++;
        continue;
      }

      const dbSlot = dbEventMap.get(event.id) as any;

      if (!dbSlot) {
        // New event
        toAdd.push(event);
      } else {
        // Check if changed (time or title)
        const { startsAt: eventStart, endsAt: eventEnd } = convertEventToTimestamps(event);

        const hasChanged =
          (dbSlot.startsAt || dbSlot.starts_at) !== eventStart ||
          (dbSlot.endsAt || dbSlot.ends_at) !== eventEnd ||
          dbSlot.title !== (event.title || 'Calendar Event') ||
          (dbSlot.isAllDay || dbSlot.is_all_day) !== (event.allDay || false);

        if (hasChanged) {
          toUpdate.push(event);
        } else {
          result.skipped++;
        }
      }
    }

    console.log(`[CalendarSync] Changes: ${toAdd.length} to add, ${toUpdate.length} to update, ${toDelete.length} to delete, ${result.skipped} unchanged`);

    // 4. Early exit if no changes
    if (toDelete.length === 0 && toUpdate.length === 0 && toAdd.length === 0) {
      console.log('[CalendarSync] No changes detected, sync complete');
      await updateLastImportTime();
      return result;
    }

    // 5. Apply changes (parallel operations for performance)
    const operations = [];

    // Delete removed events
    if (toDelete.length > 0) {
      console.log(`[CalendarSync] Starting delete operation for ${toDelete.length} events:`, toDelete);
      operations.push(
        availabilityAPI.batchDeleteImported(toDelete)
          .then((response) => {
            console.log(`[CalendarSync] ✓ Delete API response:`, response);
            console.log(`[CalendarSync] ✓ Deleted ${toDelete.length} events`);
            // Remove from AsyncStorage tracking
            return Promise.all(toDelete.map(id => removeImportedEvent(id)));
          })
          .catch((error: any) => {
            console.error('[CalendarSync] Failed to delete events:', error);
            console.error('[CalendarSync] Delete error details:', {
              message: error.message,
              response: error.response?.data,
              status: error.response?.status,
            });
            result.failed += toDelete.length;
            result.errors.push(`Delete failed: ${error.message}`);
          })
      );
    } else {
      console.log('[CalendarSync] No events to delete');
    }

    // Update changed events
    if (toUpdate.length > 0) {
      const updates = toUpdate.map(event => {
        const { startsAt, endsAt } = convertEventToTimestamps(event);
        return {
          externalEventId: event.id,
          startsAt,
          endsAt,
          title: event.title || 'Calendar Event',
          isAllDay: event.allDay || false,
        };
      });

      operations.push(
        availabilityAPI.batchUpdateImported(updates)
          .then(() => {
            console.log(`[CalendarSync] ✓ Updated ${updates.length} events`);
            result.success += updates.length;
          })
          .catch((error: any) => {
            console.error('[CalendarSync] Failed to update events:', error);
            result.failed += updates.length;
            result.errors.push(`Update failed: ${error.message}`);
          })
      );
    }

    // Add new events
    if (toAdd.length > 0) {
      const slotsToAdd = toAdd.map(event => {
        const { startsAt, endsAt } = convertEventToTimestamps(event);
        return {
          startsAt,
          endsAt,
          type: 'busy' as const,
          isAllDay: event.allDay || false,
          source: Platform.OS === 'ios' ? 'apple_calendar' : 'google_calendar',
          external_event_id: event.id,
          title: event.title || 'Calendar Event',
          eventId: event.id,
          calendarId: event.calendarId,
        };
      });

      // Split into chunks of 50
      const chunkSize = 50;
      for (let i = 0; i < slotsToAdd.length; i += chunkSize) {
        const chunk = slotsToAdd.slice(i, i + chunkSize);

        operations.push(
          availabilityAPI.bulkSet(chunk as any)
            .then(async () => {
              // Save import tracking
              await Promise.all(chunk.map(slot =>
                saveImportedEvent(slot.eventId, slot.eventId, slot.calendarId)
              ));
              result.success += chunk.length;
              console.log(`[CalendarSync] ✓ Added ${chunk.length} events`);
            })
            .catch((error: any) => {
              console.error('[CalendarSync] Failed to add events:', error);
              result.failed += chunk.length;
              result.errors.push(`Add failed: ${error.message}`);
            })
        );
      }
    }

    // Wait for all operations to complete
    await Promise.all(operations);

    // Update last import time
    await updateLastImportTime();

    console.log(`[CalendarSync] Import complete: ${result.success} success, ${result.failed} failed, ${result.skipped} skipped`);
    return result;
  } catch (error: any) {
    console.error('[CalendarSync] Failed to import calendar events:', error);
    result.errors.push(error.message);
    throw error;
  }
}

/**
 * Remove all imported availability slots
 */
export async function removeAllImportedSlots(
  onProgress?: (current: number, total: number) => void
): Promise<ImportResult> {
  const result: ImportResult = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  try {
    const importedEvents = await getImportedEvents();
    const eventIds = Object.keys(importedEvents);
    const total = eventIds.length;

    if (total === 0) {
      console.log('[CalendarSync] No imported events to remove');
      return result;
    }

    console.log(`[CalendarSync] Removing ${total} imported events from database...`);

    // Delete all imported calendar events from database
    try {
      const response = await availabilityAPI.deleteAllImported();
      console.log(`[CalendarSync] ✓ Deleted from database:`, response.data);
    } catch (apiError: any) {
      console.error('[CalendarSync] Failed to delete from database:', apiError);
      result.errors.push(`Database deletion failed: ${apiError.message}`);
      result.failed = total;
      throw apiError;
    }

    // Clear all import tracking from AsyncStorage
    await clearAllImportedEvents();

    result.success = total;
    console.log(`[CalendarSync] ✓ Cleared ${total} imported events (database + tracking)`);
    return result;
  } catch (error: any) {
    console.error('[CalendarSync] Failed to remove imported slots:', error);
    result.errors.push(error.message);
    throw error;
  }
}
