/**
 * Calendar Import Module
 * Handles importing calendar events as availability slots
 *
 * Only the time span of an event ever leaves the device. Titles stay on the
 * phone: what the app needs is "this person is busy from X to Y", and the
 * server has no use for "Dentist" or "Flight to Berlin". The stored title is a
 * fixed placeholder — it is never displayed anywhere in the UI.
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
 * Placeholder stored in place of the real event title. Constant on purpose —
 * imported slots are rendered as plain busy blocks, so nothing reads it.
 */
const IMPORTED_SLOT_TITLE = 'Calendar Event';

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
    const { events } = await fetchCalendarEvents(calendarIds, startDate, endDate);
    logger.debug(`[CalendarSync] Total events fetched: ${events.length}`);
    return events;
  } catch (error) {
    logger.error('[CalendarSync] Failed to get calendar events:', error);
    throw error;
  }
}

/**
 * Reads the selected calendars, reporting which ones could not be read.
 *
 * Carrying on past a failed calendar is right — the others still sync — but the
 * caller has to know, because the diff reads "absent from the calendar" as "the
 * user deleted it". Without this, one calendar failing to open (a revoked
 * permission, an account re-auth, a transient provider error) silently deleted
 * every slot imported from it, and if the permission stayed revoked they never
 * came back.
 */
async function fetchCalendarEvents(
  calendarIds: string[],
  startDate: Date,
  endDate: Date
): Promise<{ events: Calendar.Event[]; failedCalendarIds: string[] }> {
  const hasPermission = await checkCalendarPermissions();
  if (!hasPermission) {
    throw new Error('Calendar permission not granted');
  }

  let events: Calendar.Event[] = [];
  const failedCalendarIds: string[] = [];

  for (const calendarId of calendarIds) {
    try {
      const calendarEvents = await Calendar.getEventsAsync([calendarId], startDate, endDate);
      events = events.concat(calendarEvents);
      logger.debug(`[CalendarSync] Fetched ${calendarEvents.length} events from calendar ${calendarId}`);
    } catch (error) {
      logger.error(`[CalendarSync] Failed to fetch events from calendar ${calendarId}:`, error);
      failedCalendarIds.push(calendarId);
    }
  }

  return { events, failedCalendarIds };
}

/**
 * Helper: Convert calendar event to ISO timestamps
 * Handles all-day events specially (UTC midnight)
 */
function convertEventToTimestamps(event: Calendar.Event): { startsAt: string; endsAt: string } {
  if (event.allDay) {
    // A whole-day event stands for calendar dates rather than instants, so both
    // ends are written as UTC midnight of the local date — the form the server
    // stores and the availability screen reads.
    const localDate = (value: string | Date): string => {
      const d = typeof value === 'string' ? new Date(value) : value;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const firstDate = localDate(event.startDate);

    // endDate used to be ignored outright, both ends coming from startDate, so
    // a fortnight's holiday blocked one day and left the other thirteen reading
    // free. Backing off a millisecond lands on the last covered day under
    // either convention — an exclusive end at the following midnight, or an
    // inclusive one at 23:59:59.
    const rawEnd = typeof event.endDate === 'string' ? new Date(event.endDate) : event.endDate;
    const lastDate = rawEnd ? localDate(new Date(rawEnd.getTime() - 1)) : firstDate;

    return {
      startsAt: `${firstDate}T00:00:00.000Z`,
      endsAt: `${lastDate < firstDate ? firstDate : lastDate}T23:59:59.999Z`,
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
 * The key one imported slot is stored under.
 *
 * Occurrences of a recurring event all carry the *series* id — expo-calendar
 * says so outright, on both platforms — and one row per key is permitted. So a
 * weekly class pushed fifty-two occurrences at the server and left one row
 * standing: every other week read free, and which week was blocked wandered
 * between syncs as the surviving row was rewritten. Pinning the occurrence by
 * the instant it starts gives each its own row.
 *
 * A one-off event keeps its plain id, so existing rows keep their keys and an
 * edit still updates in place rather than churning through delete-and-add.
 */
function occurrenceKey(event: Calendar.Event): string {
  if (!event.recurrenceRule) return event.id;
  const { startsAt } = convertEventToTimestamps(event);
  return `${event.id}:${startsAt}`;
}

/**
 * Full calendar sync: Import/Update/Delete calendar events as availability slots
 * - Adds new events
 * - Updates changed events (time only)
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

    logger.info(`[CalendarSync] Syncing events from ${startDate.toLocaleDateString('ru-RU')} to ${endDate.toLocaleDateString('ru-RU')}`);
    logger.info(`[CalendarSync] Importing from ${calendarIds.length} calendars`);

    // 1. Fetch current state (parallel for performance)
    const [{ events, failedCalendarIds }, dbResponse, exportedMappings] = await Promise.all([
      fetchCalendarEvents(calendarIds, startDate, endDate),
      availabilityAPI.getAll(),
      getAllMappings(),
    ]);

    logger.debug('[CalendarSync] API response structure check:', {
      hasData: !!dbResponse.data,
      hasAvailability: !!(dbResponse.data.availability || dbResponse.data),
      firstSlot: (dbResponse.data.availability || dbResponse.data || [])[0],
    });

    const total = events.length;
    logger.info(`[CalendarSync] Found ${total} events in selected calendars`);

    // 2. Build lookup maps for fast comparison
    const exportedEventIds = new Set(
      Object.values(exportedMappings).map(m => m.eventId)
    );
    logger.info(`[CalendarSync] Excluding ${exportedEventIds.size} exported rehearsals`);

    // Count events to process
    const eventsToProcess = events.filter(e => !exportedEventIds.has(e.id));
    logger.info(`[CalendarSync] Events to process (non-rehearsal): ${eventsToProcess.length}`);

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
        source: s.source,
      })));
    }

    // Map: external_event_id -> DB slot
    const dbEventMap = new Map(
      dbSlots.map((slot: any) => [slot.externalEventId || slot.external_event_id, slot])
    );

    // Map: stored key -> calendar event. Keyed per occurrence, so a recurring
    // series contributes one entry per date rather than collapsing to one.
    // The exported-rehearsal exclusion still compares the bare id — those are
    // one-off events we created ourselves.
    const calendarEventMap = new Map(
      events
        .filter(e => !exportedEventIds.has(e.id)) // Exclude exported rehearsals
        .map(e => [occurrenceKey(e), e])
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

    // Find deleted events (in DB but not in calendar).
    //
    // Only when every selected calendar was actually read. "Absent from the
    // calendar" is being taken to mean "the user deleted it", and a calendar
    // that failed to open produces exactly the same absence — so one hiccup on
    // the work calendar used to wipe the whole work schedule out of everyone's
    // planner, permanently if the permission stayed revoked. Skipping the pass
    // leaves stale rows until the next healthy sync, which is the harmless
    // direction: too busy rather than too free.
    if (failedCalendarIds.length > 0) {
      logger.warn(
        `[CalendarSync] ${failedCalendarIds.length} calendar(s) could not be read; skipping the delete pass this run`
      );
    } else {
      for (const [eventId] of dbEventMap) {
        const id = eventId as string;
        const inCalendar = calendarEventMap.has(id);
        const isExported = exportedEventIds.has(id);

        if (!inCalendar && !isExported) {
          logger.debug(`[CalendarSync] Marking for deletion: ${id}`);
          toDelete.push(id);
        }
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

      const dbSlot = dbEventMap.get(occurrenceKey(event)) as any;

      if (!dbSlot) {
        // New event
        toAdd.push(event);
      } else {
        // Changed means the time span moved; the title is a constant now.
        const { startsAt: eventStart, endsAt: eventEnd } = convertEventToTimestamps(event);

        const hasChanged =
          (dbSlot.startsAt || dbSlot.starts_at) !== eventStart ||
          (dbSlot.endsAt || dbSlot.ends_at) !== eventEnd ||
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
          externalEventId: occurrenceKey(event),
          startsAt,
          endsAt,
          title: IMPORTED_SLOT_TITLE,
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
          external_event_id: occurrenceKey(event),
          title: IMPORTED_SLOT_TITLE,
          eventId: occurrenceKey(event),
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
