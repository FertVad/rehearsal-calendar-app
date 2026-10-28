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
import {
  addLeftoverEvent,
  getLeftoverEvents,
  removeLeftoverEvent,
  updateLastExportTime,
} from '../../utils/calendarStorage';
import { logger } from '../../utils/logger';
import { eventNotesFor, eventUrlFor, isOwnEventOf, LEGACY, MarkedEvent, ownMarkOf } from './ownMark';
import { appTimezone } from '../../utils/time';
import { assertSession, currentSession, sessionWork, SessionEndedError, SessionStamp } from '../session';

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
  event: MarkedEvent & { title?: string; startDate?: string | Date; endDate?: string | Date; location?: string | null; timeZone?: string | null },
  rehearsal: RehearsalWithProject
): boolean {
  const sameMoment = (a?: string | Date, b?: string | Date) =>
    a !== undefined && b !== undefined && new Date(a).getTime() === new Date(b).getTime();

  return (
    // An event of ours without the mark — written before it existed — is
    // rewritten once so that it carries it, and is found by it from then on.
    ownMarkOf(event) === String(rehearsal.id) &&
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
): Promise<Calendar.Event | null> {
  // Search in a narrow time window (±1 day) for performance
  const searchStart = new Date(startDate);
  searchStart.setDate(searchStart.getDate() - 1);
  const searchEnd = new Date(endDate);
  searchEnd.setDate(searchEnd.getDate() + 1);

  const events = await Calendar.getEventsAsync([calendarId], searchStart, searchEnd);

  // Exact first: an event we wrote carries the rehearsal it belongs to.
  const byId = events.find((event) => ownMarkOf(event) === String(rehearsal.id));
  if (byId) {
    logger.debug(`[CalendarSync] Matched event ${byId.id} by rehearsal id`);
    return byId;
  }

  // An event of ours written before the id was recorded says which rehearsal
  // it is only by its contents. Only such an event: one without the app's
  // signature is the reader's own, however exactly it matches (EX01). One that
  // names a *different* rehearsal is not legacy either — two rehearsals of one
  // project starting in the same minute look identical to everything else.
  const duplicateEvent = events.find(event => {
    if (ownMarkOf(event) !== LEGACY) return false;

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
    return duplicateEvent;
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
      const duplicateEventId = duplicate.id;
      logger.info(`[CalendarSync] Using existing event ${duplicateEventId} instead of creating duplicate`);
      logger.debug('[CalendarSync] ♻️ Found duplicate, using existing event:', duplicateEventId);
      // An event of ours is adopted with what the rehearsal says now. Found by
      // its mark it may be stale — another device wrote it before the time
      // changed — and adopting it as it was reported the export done with the
      // old time in the calendar (EX03). One from before the mark gains it.
      if (!eventMatchesRehearsal(duplicate, rehearsal)) {
        await updateCalendarEvent(duplicateEventId, rehearsal, session);
      }
      return duplicateEventId;
    }

    const eventDetails: Omit<Partial<Calendar.Event>, 'id' | 'organizer'> = {
      title: eventTitleFor(rehearsal),
      startDate,
      endDate,
      location: rehearsal.location || undefined,
      notes: eventNotesFor(rehearsal.projectName),
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
      notes: eventNotesFor(rehearsal.projectName),
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

      // The mapping points at an event that is not ours for this rehearsal —
      // the reader's own, adopted by the old guess by contents, or another
      // rehearsal's. It is left as it is; only the mapping goes, and the
      // rehearsal gets an event of its own (EX01).
      if (existing && !isOwnEventOf(existing, rehearsal.id)) {
        logger.warn(`[CalendarSync] Event ${mapping.eventId} is not ours for rehearsal ${rehearsal.id}, letting it go`);
        await removeEventMapping(rehearsal.id, session);
        await createCalendarEvent(rehearsal, calendarId, session);
        return;
      }

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
      // Both copies are accounted for at every step (EX02). The move used to
      // point the mapping at the new copy and log a failed removal of the old
      // one as a warning, which left the old one with nothing to reach it; then
      // it kept the mapping on the old copy, which left the new one so instead
      // — "remove all" took the old copy and reported done, and the new one
      // stayed with its alarm. Now the old copy goes on the list of events to
      // take back (calendarStorage, leftovers) before the mapping moves to the
      // new one, and leaves the list only once the calendar confirms it gone.
      // A failed removal fails this rehearsal; the next export pass, or
      // "remove all", tries it again.
      if (mapping.calendarId && mapping.calendarId !== calendarId) {
        logger.info(`[CalendarSync] Moving rehearsal ${rehearsal.id} to calendar ${calendarId}`);
        const movedId = await placeEvent(rehearsal, calendarId, session);
        if (!movedId) throw new Error('The calendar did not create the event');
        if (eventExists) {
          assertSession(session);
          await addLeftoverEvent(mapping.eventId, rehearsal.id);
        }
        await saveEventMapping(rehearsal.id, movedId, calendarId, session);
        if (eventExists) await takeBackLeftover(mapping.eventId, rehearsal.id, session);
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

    await removeOwnEvent(mapping.eventId, rehearsalId, session);

    // Remove mapping
    await removeEventMapping(rehearsalId, session);

    logger.info(`[CalendarSync] Unsynced rehearsal ${rehearsalId}`);
  } catch (error) {
    logger.error('[CalendarSync] Failed to unsync rehearsal:', error);
    throw error;
  }
}

/**
 * The rehearsal's event out of the calendar, if it is ours — the only way the
 * export removes an event (EX01).
 *
 * A mapping or a leftover is only an id: one the old guess by contents gave
 * the reader's own event, or one from another device that means some other
 * event here. Removing by id alone deleted whatever it named. Read first, the
 * event goes only when it carries the mark; an event that is not ours stays,
 * and one already gone is gone. Either way the caller may let the id go.
 */
async function removeOwnEvent(eventId: string, rehearsalId: string, session: SessionStamp): Promise<void> {
  const event = await readEvent(eventId);
  assertSession(session);
  if (!event) return;
  if (!isOwnEventOf(event, rehearsalId)) {
    logger.warn(`[CalendarSync] Event ${eventId} is not ours for rehearsal ${rehearsalId}, left in the calendar`);
    return;
  }
  await deleteCalendarEvent(eventId, session);
}

/** Remove one leftover copy; it leaves the list only once it is gone. */
async function takeBackLeftover(eventId: string, rehearsalId: string, session: SessionStamp): Promise<void> {
  await removeOwnEvent(eventId, rehearsalId, session);
  assertSession(session);
  await removeLeftoverEvent(eventId);
}

/**
 * One step of a batch: what failed is counted and said, and only the end of
 * the session stops the run. The one place a batch turns a failure into its
 * result, for every kind of step it takes.
 */
async function step(
  result: BatchSyncResult,
  what: string,
  work: () => Promise<void>
): Promise<boolean> {
  try {
    await work();
    return true;
  } catch (error: any) {
    if (error instanceof SessionEndedError) throw error;
    result.failed++;
    result.errors.push(`${what}: ${error?.message || 'Unknown error'}`);
    logger.error(`[CalendarSync] ${what} failed:`, error);
    return false;
  }
}

/** Every leftover copy taken back, each a step of `result`. */
async function takeBackLeftovers(session: SessionStamp, result: BatchSyncResult): Promise<number> {
  let removed = 0;
  let leftovers: Record<string, { rehearsalId: string }> = {};
  await step(result, 'Leftover events', async () => {
    leftovers = await getLeftoverEvents();
  });
  for (const [eventId, { rehearsalId }] of Object.entries(leftovers)) {
    if (await step(result, `Event ${eventId}`, () => takeBackLeftover(eventId, rehearsalId, session))) removed++;
  }
  return removed;
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
  session?: SessionStamp,
  /**
   * `rehearsals` is every rehearsal the person is on, so the event of any
   * other mapping is a cancelled one's and is taken back in this same pass.
   */
  { removeOthers = false }: { removeOthers?: boolean } = {}
): Promise<BatchSyncResult> {
  return sessionWork(
    (stamp) => syncRehearsals(stamp, rehearsals, calendarId, onProgress, knownMappings, removeOthers),
    session
  );
}

/**
 * One export pass: what it takes back and what it writes, in one result.
 *
 * The automatic sync removed the events of cancelled rehearsals before calling
 * this and only logged what it could not remove, so a pass with an event left
 * behind still stamped "last export" (EO06). Everything the pass does is a step
 * of the same result now — the leftover copies of a move, the cancelled
 * rehearsals' events, the live ones — and the stamp needs all of it.
 * `success` counts the rehearsals written; `failed`, any step.
 */
async function syncRehearsals(
  session: SessionStamp,
  rehearsals: RehearsalWithProject[],
  calendarId: string,
  onProgress: ((current: number, total: number) => void) | undefined,
  knownMappings: Record<string, { eventId: string; calendarId: string }> | undefined,
  removeOthers: boolean
): Promise<BatchSyncResult> {
  const result: BatchSyncResult = {
    success: 0,
    failed: 0,
    errors: [],
  };

  await takeBackLeftovers(session, result);

  if (removeOthers) {
    const mappings = knownMappings ?? (await getAllMappings(session));
    knownMappings = mappings;
    const live = new Set(rehearsals.map((rehearsal) => String(rehearsal.id)));
    const cancelled = Object.keys(mappings).filter((rehearsalId) => !live.has(String(rehearsalId)));
    if (cancelled.length > 0) {
      logger.info(`[CalendarSync] Removing ${cancelled.length} exported events for deleted rehearsals`);
    }
    // One at a time, each its own step: an event that will not go keeps its
    // mapping, and the next pass tries again.
    for (const rehearsalId of cancelled) {
      await step(result, `Rehearsal ${rehearsalId}`, () => unsyncRehearsal(rehearsalId, session));
    }
  }

  const total = rehearsals.length;
  const BATCH_SIZE = 10; // Process 10 rehearsals in parallel

  // Process in batches for better performance
  for (let i = 0; i < rehearsals.length; i += BATCH_SIZE) {
    const batch = rehearsals.slice(i, i + BATCH_SIZE);
    assertSession(session);

    // Process batch in parallel
    const mappings = knownMappings;
    const results = await Promise.allSettled(
      batch.map(rehearsal =>
        step(result, rehearsal.projectName, () =>
          syncRehearsalToCalendar(
            rehearsal,
            calendarId,
            mappings ? mappings[rehearsal.id] ?? null : undefined,
            session
          )
        )
      )
    );
    // A step that stopped with the session stops the whole run, not one row.
    assertSession(session);
    result.success += results.filter((res) => res.status === 'fulfilled' && res.value).length;

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

    // The leftover copies of a move first, each one an event of the count: the
    // other copy of the same rehearsal is the one its mapping names (EX02).
    result.success += await takeBackLeftovers(session, result);

    const total = rehearsalIds.length;
    const BATCH_SIZE = 10; // Delete 10 events in parallel

    logger.info(`[CalendarSync] Removing ${total} exported events...`);

    // Process in batches for better performance
    for (let i = 0; i < rehearsalIds.length; i += BATCH_SIZE) {
      const batchIds = rehearsalIds.slice(i, i + BATCH_SIZE);
      assertSession(session);

      // Delete batch in parallel
      const results = await Promise.allSettled(
        batchIds.map(rehearsalId => {
          const eventId = mappings[rehearsalId].eventId;
          return step(result, `Event ${eventId}`, async () => {
            // Ours only (EX01); one the calendar no longer has counts as gone.
            await removeOwnEvent(eventId, rehearsalId, session);
            // Remove mapping from DB + AsyncStorage — only now that the event
            // is confirmed gone, or confirmed not ours.
            await removeEventMapping(rehearsalId, session);
          });
        })
      );
      assertSession(session);
      result.success += results.filter((res) => res.status === 'fulfilled' && res.value).length;

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
