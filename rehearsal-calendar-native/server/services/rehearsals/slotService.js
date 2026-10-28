import { logger } from '../../utils/logger.js';
import db from '../../database/db.js';
import { DEFAULT_TIMEZONE, AVAILABILITY_TYPES, AVAILABILITY_SOURCES } from '../../constants/timezone.js';
import { rosterOf } from './roster.js';

/**
 * Get project's timezone setting
 * @param {number} projectId - Project ID
 * @returns {Promise<string>} - IANA timezone string
 */
export async function getProjectTimezone(projectId, conn = db) {
  const project = await conn.get(
    'SELECT timezone FROM native_projects WHERE id = $1',
    [projectId]
  );
  return project?.timezone || DEFAULT_TIMEZONE;
}

/**
 * Book availability slots for selected rehearsal participants
 * @param {number} rehearsalId - Rehearsal ID
 * @param {number} projectId - Project ID (unused, kept for backward compatibility)
 * @param {string} startsAt - ISO 8601 timestamp
 * @param {string} endsAt - ISO 8601 timestamp
 */
export async function bookRehearsalSlots(rehearsalId, projectId, startsAt, endsAt, conn = db) {
  logger.debug(`[bookRehearsalSlots] START - Rehearsal ID: ${rehearsalId}, Time: ${startsAt} - ${endsAt}`);

  // The people on the rehearsal (roster.js): a row left by someone who has
  // since left the project books nothing.
  const participants = await rosterOf(conn, rehearsalId);

  logger.debug(`[bookRehearsalSlots] Found ${participants.length} participants:`, participants.map(p => p.user_id));

  // For each participant, insert a busy slot using TIMESTAMPTZ columns
  for (const participant of participants) {
    logger.debug(`[bookRehearsalSlots] Booking slot for user ${participant.user_id}`);
    await conn.run(
      `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, source, external_event_id, title, is_all_day)
       VALUES ($1, $2::timestamptz, $3::timestamptz, $4, $5, $6, 'Rehearsal', FALSE)`,
      [
        participant.user_id,
        startsAt,
        endsAt,
        AVAILABILITY_TYPES.BUSY,
        AVAILABILITY_SOURCES.REHEARSAL,
        rehearsalId.toString(),
      ]
    );
  }

  logger.debug(`[bookRehearsalSlots] DONE - Booked ${participants.length} slots for rehearsal ${rehearsalId}`);
}

/**
 * Update availability slots when rehearsal time is changed
 * @param {number} rehearsalId - Rehearsal ID
 * @param {number} projectId - Project ID
 * @param {string} startsAt - ISO 8601 timestamp
 * @param {string} endsAt - ISO 8601 timestamp
 * @param {object} tx - The edit's transaction (rehearsalService.updateRehearsal)
 */
export async function updateRehearsalSlots(rehearsalId, projectId, startsAt, endsAt, tx) {
  logger.debug(`[updateRehearsalSlots] START - Rehearsal ID: ${rehearsalId}, New time: ${startsAt} - ${endsAt}`);

  // Both halves or neither, and together with the edit they belong to. This is
  // delete-then-reinsert, and a failure in between — a function timing out
  // partway through a large cast, a connection dropping mid-loop — left the
  // rehearsal standing with some or all of its participants carrying no busy
  // row at all. It used to have a transaction of its own, which kept the two
  // halves together but not the slots with the new time and roster: a failure
  // here left the rehearsal moved and its people busy at the old hour (R4: D03).
  await deleteRehearsalSlots(rehearsalId, tx);
  await bookRehearsalSlots(rehearsalId, projectId, startsAt, endsAt, tx);

  logger.debug(`[updateRehearsalSlots] DONE - Updated slots for rehearsal ${rehearsalId}`);
}

/**
 * Delete all availability slots associated with a rehearsal
 * @param {number} rehearsalId - Rehearsal ID
 */
export async function deleteRehearsalSlots(rehearsalId, conn = db) {
  logger.debug(`[deleteRehearsalSlots] START - Deleting slots for rehearsal ID: ${rehearsalId}`);
  logger.debug(`[deleteRehearsalSlots] Query params - source: "${AVAILABILITY_SOURCES.REHEARSAL}", external_event_id: "${rehearsalId.toString()}"`);

  const result = await conn.run(
    "DELETE FROM native_user_availability WHERE source = $1 AND external_event_id = $2",
    [AVAILABILITY_SOURCES.REHEARSAL, rehearsalId.toString()]
  );

  logger.debug(`[deleteRehearsalSlots] DONE - Delete result:`, result);
}

/**
 * Format date string to YYYY-MM-DD
 * @param {string} dateStr - Date string
 * @returns {string|null} - Formatted date or null
 */
export function formatDateString(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
