/**
 * The calendar sync: one for the whole app (cause fix 18).
 *
 * Both directions in one run — events from the device become availability,
 * and the rehearsals you are on become events — and every run of it goes
 * through here: the automatic one (the tab bar on launch and on return to the
 * foreground, a push arriving), a pull-to-refresh, and "Synchronize" in the
 * settings.
 *
 * "Synchronize" used to be a sync of its own beside this one. It read the
 * rehearsals itself and dropped their titles, so every event it touched was
 * renamed "Rehearsal: <project>" (EO05); its lock was not this one, so it could
 * run alongside the automatic sync; and it exported with the settings of the
 * render it was pressed in, after Auto Sync had been switched off between its
 * import and its export (EO04). One run, one queue, one reading of the
 * settings and of the rehearsals now.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';
import { getSyncSettings } from '../utils/calendarStorage';
import { getAllMappings } from '../utils/calendarMappings';
import {
  importCalendarEventsToAvailability,
  removeAllExportedEvents,
  removeAllImportedSlots,
  syncAllRehearsals,
  syncRehearsalToCalendar,
  unsyncRehearsal,
} from './calendar';
import { projectsAPI, rehearsalsAPI } from './api';
import { assertSession, currentSession, sessionWork, SessionEndedError, SessionStamp } from './session';
import type {
  BatchSyncResult,
  CalendarSyncSettings,
  ImportResult,
  RehearsalWithProject,
} from '../types/calendar';

/** What one direction of a run came to. */
export type DirectionOutcome<T> =
  | { status: 'off' } // not switched on: nothing was done
  | { status: 'done'; result: T }
  | { status: 'failed'; error: string };

export interface SyncRun {
  import: DirectionOutcome<ImportResult>;
  /** `rehearsals`: how many the person is on, written or not. */
  export: DirectionOutcome<BatchSyncResult & { rehearsals: number }>;
}

/**
 * A rehearsal as the server sends it, as the export writes it.
 *
 * The one mapping for every run. The manual run had a copy without `title`.
 */
export function toRehearsalWithProject(rehearsal: any): RehearsalWithProject {
  return {
    id: rehearsal.id,
    projectId: rehearsal.projectId,
    projectName: rehearsal.projectName,
    startsAt: rehearsal.startsAt,
    endsAt: rehearsal.endsAt,
    location: rehearsal.location,
    title: rehearsal.title,
  };
}

/** The calendar to export to, or null when exporting is off. */
function exportCalendar(settings: CalendarSyncSettings): string | null {
  return settings.exportEnabled && settings.exportCalendarId ? settings.exportCalendarId : null;
}

/**
 * Push every rehearsal the user is on into their calendar, and take back the
 * events of those they are not on any more.
 *
 * Taken back by the export pass itself (`removeOthers`), as steps of the same
 * result (EO06): `rehearsals` is everything the person is on, so the event of
 * any other mapping is a cancelled rehearsal's. Nobody else can delete it: the
 * event lives in a calendar on this person's phone.
 *
 * No projects is the same as no rehearsals. The run used to stop there, so
 * someone who left their last project kept every event it had exported, with
 * their alarms (EO01). Both requests throw rather than returning nothing, so an
 * empty list really is empty.
 */
async function exportRehearsals(
  session: SessionStamp
): Promise<(BatchSyncResult & { rehearsals: number }) | null> {
  if (!exportCalendar(await getSyncSettings())) return null;

  const projectsRes = await projectsAPI.getUserProjects();
  const projectIds = (projectsRes.data?.projects || []).map((p: any) => p.id);
  const res = projectIds.length > 0 ? await rehearsalsAPI.getBatch(projectIds) : null;
  const rehearsals = (res?.data?.rehearsals || []).map(toRehearsalWithProject);

  const mappings = await getAllMappings(session);

  // The settings as they are now, not as they were when the run began: a run
  // waits on the network, and sync may have been switched off or pointed at
  // another calendar meanwhile (EO04). Nothing is written past that.
  const calendarId = exportCalendar(await getSyncSettings());
  if (!calendarId) return null;

  // What was read above is this session's; the writes below are too, or none.
  assertSession(session);
  const result = await syncAllRehearsals(
    rehearsals,
    calendarId,
    undefined,
    mappings,
    session,
    { removeOthers: true }
  );
  // Only a pass with no failure counts as done — and syncAllRehearsals is the
  // one that says so, stamping "last export" itself only then (EO06).
  if (result.failed > 0) logger.warn(`[CalendarSync] ${result.failed} export steps failed - will retry`);
  return { ...result, rehearsals: rehearsals.length };
}

/**
 * One direction of a run, on its own.
 *
 * The import and the export read different things and write different things,
 * so neither's failure is a reason to skip the other (EO02). Only the end of
 * the session stops the run.
 */
async function eachDirection<T>(name: string, work: () => Promise<T | null>): Promise<DirectionOutcome<T>> {
  try {
    const result = await work();
    return result === null ? { status: 'off' } : { status: 'done', result };
  } catch (error: any) {
    if (error instanceof SessionEndedError) throw error;
    logger.error(`[CalendarSync] ${name} failed:`, error);
    return { status: 'failed', error: error?.message || '' };
  }
}

async function syncOnce(session: SessionStamp): Promise<SyncRun> {
  const imported = await eachDirection('Import', async () => {
    const settings = await getSyncSettings();
    if (!settings.importEnabled || settings.importCalendarIds.length === 0) return null;
    // Every step runs as this run's session, handed down (ES01). The import
    // knows our own events by their mark, so it needs no mappings.
    return importCalendarEventsToAvailability(settings.importCalendarIds, undefined, session);
  });

  const exported = await eachDirection('Export', () => exportRehearsals(session));

  return { import: imported, export: exported };
}

/**
 * One piece of calendar work at a time, in the order asked.
 *
 * Each waits for the one before it to end, however it ends. The lock this
 * replaces let every waiter wait for the same run and then start together, so
 * two pulls during an automatic run became two exports at once, each reading
 * the same mappings and writing its own (EO03).
 *
 * Every writer of the person's calendar and of their imported events goes
 * through here: a sync run, the event of a rehearsal just saved or deleted,
 * "remove all". The two of a saved rehearsal used to be written beside the
 * queue, so a run that had read the rehearsals before the save wrote the old
 * time back over the new one, or put back the event of one just deleted
 * (review of cause fix 18). In the queue the save's own write comes after.
 *
 * The work is the session's it was asked in, stamped when it joins the queue.
 * Stamped only when its turn came, a "remove all" confirmed behind a run that
 * hung, then a sign-out and a sign-in as someone else, ran as the next person
 * and took their events away (review of cause fix 18). Work whose session has
 * ended by its turn does not start: it rejects with SessionEndedError.
 */
let queue: Promise<unknown> = Promise.resolve();
let pending = 0; // waiting or running
const listeners = new Set<(running: boolean) => void>();

function setPending(change: number): void {
  const wasRunning = pending > 0;
  pending += change;
  if (wasRunning !== pending > 0) listeners.forEach((listener) => listener(pending > 0));
}

/** Calendar work, as the session asking for it, after what is ahead of it. */
export function runCalendarWork<T>(work: (session: SessionStamp) => Promise<T>): Promise<T> {
  const session = currentSession();
  setPending(1);
  const run = queue.then(() => sessionWork(work, session));
  queue = run.then(() => undefined, () => undefined);
  return run.finally(() => setPending(-1));
}

/** The same, resolving to null for work whose session ended: nothing was done. */
function runForSession<T>(work: (session: SessionStamp) => Promise<T>): Promise<T | null> {
  return runCalendarWork(work).catch((error) => {
    if (error instanceof SessionEndedError) return null;
    throw error;
  });
}

/**
 * The event of a rehearsal just saved, written in its turn, to the calendar
 * the settings name by then — nothing if exporting is off by then.
 */
export async function exportRehearsal(rehearsal: RehearsalWithProject): Promise<void> {
  await runForSession(async (session) => {
    const calendarId = exportCalendar(await getSyncSettings());
    if (!calendarId) return;
    await syncRehearsalToCalendar(rehearsal, calendarId, undefined, session);
  });
}

/** The event of a rehearsal just deleted, taken back in its turn. */
export async function unexportRehearsal(rehearsalId: string): Promise<void> {
  await runForSession((session) => unsyncRehearsal(rehearsalId, session));
}

/** "Remove all exported", in its turn. Null: the session ended first. */
export function removeExportedEvents(
  onProgress?: (current: number, total: number) => void
): Promise<BatchSyncResult | null> {
  return runForSession((session) => removeAllExportedEvents(onProgress, session));
}

/** "Clear all imported", in its turn. Null: the session ended first. */
export function removeImportedEvents(
  onProgress?: (current: number, total: number) => void
): Promise<ImportResult | null> {
  return runForSession((session) => removeAllImportedSlots(onProgress, session));
}

/** Whether calendar work is running or waiting. */
export function isCalendarSyncRunning(): boolean {
  return pending > 0;
}

/** Told when calendar work starts and when the last of it ends. */
export function subscribeCalendarSync(listener: (running: boolean) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let lastAutomaticRun = 0;
const THROTTLE_MS = 5000; // Minimum 5 seconds between automatic runs

/**
 * One run of the sync.
 *
 * `manual` — someone asked, by pulling down or pressing "Synchronize": it
 * waits its turn and runs. A pull a second after launch used to find the lock
 * held and do nothing at all, spinner and no work.
 *
 * `auto` — opportunistic: dropped when anything is running or waiting, or
 * within five seconds of the last one. There will be another.
 *
 * Resolves to what each direction came to, or null when nothing ran.
 */
export async function runCalendarSync(trigger: 'auto' | 'manual'): Promise<SyncRun | null> {
  if (trigger === 'auto') {
    // Signing in with Apple or Google backgrounds the app while the native
    // sheet is up; dismissing it fires a foreground event and lands us here
    // before the token is stored. Syncing then just produces a burst of 401s.
    const accessToken = await AsyncStorage.getItem('accessToken');
    if (!accessToken) {
      logger.debug('[CalendarSync] No session - skipping');
      return null;
    }
    if (pending > 0) return null;

    const now = Date.now();
    const sinceLast = now - lastAutomaticRun;
    // A clock that moved backwards makes this negative, and "less than five
    // seconds ago" would then be true forever. A time in the future is not
    // recent; it is nonsense, and nonsense should not stop us.
    if (sinceLast >= 0 && sinceLast < THROTTLE_MS) {
      logger.debug('[CalendarSync] Throttled - too soon since last sync attempt');
      return null;
    }
    lastAutomaticRun = now;
  }

  // Ended with its session: nothing more is written, and that is no error.
  return runForSession(syncOnce);
}
