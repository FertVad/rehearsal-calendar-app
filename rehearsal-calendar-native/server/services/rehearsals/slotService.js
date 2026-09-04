import { logger } from '../../utils/logger.js';
import db from '../../database/db.js';
import { DEFAULT_TIMEZONE, AVAILABILITY_TYPES, AVAILABILITY_SOURCES } from '../../constants/timezone.js';

/**
 * Get project's timezone setting
 * @param {number} projectId - Project ID
 * @returns {Promise<string>} - IANA timezone string
 */
export async function getProjectTimezone(projectId) {
  const project = await db.get(
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

  // Get participants who have responses (i.e., were invited to this rehearsal)
  const participants = await conn.all(
    "SELECT DISTINCT user_id FROM native_rehearsal_responses WHERE rehearsal_id = $1",
    [rehearsalId]
  );

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
 */
export async function updateRehearsalSlots(rehearsalId, projectId, startsAt, endsAt) {
  logger.debug(`[updateRehearsalSlots] START - Rehearsal ID: ${rehearsalId}, New time: ${startsAt} - ${endsAt}`);

  // Both halves or neither. This is delete-then-reinsert, and a failure in
  // between — a function timing out partway through a large cast, a connection
  // dropping mid-loop — left the rehearsal standing with some or all of its
  // participants carrying no busy row at all. Nothing retries, so they would
  // have read free during their own rehearsal until somebody happened to edit
  // it again.
  await db.transaction(async (tx) => {
    await deleteRehearsalSlots(rehearsalId, tx);
    await bookRehearsalSlots(rehearsalId, projectId, startsAt, endsAt, tx);
  });

  logger.debug(`[updateRehearsalSlots] DONE - Updated slots for rehearsal ${rehearsalId}`);
}

/**
 * Make sure one participant has the busy slot their rehearsal implies.
 *
 * Slots are otherwise written only when a rehearsal is created or edited, but a
 * roster row is what puts someone on a rehearsal — and `/respond` writes one.
 * An admin sees rehearsals they are not on and the eye is live on every card,
 * so one tap adds them to the call with no busy time booked, and they would
 * read free in the planner during their own rehearsal.
 *
 * @param {number} rehearsalId - Rehearsal ID
 * @param {number} userId - User ID
 */
export async function ensureRehearsalSlot(rehearsalId, userId) {
  const existing = await db.get(
    `SELECT id FROM native_user_availability
     WHERE user_id = $1 AND source = $2 AND external_event_id = $3`,
    [userId, AVAILABILITY_SOURCES.REHEARSAL, rehearsalId.toString()]
  );

  if (existing) return;

  const rehearsal = await db.get(
    'SELECT starts_at, ends_at FROM native_rehearsals WHERE id = $1',
    [rehearsalId]
  );

  if (!rehearsal) return;

  logger.debug(`[ensureRehearsalSlot] Booking missing slot for user ${userId} on rehearsal ${rehearsalId}`);
  await db.run(
    `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, source, external_event_id, title, is_all_day)
     VALUES ($1, $2::timestamptz, $3::timestamptz, $4, $5, $6, 'Rehearsal', FALSE)`,
    [
      userId,
      rehearsal.starts_at,
      rehearsal.ends_at,
      AVAILABILITY_TYPES.BUSY,
      AVAILABILITY_SOURCES.REHEARSAL,
      rehearsalId.toString(),
    ]
  );
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
