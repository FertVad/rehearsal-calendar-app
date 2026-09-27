/**
 * Imported calendar events, reconciled on the server within the calendars a
 * device names (R7: EI01, EI03, EI04).
 *
 * The app used to diff its phone's events against every imported row of the
 * person — from every device — and delete whatever its phone did not have, so
 * a sync on the second phone deleted what the first had imported (EI01). The
 * scope is now a key both sides name (CLAUDE.md 12): the calendar on the device
 * an event was read from. A sync names every calendar the device has, the ones
 * it read completely and the ones it could not read. Inside a calendar read,
 * rows become exactly its events in the window; a calendar that could not be
 * read keeps its rows; a calendar of this device no longer chosen loses them.
 * Another device's calendars are never named here — calendar ids are the
 * device's own — so nothing of theirs is touched.
 *
 * The scope lives in the row's key, which the server composes as
 * `cal:<calendar>|<event>` and nothing else builds. A column would say it more
 * plainly, but adding one to a domain table means extending the migration
 * frontier, which knows only the import key and the budget groups; the key
 * already carries the unique index imports rely on. Rows from before this have
 * plain keys: a sync adopts one whose key it is given for a calendar it read,
 * and never deletes the rest by absence — only "remove all imported" does.
 *
 * One transaction per sync, behind the person's lock (manualDays.js): moving a
 * recurring occurrence is a delete and an insert, and the old time must not be
 * gone while the new one is not yet written (EI04).
 */
import { AVAILABILITY_SOURCES } from '../../constants/timezone.js';
import { lockOwnAvailability } from './manualDays.js';

export const IMPORT_SOURCES = new Set([AVAILABILITY_SOURCES.APPLE, AVAILABILITY_SOURCES.GOOGLE]);
export const IMPORTED_TITLE = 'Calendar Event';
export const SCOPE_PREFIX = 'cal:';
const MAX_CALENDARS = 100;
const MAX_EVENTS = 5000;
const MAX_WINDOW_MS = 400 * 24 * 60 * 60 * 1000;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const CALENDAR_ID = /^[^|]{1,255}$/;

export class ImportInvalid extends Error {
  constructor(reason, where = {}) {
    super('Import is not valid');
    this.name = 'ImportInvalid';
    this.reason = reason;
    this.where = where;
  }

  get body() {
    return { error: this.message, code: 'IMPORT_INVALID', reason: this.reason, ...this.where };
  }
}

export const scopedKey = (calendarId, key) => `${SCOPE_PREFIX}${calendarId}|${key}`;
const calendarPrefix = (calendarId) => `${SCOPE_PREFIX}${calendarId}|`;

function instant(value, reason, where) {
  if (typeof value !== 'string' || !INSTANT.test(value)) throw new ImportInvalid(reason, where);
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new ImportInvalid(reason, where);
  return ms;
}

function calendarIds(raw, reason) {
  if (!Array.isArray(raw) || raw.length > MAX_CALENDARS) throw new ImportInvalid(reason);
  const ids = new Set();
  for (const id of raw) {
    if (typeof id !== 'string' || !CALENDAR_ID.test(id) || ids.has(id)) throw new ImportInvalid(reason);
    ids.add(id);
  }
  return ids;
}

/** A sync, checked whole before anything is written. Times come back normalised. */
export function checkSync(body) {
  if (!body || typeof body !== 'object') throw new ImportInvalid('BODY_INVALID');
  if (!IMPORT_SOURCES.has(body.source)) throw new ImportInvalid('SOURCE_INVALID');
  const from = instant(body.window?.from, 'WINDOW_INVALID');
  const to = instant(body.window?.to, 'WINDOW_INVALID');
  if (to <= from || to - from > MAX_WINDOW_MS) throw new ImportInvalid('WINDOW_INVALID');

  const device = calendarIds(body.deviceCalendars, 'DEVICE_CALENDARS_INVALID');
  if (device.size === 0) throw new ImportInvalid('DEVICE_CALENDARS_INVALID');
  const unreadable = calendarIds(body.unreadable ?? [], 'UNREADABLE_INVALID');
  for (const id of unreadable) if (!device.has(id)) throw new ImportInvalid('UNREADABLE_INVALID', { calendarId: id });

  if (!Array.isArray(body.calendars) || body.calendars.length > MAX_CALENDARS) throw new ImportInvalid('CALENDARS_INVALID');
  const read = new Set();
  let total = 0;
  const calendars = body.calendars.map((calendar) => {
    const calendarId = calendar?.calendarId;
    if (typeof calendarId !== 'string' || !device.has(calendarId) || unreadable.has(calendarId) || read.has(calendarId)) {
      throw new ImportInvalid('CALENDAR_INVALID', { calendarId });
    }
    read.add(calendarId);
    if (!Array.isArray(calendar.events)) throw new ImportInvalid('EVENTS_INVALID', { calendarId });
    total += calendar.events.length;
    if (total > MAX_EVENTS) throw new ImportInvalid('TOO_MANY_EVENTS');
    const seen = new Set();
    const events = calendar.events.map((event, index) => {
      const where = { calendarId, index };
      if (!event || typeof event.key !== 'string' || event.key.length === 0 || event.key.length > 512) {
        throw new ImportInvalid('KEY_INVALID', where);
      }
      if (seen.has(event.key)) throw new ImportInvalid('KEY_REPEATED', where);
      seen.add(event.key);
      const start = instant(event.startsAt, 'TIME_INVALID', where);
      const end = instant(event.endsAt, 'TIME_INVALID', where);
      if (end <= start || end - start > MAX_WINDOW_MS) throw new ImportInvalid('TIME_INVALID', where);
      if (typeof (event.isAllDay ?? false) !== 'boolean') throw new ImportInvalid('ALL_DAY_NOT_BOOLEAN', where);
      return { key: event.key, startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(),
        isAllDay: event.isAllDay ?? false };
    });
    return { calendarId, events };
  });

  return { source: body.source, from: new Date(from).toISOString(), to: new Date(to).toISOString(),
    device: [...device], unreadable: [...unreadable], calendars };
}

const placeholders = (values, first) => values.map((_, i) => `$${i + first}`).join(', ');
const sameTime = (a, b) => new Date(a).getTime() === new Date(b).getTime();

/** Apply a checked sync for one person, in the transaction given. */
export async function applySync(tx, userId, sync) {
  await lockOwnAvailability(tx, userId);
  const counts = { added: 0, updated: 0, removed: 0, adopted: 0, unchanged: 0 };
  const inScope = (calendarId) => ['substr(external_event_id, 1, length($3)) = $3', calendarPrefix(calendarId)];

  // A calendar of this device that is neither read nor unreadable is no longer
  // chosen here: its rows go, whenever they are.
  const chosen = new Set([...sync.unreadable, ...sync.calendars.map((calendar) => calendar.calendarId)]);
  for (const calendarId of sync.device.filter((id) => !chosen.has(id))) {
    const [condition, prefix] = inScope(calendarId);
    const result = await tx.run(
      `DELETE FROM native_user_availability WHERE user_id = $1 AND source = $2 AND ${condition}`,
      [userId, sync.source, prefix]
    );
    counts.removed += result.changes || 0;
  }

  for (const { calendarId, events } of sync.calendars) {
    const [condition, prefix] = inScope(calendarId);

    // Rows from before the scope: the ones this calendar still has come in.
    if (events.length > 0) {
      const plain = events.map((event) => event.key);
      const owned = await tx.all(
        `SELECT external_event_id FROM native_user_availability
         WHERE user_id = $1 AND source = $2 AND external_event_id IN (${placeholders(plain, 3)})`,
        [userId, sync.source, ...plain]
      );
      for (const { external_event_id: key } of owned) {
        if (key.startsWith(SCOPE_PREFIX)) continue;
        const target = scopedKey(calendarId, key);
        const taken = await tx.get(
          'SELECT id FROM native_user_availability WHERE user_id = $1 AND source = $2 AND external_event_id = $3',
          [userId, sync.source, target]
        );
        if (taken) continue;
        await tx.run(
          'UPDATE native_user_availability SET external_event_id = $4 WHERE user_id = $1 AND source = $2 AND external_event_id = $3',
          [userId, sync.source, key, target]
        );
        counts.adopted += 1;
      }
    }

    // What the calendar holds now, inside the window read.
    const stored = await tx.all(
      `SELECT external_event_id, starts_at, ends_at, is_all_day FROM native_user_availability
       WHERE user_id = $1 AND source = $2 AND ${condition}
       AND ends_at >= $4::timestamptz AND starts_at <= $5::timestamptz`,
      [userId, sync.source, prefix, sync.from, sync.to]
    );
    const wanted = new Map(events.map((event) => [scopedKey(calendarId, event.key), event]));
    for (const row of stored) {
      if (wanted.has(row.external_event_id)) continue;
      await tx.run('DELETE FROM native_user_availability WHERE user_id = $1 AND source = $2 AND external_event_id = $3',
        [userId, sync.source, row.external_event_id]);
      counts.removed += 1;
    }

    const existing = new Map((await tx.all(
      `SELECT external_event_id, starts_at, ends_at, is_all_day FROM native_user_availability
       WHERE user_id = $1 AND source = $2 AND ${condition}`,
      [userId, sync.source, prefix]
    )).map((row) => [row.external_event_id, row]));
    for (const [key, event] of wanted) {
      const row = existing.get(key);
      if (!row) {
        await tx.run(
          `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, title, is_all_day, source, external_event_id)
           VALUES ($1, $2::timestamptz, $3::timestamptz, 'busy', $4, $5, $6, $7)`,
          [userId, event.startsAt, event.endsAt, IMPORTED_TITLE, event.isAllDay, sync.source, key]
        );
        counts.added += 1;
      } else if (!sameTime(row.starts_at, event.startsAt) || !sameTime(row.ends_at, event.endsAt)
        || Boolean(row.is_all_day) !== event.isAllDay) {
        await tx.run(
          `UPDATE native_user_availability SET starts_at = $4::timestamptz, ends_at = $5::timestamptz, is_all_day = $6,
             updated_at = NOW() WHERE user_id = $1 AND source = $2 AND external_event_id = $3`,
          [userId, sync.source, key, event.startsAt, event.endsAt, event.isAllDay]
        );
        counts.updated += 1;
      } else {
        counts.unchanged += 1;
      }
    }
  }
  // How many rows this device's calendars hold now, for its sync screen.
  const prefixes = sync.device.map(calendarPrefix);
  const held = await tx.get(
    `SELECT COUNT(*) AS n FROM native_user_availability WHERE user_id = $1 AND source = $2
     AND (${prefixes.map((_, i) => `substr(external_event_id, 1, length($${i + 3})) = $${i + 3}`).join(' OR ')})`,
    [userId, sync.source, ...prefixes]
  );
  counts.held = Number(held?.n) || 0;
  return counts;
}
