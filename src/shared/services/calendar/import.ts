/**
 * Calendar Import Module
 * Handles importing calendar events as availability slots
 */

import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import { ImportResult } from '../../types/calendar';
import { checkCalendarPermissions } from './permissions';
import {
  saveImportedEvent,
  removeImportedEvent,
  getImportedEvents,
  clearAllImportedEvents,
  updateLastImportTime,
} from '../../utils/calendarStorage';
import { getAllMappings } from '../../utils/calendarMappings';
import { availabilityAPI } from '../api';
import { logger } from '../../utils/logger';

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
    logger.debug('=== CALENDAR IMPORT DEBUG ===');
    const allCalendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    logger.debug(`[CalendarSync] Total calendars on device: ${allCalendars.length}`);
    allCalendars.forEach(cal => {
      logger.debug(`  - ${cal.title} (ID: ${cal.id}, source: ${cal.source?.name || 'unknown'})`);
    });
    logger.debug(`[CalendarSync] Selected calendars for import: ${calendarIds.length}`);
    calendarIds.forEach(id => {
      const cal = allCalendars.find(c => c.id === id);
      logger.debug(`  - ${cal?.title || 'Unknown'} (ID: ${id})`);
    });
    logger.debug(`[CalendarSync] Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    let allEvents: Calendar.Event[] = [];

    for (const calendarId of calendarIds) {
      try {
        const events = await Calendar.getEventsAsync(
          [calendarId],
          startDate,
          endDate
        );
        allEvents = allEvents.concat(events);
        logger.debug(`[CalendarSync] Fetched ${events.length} events from calendar ${calendarId}`);

        // Log details of each event
        events.forEach((event, index) => {
          logger.debug(`  Event ${index + 1}: "${event.title}" (ID: ${event.id})`);
          logger.debug(`    Start: ${event.startDate}, End: ${event.endDate}`);
          logger.debug(`    AllDay: ${event.allDay}, Calendar: ${event.calendarId}`);
        });
      } catch (error) {
        logger.error(`[CalendarSync] Failed to fetch events from calendar ${calendarId}:`, error);
        // Continue with other calendars
      }
    }

    logger.debug(`[CalendarSync] Total events fetched: ${allEvents.length}`);
    logger.debug('=== END CALENDAR IMPORT DEBUG ===');
    return allEvents;
  } catch (error) {
    logger.error('[CalendarSync] Failed to get calendar events:', error);
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

    logger.info(`[CalendarSync] Syncing events from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // 1. Fetch current state (parallel for performance)
    const [events, dbResponse, exportedMappings] = await Promise.all([
      getCalendarEvents(calendarIds, startDate, endDate),
      availabilityAPI.getAll(),
      getAllMappings(),
    ]);

    logger.debug('[CalendarSync] API response structure check:', {
      hasData: !!dbResponse.data,
      hasAvailability: !!(dbResponse.data.availability || dbResponse.data),
      firstSlot: (dbResponse.data.availability || dbResponse.data || [])[0],
    });

    const total = events.length;
    logger.info(`[CalendarSync] Found ${total} events in calendar`);
    if (events.length > 0) {
      logger.debug('[CalendarSync] Sample calendar events:', events.slice(0, 3).map(e => ({
        id: e.id,
        title: e.title,
        calendarId: e.calendarId,
      })));
    }

    // 2. Build lookup maps for fast comparison
    const exportedEventIds = new Set(
      Object.values(exportedMappings).map(m => m.eventId)
    );
    logger.info(`[CalendarSync] Excluding ${exportedEventIds.size} exported rehearsals`);
    if (exportedEventIds.size > 0) {
      logger.debug('[CalendarSync] Exported event IDs:', Array.from(exportedEventIds).slice(0, 5));
    }

    // Get only imported calendar events (not manual, not rehearsals) within date range
    const dbSlots = (dbResponse.data.availability || dbResponse.data || []).filter((slot: any) => {
      const extId = slot.externalEventId || slot.external_event_id;
      const hasExternalId = !!extId;
      const isImported = slot.source === 'apple_calendar' || slot.source === 'google_calendar';
      const inRange = new Date(slot.startsAt) >= startDate && new Date(slot.startsAt) <= endDate;

      return hasExternalId && isImported && inRange;
    });
    logger.info(`[CalendarSync] Found ${dbSlots.length} imported events in DB (within date range)`);
    if (dbSlots.length > 0) {
      logger.debug('[CalendarSync] Sample DB slots:', dbSlots.slice(0, 3).map((s: any) => ({
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

    logger.debug(`[CalendarSync] Comparison data:`, {
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
        logger.debug(`[CalendarSync] Marking for deletion: ${id} (${(dbSlot as any).title})`);
        toDelete.push(id);
      }
    }

    if (toDelete.length > 0) {
      logger.debug(`[CalendarSync] Events to delete:`, toDelete);
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

    logger.info(`[CalendarSync] Changes: ${toAdd.length} to add, ${toUpdate.length} to update, ${toDelete.length} to delete, ${result.skipped} unchanged`);

    // 4. Early exit if no changes
    if (toDelete.length === 0 && toUpdate.length === 0 && toAdd.length === 0) {
      logger.info('[CalendarSync] No changes detected, sync complete');
      await updateLastImportTime();
      return result;
    }

    // 5. Apply changes (parallel operations for performance)
    const operations = [];

    // Delete removed events
    if (toDelete.length > 0) {
      logger.info(`[CalendarSync] Starting delete operation for ${toDelete.length} events:`, toDelete);
      operations.push(
        availabilityAPI.batchDeleteImported(toDelete)
          .then((response) => {
            logger.info(`[CalendarSync] Delete API response:`, response);
            logger.info(`[CalendarSync] Deleted ${toDelete.length} events`);
            // Remove from AsyncStorage tracking
            return Promise.all(toDelete.map(id => removeImportedEvent(id)));
          })
          .catch((error: any) => {
            logger.error('[CalendarSync] Failed to delete events:', error);
            logger.error('[CalendarSync] Delete error details:', {
              message: error.message,
              response: error.response?.data,
              status: error.response?.status,
            });
            result.failed += toDelete.length;
            result.errors.push(`Delete failed: ${error.message}`);
          })
      );
    } else {
      logger.info('[CalendarSync] No events to delete');
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
            logger.info(`[CalendarSync] Updated ${updates.length} events`);
            result.success += updates.length;
          })
          .catch((error: any) => {
            logger.error('[CalendarSync] Failed to update events:', error);
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
              logger.info(`[CalendarSync] Added ${chunk.length} events`);
            })
            .catch((error: any) => {
              logger.error('[CalendarSync] Failed to add events:', error);
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

    logger.info(`[CalendarSync] Import complete: ${result.success} success, ${result.failed} failed, ${result.skipped} skipped`);
    return result;
  } catch (error: any) {
    logger.error('[CalendarSync] Failed to import calendar events:', error);
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
      logger.info('[CalendarSync] No imported events to remove');
      return result;
    }

    logger.info(`[CalendarSync] Removing ${total} imported events from database...`);

    // Delete all imported calendar events from database
    try {
      const response = await availabilityAPI.deleteAllImported();
      logger.info(`[CalendarSync] Deleted from database:`, response.data);
    } catch (apiError: any) {
      logger.error('[CalendarSync] Failed to delete from database:', apiError);
      result.errors.push(`Database deletion failed: ${apiError.message}`);
      result.failed = total;
      throw apiError;
    }

    // Clear all import tracking from AsyncStorage
    await clearAllImportedEvents();

    result.success = total;
    logger.info(`[CalendarSync] Cleared ${total} imported events (database + tracking)`);
    return result;
  } catch (error: any) {
    logger.error('[CalendarSync] Failed to remove imported slots:', error);
    result.errors.push(error.message);
    throw error;
  }
}
