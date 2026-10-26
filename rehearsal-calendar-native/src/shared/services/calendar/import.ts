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
  clearAllImportedEvents,
  setImportedEventsCount,
  updateLastImportTime,
} from '../../utils/calendarStorage';
import { getAllMappings } from '../../utils/calendarMappings';
import { listDeviceCalendarIds } from './deviceCalendars';
import { MarkedEvent, ownMarkOf } from './ownMark';
import { availabilityAPI } from '../api';
import { logger } from '../../utils/logger';
import { formatDateToString } from '../../utils/time';
import { assertSession, sessionWork, SessionStamp } from '../session';


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
    const { byCalendar } = await fetchCalendarEvents(calendarIds, startDate, endDate);
    const events = [...byCalendar.values()].flat();
    logger.debug(`[CalendarSync] Total events fetched: ${events.length}`);
    return events;
  } catch (error) {
    logger.error('[CalendarSync] Failed to get calendar events:', error);
    throw error;
  }
}

/**
 * Reads the selected calendars one by one, reporting which could not be read.
 *
 * Carrying on past a failed calendar is right — the others still sync — but the
 * server has to be told, because "absent from what was read" is taken to mean
 * "no longer there". A calendar that failed to open (a revoked permission, an
 * account re-auth, a provider error) is named unreadable and keeps its rows.
 */
async function fetchCalendarEvents(
  calendarIds: string[],
  startDate: Date,
  endDate: Date
): Promise<{ byCalendar: Map<string, Calendar.Event[]>; failedCalendarIds: string[] }> {
  const hasPermission = await checkCalendarPermissions();
  if (!hasPermission) {
    throw new Error('Calendar permission not granted');
  }

  const byCalendar = new Map<string, Calendar.Event[]>();
  const failedCalendarIds: string[] = [];

  for (const calendarId of calendarIds) {
    try {
      const calendarEvents = await Calendar.getEventsAsync([calendarId], startDate, endDate);
      byCalendar.set(calendarId, calendarEvents);
      logger.debug(`[CalendarSync] Fetched ${calendarEvents.length} events from calendar ${calendarId}`);
    } catch (error) {
      logger.error(`[CalendarSync] Failed to fetch events from calendar ${calendarId}:`, error);
      failedCalendarIds.push(calendarId);
    }
  }

  return { byCalendar, failedCalendarIds };
}

/**
 * Every calendar on this device, so the server can tell one no longer chosen
 * here from one it has never heard of. If they cannot be listed, only the
 * chosen ones are named: nothing is cleared this time, which errs toward busy.
 */
async function deviceCalendarIds(chosen: string[]): Promise<string[]> {
  try {
    return [...new Set([...(await listDeviceCalendarIds()), ...chosen])];
  } catch (error) {
    logger.warn('[CalendarSync] Could not list the device calendars; nothing unchosen is cleared this run:', error);
    return [...chosen];
  }
}

/**
 * Helper: Convert calendar event to ISO timestamps
 * Handles all-day events specially (UTC midnight)
 */
function convertEventToTimestamps(event: Calendar.Event): { startsAt: string; endsAt: string } {
  if (event.allDay) {
    // A whole-day event stands for calendar dates rather than instants, so both
    // ends are written as UTC midnight of the local date — the form the server
    // stores and the availability screen reads. The dates of the window read
    // come from the same function, so the server compares like with like.
    const localDate = (value: string | Date): string =>
      formatDateToString(typeof value === 'string' ? new Date(value) : value);

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
 * One sync of this device's calendar import.
 *
 * Reads the chosen calendars and sends what each holds; the server reconciles
 * within the calendars this device names, in one transaction
 * (server/services/availability/importScope.js). It used to diff this phone's
 * events against every imported row of the person — from every device — and
 * delete what this phone did not have, so a sync on the second phone wiped what
 * the first had imported (EI01), and a moved occurrence went out as a separate
 * delete and add that could half-happen (EI04).
 *
 * Only hours cross over: a calendar's id is an opaque identifier the server
 * needs as the scope of its rows; titles, notes, places and links stay here.
 *
 * Returns: { success, failed, skipped, errors }. A calendar that could not be
 * read counts as failed, and the sync is then not stamped as done (EI02).
 */
export function importCalendarEventsToAvailability(
  calendarIds: string[],
  onProgress?: (current: number, total: number) => void,
  /**
   * The exported-rehearsal mappings, when the caller already holds them.
   *
   * The export needs the same list, so a sync fetched it twice — once here to
   * know which events are our own rehearsals and must not be imported as busy
   * time, once there to know which event belongs to which rehearsal.
   */
  knownMappings?: Record<string, { eventId: string; calendarId: string }>,
  /** The session of the work this is a step of; the current one otherwise. */
  session?: SessionStamp
): Promise<ImportResult> {
  // The session's work (ES01): the calendars were read for the person signed
  // in when it began, and their hours go to that person's account or nowhere.
  return sessionWork((stamp) => importForSession(stamp, calendarIds, onProgress, knownMappings), session);
}

async function importForSession(
  session: SessionStamp,
  calendarIds: string[],
  onProgress?: (current: number, total: number) => void,
  knownMappings?: Record<string, { eventId: string; calendarId: string }>
): Promise<ImportResult> {
  const result: ImportResult = { success: 0, failed: 0, skipped: 0, errors: [] };

  try {
    // Today to a year ahead: past events are irrelevant for planning.
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 365);

    const [{ byCalendar, failedCalendarIds }, device, exportedMappings] = await Promise.all([
      fetchCalendarEvents(calendarIds, startDate, endDate),
      deviceCalendarIds(calendarIds),
      knownMappings ? Promise.resolve(knownMappings) : getAllMappings(session),
    ]);

    // Our own rehearsals are left out, recognised two ways. An event we
    // exported carries the rehearsal it stands for in its URL, which means the
    // same thing on every device — whereas a mapping holds the event id, which
    // is local to the phone that made it. One written before the URL is
    // recognised by the app's signature in its notes — the export's own rule
    // (ownMark.ts) — and the mapping is still consulted as well.
    const exportedEventIds = new Set(Object.values(exportedMappings).map(m => m.eventId));
    const isOurRehearsal = (event: Calendar.Event) =>
      ownMarkOf(event as MarkedEvent) !== null || exportedEventIds.has(event.id);

    let total = 0;
    const calendars = [...byCalendar].map(([calendarId, events]) => {
      const keep = events.filter((event) => !isOurRehearsal(event));
      result.skipped += events.length - keep.length;
      // One row per occurrence key; a calendar that reports one twice keeps the first.
      const byKey = new Map<string, { key: string; startsAt: string; endsAt: string; isAllDay: boolean }>();
      for (const event of keep) {
        const key = occurrenceKey(event);
        if (!byKey.has(key)) byKey.set(key, { key, ...convertEventToTimestamps(event), isAllDay: event.allDay || false });
      }
      total += byKey.size;
      return { calendarId, events: [...byKey.values()] };
    });
    onProgress?.(0, total);

    assertSession(session);
    const response = await availabilityAPI.syncImported({
      source: Platform.OS === 'ios' ? 'apple_calendar' : 'google_calendar',
      // The instants read, and the local dates they cover — the server
      // compares whole days with the dates, never with the instants (R7-02).
      window: {
        from: startDate.toISOString(),
        to: endDate.toISOString(),
        firstDate: formatDateToString(startDate),
        lastDate: formatDateToString(new Date(endDate.getTime() - 1)),
      },
      deviceCalendars: device,
      unreadable: failedCalendarIds,
      calendars,
    }, session);
    const counts = response.data;
    result.success = (counts.added || 0) + (counts.updated || 0);
    result.skipped += counts.unchanged || 0;
    onProgress?.(total, total);
    assertSession(session);
    logger.info(`[CalendarSync] Synced: ${counts.added} added, ${counts.updated} updated, ${counts.removed} removed, ` +
      `${counts.adopted} adopted, ${counts.unchanged} unchanged`);

    await setImportedEventsCount(counts.held ?? 0);

    // A calendar that could not be read is not a successful sync: its rows are
    // kept as they were, and saying "synced just now" would be the lie (EI02).
    if (failedCalendarIds.length > 0) {
      result.failed += failedCalendarIds.length;
      result.errors.push(`${failedCalendarIds.length} calendar(s) could not be read`);
      logger.warn(`[CalendarSync] ${failedCalendarIds.length} calendar(s) could not be read - not marking as synced`);
    } else {
      await updateLastImportTime();
    }
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
export function removeAllImportedSlots(
  _onProgress?: (current: number, total: number) => void,
  session?: SessionStamp
): Promise<ImportResult> {
  return sessionWork((stamp) => removeImportedForSession(stamp), session);
}

async function removeImportedForSession(session: SessionStamp): Promise<ImportResult> {
  const result: ImportResult = { success: 0, failed: 0, skipped: 0, errors: [] };

  // The server holds every imported row, from every device. This used to ask
  // the phone's own record first and stop when it was empty — after a
  // reinstall, or on a second device — reporting success with the rows still
  // there (EI03).
  try {
    const response = await availabilityAPI.deleteAllImported(session);
    result.success = response.data?.deletedCount ?? 0;
    assertSession(session);
    await clearAllImportedEvents();
    logger.info(`[CalendarSync] Removed ${result.success} imported events`);
    return result;
  } catch (error: any) {
    logger.error('[CalendarSync] Failed to remove imported slots:', error);
    result.errors.push(error.message);
    throw error;
  }
}
