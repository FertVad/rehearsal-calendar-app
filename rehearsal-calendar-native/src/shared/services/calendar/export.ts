/**
 * Calendar Export Module
 * Handles exporting rehearsals to device calendar
 */

import * as Calendar from 'expo-calendar';
import { RehearsalWithProject, BatchSyncResult } from '../../types/calendar';
import { checkCalendarPermissions } from './permissions';
import {
  saveEventMapping,
  getEventMapping,
  removeEventMapping,
  getAllMappings,
} from '../../utils/calendarMappings';
import { updateLastExportTime } from '../../utils/calendarStorage';
import { logger } from '../../utils/logger';
import { appTimezone } from '../../utils/time';
import { assertSession, currentSession, sessionWork, SessionStamp } from '../session';

/**
 * Check if event exists in calendar
 */
/**
 * Does this event already say what the rehearsal says?
 *
 * The export rewrote every event on every run, whether anything had changed or
 * not. Harmless once every ten minutes; wasteful several times an hour, which
 * is what removing that interval makes it. Comparing costs nothing extra — the
 * event is being read anyway to check it still exists.
 */
function eventMatchesRehearsal(
  event: { title?: string; startDate?: string | Date; endDate?: string | Date; location?: string | null; timeZone?: string | null },
  rehearsal: RehearsalWithProject
): boolean {
  const sameMoment = (a?: string | Date, b?: string | Date) =>
    a !== undefined && b !== undefined && new Date(a).getTime() === new Date(b).getTime();

  return (
    event.title === eventTitleFor(rehearsal) &&
    sameMoment(event.startDate, rehearsal.startsAt) &&
    sameMoment(event.endDate, rehearsal.endsAt) &&
    locationKey(event.location) === locationKey(rehearsal.location) &&
    // An event in a zone the profile has left is rewritten in place; a
    // platform that does not report the zone is not asked to every run.
    (!event.timeZone || event.timeZone === appTimezone())
  );
}

async function readEvent(eventId: string): Promise<Calendar.Event | null> {
  // The caller reads null as "the reader deleted this event" and responds by
  // discarding the mapping and writing a fresh one. So this must answer the
  // question it was asked and no other. It used to catch everything and say
  // "gone" — its own comment said "doesn't exist or permission denied", and the
  // two are not the same thing. With calendar access revoked in Settings every
  // lookup failed, every mapping was destroyed, and the events themselves
  // stayed where they were, now unreachable.
  //
  // Permission is checked before the lookup instead, and a refusal is raised
  // rather than reported as absence. A genuine "no such event" still gives
  // null, which is what the recreate path is for.
  //
  // Returns the event rather than a boolean so the caller can compare it
  // against the rehearsal and skip a write that would change nothing.
  //
  // Three answers, not two: the event (there), null (the calendar said there is
  // no such event) and a throw (it could not be asked). The lookup itself
  // caught everything after the permission check and said "gone", so a native
  // failure between the two — the calendar busy, an account re-authorising —
  // still destroyed the mapping and wrote a second copy (EX04).
  const hasPermission = await checkCalendarPermissions();
  if (!hasPermission) {
    throw new Error('Calendar permission not granted');
  }

  try {
    const event = await Calendar.getEventAsync(eventId);
    return event ?? null;
  } catch (error) {
    if (isEventNotFound(error)) return null;
    throw error;
  }
}

/**
 * The calendar's own "there is no such event", and nothing else.
 *
 * iOS raises EventNotFoundException from getEventAsync — code
 * `ERR_EVENT_NOT_FOUND`, reason "Event with id … could not be found". Every
 * other failure means the question went unanswered.
 */
function isEventNotFound(error: unknown): boolean {
  const { code, message } = (error ?? {}) as { code?: string; message?: string };
  return code === 'ERR_EVENT_NOT_FOUND' || /^Event with id .* could not be found/.test(message || '');
}

/**
 * Find duplicate event in calendar by matching properties
 */
/**
 * The rehearsal an exported event stands for, written into the event's URL.
 *
 * The event carried nothing identifying it: every rehearsal of a project got
 * the same title and the same notes, so a second device — which sees the same
 * iCloud calendar but addresses its events by a different local id — had to
 * guess which event was which from the title, the start time and the location.
 * Two rehearsals of one project starting in the same minute were
 * indistinguishable, and one without a location matched nothing at all.
 *
 * The URL rather than the notes: an event has no hidden field on iOS, so the
 * mark is visible either way, and a link at least takes the reader to the
 * rehearsal instead of showing them an identifier for nothing. The scheme is
 * the app's own — `rehearsalapp`, already registered and already routed — and
 * navigation resolves it to the details screen. iOS only, which is what this
 * ships on; where the URL is absent the heuristic below still answers.
 */
const eventUrlFor = (rehearsalId: string) => `rehearsalapp://rehearsal/${rehearsalId}`;

const rehearsalIdFromUrl = (url?: string | null): string | null => {
  const match = /^rehearsalapp:\/\/rehearsal\/(.+)$/.exec(url || '');
  return match ? match[1] : null;
};

/**
 * What to call the event. The rehearsal's own name when it has one — most do
 * not, and then the project is the only useful thing to show.
 */
const eventTitleFor = (rehearsal: RehearsalWithProject) =>
  rehearsal.title?.trim() || `Rehearsal: ${rehearsal.projectName}`;

/** '' means "no location", whatever the platform or our own API called it. */
const locationKey = (value?: string | null) => (value ?? '').trim();

/**
 * The event already standing for this rehearsal in `calendarId`, if any.
 *
 * Throws when the calendar cannot be read: "nothing found" is an answer only
 * when the search ran. It used to return null on any failure, and the caller
 * then created a second copy beside the one it could not see (EX04).
 */
async function findDuplicateEvent(
  rehearsal: RehearsalWithProject,
  calendarId: string,
  startDate: Date,
  endDate: Date
): Promise<{ event: Calendar.Event; marked: boolean } | null> {
  // Search in a narrow time window (±1 day) for performance
  const searchStart = new Date(startDate);
  searchStart.setDate(searchStart.getDate() - 1);
  const searchEnd = new Date(endDate);
  searchEnd.setDate(searchEnd.getDate() + 1);

  const events = await Calendar.getEventsAsync([calendarId], searchStart, searchEnd);

  // Find event with matching properties
  // Exact first: an event we wrote carries the rehearsal it belongs to.
  const byId = events.find(
    (event) => rehearsalIdFromUrl((event as { url?: string }).url) === String(rehearsal.id)
  );
  if (byId) {
    logger.debug(`[CalendarSync] Matched event ${byId.id} by rehearsal id`);
    return { event: byId, marked: true };
  }

  // Events written before the id was recorded have nothing to match on but
  // their contents. Kept for those, and for a reader who cleared the URL.
  //
  // An event that names a *different* rehearsal is excluded outright: the
  // mark is proof of what it belongs to, and two rehearsals of one project
  // starting in the same minute look identical to everything else here.
  const duplicateEvent = events.find(event => {
    if (rehearsalIdFromUrl((event as { url?: string }).url)) return false;

    const titleMatch =
      event.title === eventTitleFor(rehearsal) ||
      event.title === `Rehearsal: ${rehearsal.projectName}`;
    const startMatch = Math.abs(new Date(event.startDate).getTime() - startDate.getTime()) < 60000; // Within 1 minute
    const endMatch = Math.abs(new Date(event.endDate).getTime() - endDate.getTime()) < 60000;
    const locationMatch = locationKey(event.location) === locationKey(rehearsal.location);

    return titleMatch && startMatch && endMatch && locationMatch;
  });

  if (duplicateEvent) {
    logger.warn(`[CalendarSync] Found duplicate event: ${duplicateEvent.id}`);
    return { event: duplicateEvent, marked: false };
  }

  return null;
}

/**
 * Create calendar event from rehearsal
 * Includes duplicate detection to prevent multiple events for same rehearsal
 */
export async function createCalendarEvent(
  rehearsal: RehearsalWithProject,
  calendarId: string,
  session: SessionStamp = currentSession()
): Promise<string | null> {
  const eventId = await placeEvent(rehearsal, calendarId, session);
  if (eventId) {
    // Save mapping to database + AsyncStorage
    logger.debug('[CalendarSync] 💾 Saving event mapping...');
    await saveEventMapping(rehearsal.id, eventId, calendarId, session);
    logger.debug('[CalendarSync] ✅ Mapping saved successfully');
  }
  return eventId;
}

/**
 * Puts the rehearsal's event in `calendarId` — the one already there, brought
 * up to date, or a new one — and returns its id without recording it. The
 * caller decides when the mapping may point at it: a move records it only once
 * the old copy is confirmed gone.
 */
async function placeEvent(
  rehearsal: RehearsalWithProject,
  calendarId: string,
  session: SessionStamp
): Promise<string | null> {
  try {
    logger.debug('[CalendarSync] 📅 createCalendarEvent called:', {
      rehearsalId: rehearsal.id,
      calendarId,
    });

    const hasPermission = await checkCalendarPermissions();
    logger.debug('[CalendarSync] 🔐 Calendar permission:', hasPermission);
    if (!hasPermission) {
      throw new Error('Calendar permission not granted');
    }

    const startDate = new Date(rehearsal.startsAt);
    const endDate = new Date(rehearsal.endsAt);
    logger.debug('[CalendarSync] 📆 Event times:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    // Check for duplicate events (prevents creating duplicates after AsyncStorage loss)
    logger.debug('[CalendarSync] 🔍 Checking for duplicate events...');
    const duplicate = await findDuplicateEvent(rehearsal, calendarId, startDate, endDate);
    if (duplicate) {
      const duplicateEventId = duplicate.event.id;
      logger.info(`[CalendarSync] Using existing event ${duplicateEventId} instead of creating duplicate`);
      logger.debug('[CalendarSync] ♻️ Found duplicate, using existing event:', duplicateEventId);
      // An event of ours is adopted with what the rehearsal says now. Found by
      // its mark it may be stale — another device wrote it before the time
      // changed — and adopting it as it was reported the export done with the
      // old time in the calendar (EX03). One matched by its contents already
      // says what the rehearsal says.
      if (duplicate.marked && !eventMatchesRehearsal(duplicate.event, rehearsal)) {
        await updateCalendarEvent(duplicateEventId, rehearsal, session);
      }
      return duplicateEventId;
    }

    const eventDetails: Omit<Partial<Calendar.Event>, 'id' | 'organizer'> = {
      title: eventTitleFor(rehearsal),
      startDate,
      endDate,
      location: rehearsal.location || undefined,
      notes: `Project: ${rehearsal.projectName}\n\nCreated via Rehearsly`,
      url: eventUrlFor(rehearsal.id),
      // Say which zone the times mean, on both paths.
      //
      // Left unset, iOS assigns the device's zone when the event is created and
      // may reinterpret a later update against whatever it recorded — which is
      // the likeliest reading of a device report that editing a rehearsal
      // briefly showed a time that was neither the old one nor the new one.
      // Unconfirmed, but stating the zone costs nothing and removes the
      // question.
      //
      // The profile's zone, the app's one (time.ts, cause fix 14) — not the
      // device's, which a flight changes. The event is found again by the
      // rehearsal's id, never by its time, so a new zone updates it in place.
      timeZone: appTimezone(),
      alarms: [
        {
          relativeOffset: -30, // 30 minutes before
          method: Calendar.AlarmMethod.ALERT,
        },
      ],
      availability: Calendar.Availability.BUSY,
    };

    logger.info('[CalendarSync] Creating event:', eventDetails.title);
    logger.debug('[CalendarSync] 📝 Event details:', {
      title: eventDetails.title,
      startDate: eventDetails.startDate,
      endDate: eventDetails.endDate,
      location: eventDetails.location,
      calendarId,
    });

    logger.debug('[CalendarSync] 🚀 Calling Calendar.createEventAsync...');
    assertSession(session);
    const eventId = await Calendar.createEventAsync(calendarId, eventDetails);
    logger.debug('[CalendarSync] ✅ Event created with ID:', eventId);

    logger.info(`[CalendarSync] Created event ${eventId} for rehearsal ${rehearsal.id}`);
    return eventId;
  } catch (error) {
    logger.error('[CalendarSync] Failed to create event:', error);
    logger.error('[CalendarSync] ❌ createCalendarEvent failed:', error);
    throw error;
  }
}

/**
 * Update existing calendar event
 */
export async function updateCalendarEvent(
  eventId: string,
  rehearsal: RehearsalWithProject,
  session: SessionStamp = currentSession()
): Promise<void> {
  try {
    const hasPermission = await checkCalendarPermissions();
    if (!hasPermission) {
      throw new Error('Calendar permission not granted');
    }

    const eventDetails: Partial<Calendar.Event> = {
      title: eventTitleFor(rehearsal),
      startDate: new Date(rehearsal.startsAt),
      endDate: new Date(rehearsal.endsAt),
      location: rehearsal.location || undefined,
      notes: `Project: ${rehearsal.projectName}\n\nCreated via Rehearsly`,
      // Also on update, so events written before this gain the mark.
      url: eventUrlFor(rehearsal.id),
      timeZone: appTimezone(),
    };

    logger.info('[CalendarSync] Updating event:', eventId);
    assertSession(session);
    await Calendar.updateEventAsync(eventId, eventDetails);

    logger.info(`[CalendarSync] Updated event ${eventId}`);
  } catch (error) {
    logger.error('[CalendarSync] Failed to update event:', error);
    throw error;
  }
}

/**
 * Delete calendar event
 */
export async function deleteCalendarEvent(
  eventId: string,
  session: SessionStamp = currentSession()
): Promise<void> {
  try {
    const hasPermission = await checkCalendarPermissions();
    if (!hasPermission) {
      throw new Error('Calendar permission not granted');
    }

    logger.info('[CalendarSync] Deleting event:', eventId);
    assertSession(session);
    await Calendar.deleteEventAsync(eventId);

    logger.info(`[CalendarSync] Deleted event ${eventId}`);
  } catch (error) {
    logger.error('[CalendarSync] Failed to delete event:', error);
    throw error;
  }
}

/**
 * Smart sync: Create or update calendar event for rehearsal
 * If rehearsal is already synced, update the event
 * Otherwise, create new event
 * Includes recovery logic for deleted events
 */
export function syncRehearsalToCalendar(
  rehearsal: RehearsalWithProject,
  calendarId: string,
  /**
   * The mapping for this rehearsal, when the caller already has it.
   *
   * Without it this asks the server one question per rehearsal — twenty
   * rehearsals, twenty requests, on every trip to the foreground. That cost is
   * the only reason the export was rate-limited to once every ten minutes, and
   * the rate limit is why someone else's edit did not reach the calendar until
   * the reader thought to pull down. getAllMappings answers for all of them at
   * once, so the caller fetches once and hands the answer down.
   */
  knownMapping?: { eventId: string; calendarId: string } | null,
  /** The session of the work this is a step of; the current one otherwise. */
  session?: SessionStamp
): Promise<void> {
  // The session's work: it writes nothing once the session has ended, and a
  // change of account waits for it (ES01). Every helper below is handed the
  // same stamp and checks it before its own write.
  return sessionWork((stamp) => syncOneRehearsal(stamp, rehearsal, calendarId, knownMapping), session);
}

async function syncOneRehearsal(
  session: SessionStamp,
  rehearsal: RehearsalWithProject,
  calendarId: string,
  knownMapping?: { eventId: string; calendarId: string } | null
): Promise<void> {
  try {
    logger.debug('[CalendarSync] 🔄 syncRehearsalToCalendar called:', {
      rehearsalId: rehearsal.id,
      projectName: rehearsal.projectName,
      calendarId,
      startsAt: rehearsal.startsAt,
      endsAt: rehearsal.endsAt,
    });

    // Check if already synced
    const mapping = knownMapping !== undefined ? knownMapping : await getEventMapping(rehearsal.id, session);
    logger.debug('[CalendarSync] 🔍 Event mapping check:', mapping ? 'Found existing mapping' : 'No mapping found');
    assertSession(session);

    if (mapping) {
      logger.debug('[CalendarSync] 📋 Existing mapping:', {
        eventId: mapping.eventId,
        calendarId: mapping.calendarId,
      });

      // Check if event still exists in calendar
      const existing = await readEvent(mapping.eventId);
      assertSession(session);
      const eventExists = existing !== null;
      logger.debug('[CalendarSync] 🔍 Event exists in calendar?', eventExists);

      // The reader picked a different calendar in settings.
      //
      // The update below writes to whichever calendar the event already lives
      // in, so changing the choice left every rehearsal exported so far in the
      // old one — while the settings screen showed the new one selected and
      // said everything was synced. Only rehearsals created afterwards ever
      // appeared there.
      //
      // Created in the new calendar first and removed from the old one after,
      // so a failure leaves the event where it was rather than nowhere. The
      // duplicate search looks only in the calendar being written to, so the
      // old copy cannot be adopted as the new one.
      //
      // The mapping moves last, once the old copy is confirmed gone. It used to
      // point at the new copy first and log a failed removal as a warning, so
      // the old one stayed in the calendar with nothing left to reach it, and
      // the run said done (EX02). Now the failure fails this rehearsal and the
      // mapping still names the old copy: the next run removes it, adopting the
      // new copy by its mark rather than making a third.
      if (mapping.calendarId && mapping.calendarId !== calendarId) {
        logger.info(`[CalendarSync] Moving rehearsal ${rehearsal.id} to calendar ${calendarId}`);
        const movedId = await placeEvent(rehearsal, calendarId, session);
        if (!movedId) throw new Error('The calendar did not create the event');
        if (eventExists) await deleteCalendarEvent(mapping.eventId, session);
        await saveEventMapping(rehearsal.id, movedId, calendarId, session);
        return;
      }

      if (existing && eventMatchesRehearsal(existing, rehearsal)) {
        logger.debug('[CalendarSync] Event already matches - nothing to write');
        return;
      }

      if (eventExists) {
        // Update existing event.
        //
        // A failed update is a failure, not a sign the event is gone — it was
        // read a moment ago. Treating it as "recreate" dropped the mapping and
        // let the duplicate search adopt this same event, unchanged, so the
        // run reported success with the old time in the calendar (EX03).
        logger.info(`[CalendarSync] Rehearsal ${rehearsal.id} already synced, updating...`);
        logger.debug('[CalendarSync] 📝 Updating existing event...');
        await updateCalendarEvent(mapping.eventId, rehearsal, session);
        // Update lastSynced timestamp
        await saveEventMapping(rehearsal.id, mapping.eventId, mapping.calendarId, session);
        logger.debug('[CalendarSync] ✅ Event updated successfully');
      } else {
        // Event was deleted from calendar - recreate and update mapping
        logger.warn(`[CalendarSync] Event ${mapping.eventId} no longer exists, recreating...`);
        logger.debug('[CalendarSync] ⚠️ Event no longer exists, recreating...');
        await removeEventMapping(rehearsal.id, session);
        await createCalendarEvent(rehearsal, calendarId, session);
      }
    } else {
      // Create new event
      logger.info(`[CalendarSync] Rehearsal ${rehearsal.id} not synced, creating...`);
      logger.debug('[CalendarSync] ➕ Creating new event...');
      const eventId = await createCalendarEvent(rehearsal, calendarId, session);
      logger.debug('[CalendarSync] ✅ New event created:', eventId);
    }

    // No "last export" stamp here: one rehearsal written is not the calendar
    // in line. The run over all of them stamps it, and only when none failed.
    logger.debug('[CalendarSync] ✅ syncRehearsalToCalendar completed successfully');
  } catch (error) {
    logger.error('[CalendarSync] Failed to sync rehearsal:', error);
    logger.error('[CalendarSync] ❌ syncRehearsalToCalendar failed:', error);
    throw error;
  }
}

/**
 * Unsync rehearsal (remove from calendar)
 */
export function unsyncRehearsal(rehearsalId: string, session?: SessionStamp): Promise<void> {
  return sessionWork((stamp) => unsyncOneRehearsal(stamp, rehearsalId), session);
}

async function unsyncOneRehearsal(session: SessionStamp, rehearsalId: string): Promise<void> {
  try {
    const mapping = await getEventMapping(rehearsalId, session);
    if (!mapping) {
      logger.info(`[CalendarSync] Rehearsal ${rehearsalId} not synced, nothing to do`);
      return;
    }

    // Delete calendar event
    await deleteCalendarEvent(mapping.eventId, session);

    // Remove mapping
    await removeEventMapping(rehearsalId, session);

    logger.info(`[CalendarSync] Unsynced rehearsal ${rehearsalId}`);
  } catch (error) {
    logger.error('[CalendarSync] Failed to unsync rehearsal:', error);
    throw error;
  }
}

/**
 * Export all rehearsals to calendar
 * Returns: { success: number, failed: number, errors: string[] }
 */
export function syncAllRehearsals(
  rehearsals: RehearsalWithProject[],
  calendarId: string,
  onProgress?: (current: number, total: number) => void,
  /** All of this user's mappings, when the caller already holds them. */
  knownMappings?: Record<string, { eventId: string; calendarId: string }>,
  session?: SessionStamp
): Promise<BatchSyncResult> {
  return sessionWork((stamp) => syncRehearsals(stamp, rehearsals, calendarId, onProgress, knownMappings), session);
}

async function syncRehearsals(
  session: SessionStamp,
  rehearsals: RehearsalWithProject[],
  calendarId: string,
  onProgress?: (current: number, total: number) => void,
  knownMappings?: Record<string, { eventId: string; calendarId: string }>
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
    assertSession(session);

    // Process batch in parallel
    const results = await Promise.allSettled(
      batch.map(rehearsal =>
        syncRehearsalToCalendar(
          rehearsal,
          calendarId,
          knownMappings ? knownMappings[rehearsal.id] ?? null : undefined,
          session
        )
      )
    );
    // A step that stopped with the session stops the whole run, not one row.
    assertSession(session);

    // Collect results
    results.forEach((res, idx) => {
      const rehearsal = batch[idx];
      if (res.status === 'fulfilled') {
        result.success++;
      } else {
        result.failed++;
        result.errors.push(`${rehearsal.projectName}: ${res.reason?.message || 'Unknown error'}`);
        logger.error(`[CalendarSync] Failed to sync rehearsal ${rehearsal.id}:`, res.reason);
      }
    });

    // Report progress
    if (onProgress) {
      onProgress(Math.min(i + batch.length, total), total);
    }
  }

  // The one writer of "last export", and only for a run with no failure. It
  // was stamped whatever came back, so a run where every write failed told the
  // settings screen the calendar was synced just now (EO06). The callers used
  // to stamp it too; they read it from here now.
  assertSession(session);
  if (result.failed === 0) {
    await updateLastExportTime();
  }

  logger.info(`[CalendarSync] Batch sync complete: ${result.success} success, ${result.failed} failed`);
  return result;
}

/**
 * Remove all exported events from calendar
 * Uses database mappings as source of truth
 */
export function removeAllExportedEvents(
  onProgress?: (current: number, total: number) => void,
  session?: SessionStamp
): Promise<BatchSyncResult> {
  return sessionWork((stamp) => removeExportedEvents(stamp, onProgress), session);
}

async function removeExportedEvents(
  session: SessionStamp,
  onProgress?: (current: number, total: number) => void
): Promise<BatchSyncResult> {
  try {
    // Get mappings from database (primary) or AsyncStorage (fallback)
    const mappings = await getAllMappings(session);
    const rehearsalIds = Object.keys(mappings);

    const result: BatchSyncResult = {
      success: 0,
      failed: 0,
      errors: [],
    };

    const total = rehearsalIds.length;
    const BATCH_SIZE = 10; // Delete 10 events in parallel

    logger.info(`[CalendarSync] Removing ${total} exported events...`);

    // Process in batches for better performance
    for (let i = 0; i < rehearsalIds.length; i += BATCH_SIZE) {
      const batchIds = rehearsalIds.slice(i, i + BATCH_SIZE);
      assertSession(session);

      // Delete batch in parallel
      const results = await Promise.allSettled(
        batchIds.map(async rehearsalId => {
          const eventId = mappings[rehearsalId].eventId;
          // Try to delete event from calendar
          await deleteCalendarEvent(eventId, session);
          // Remove mapping from DB + AsyncStorage — only now that the event
          // is confirmed gone. An event the calendar no longer has counts as
          // gone: iOS deletes a missing event without complaint.
          await removeEventMapping(rehearsalId, session);
        })
      );
      assertSession(session);

      // Collect results
      results.forEach((res, idx) => {
        const rehearsalId = batchIds[idx];
        const mapping = mappings[rehearsalId];
        if (res.status === 'fulfilled') {
          result.success++;
        } else {
          result.failed++;
          result.errors.push(`Event ${mapping.eventId}: ${res.reason?.message || 'Unknown error'}`);
          logger.error(`[CalendarSync] Failed to delete event ${mapping.eventId}:`, res.reason);
        }
      });

      // Report progress
      if (onProgress) {
        onProgress(Math.min(i + batchIds.length, total), total);
      }
    }

    // What failed keeps its mapping. This used to clear every remaining one
    // "in case some deletions failed" — exactly the events still in the
    // calendar, which nothing could find again afterwards (EX02). Kept, the
    // next "remove all" tries them again.
    logger.info(`[CalendarSync] Remove all complete: ${result.success} success, ${result.failed} failed`);
    return result;
  } catch (error) {
    logger.error('[CalendarSync] Failed to remove all events:', error);
    throw error;
  }
}
