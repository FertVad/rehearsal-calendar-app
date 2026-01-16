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
export async function bookRehearsalSlots(rehearsalId, projectId, startsAt, endsAt) {
  console.log(`[bookRehearsalSlots] START - Rehearsal ID: ${rehearsalId}, Time: ${startsAt} - ${endsAt}`);

  // Get participants who have responses (i.e., were invited to this rehearsal)
  const participants = await db.all(
    "SELECT DISTINCT user_id FROM native_rehearsal_responses WHERE rehearsal_id = $1",
    [rehearsalId]
  );

  console.log(`[bookRehearsalSlots] Found ${participants.length} participants:`, participants.map(p => p.user_id));

  // For each participant, insert a busy slot using TIMESTAMPTZ columns
  for (const participant of participants) {
    console.log(`[bookRehearsalSlots] Booking slot for user ${participant.user_id}`);
    await db.run(
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

  console.log(`[bookRehearsalSlots] DONE - Booked ${participants.length} slots for rehearsal ${rehearsalId}`);
}

/**
 * Update availability slots when rehearsal time is changed
 * @param {number} rehearsalId - Rehearsal ID
 * @param {number} projectId - Project ID
 * @param {string} startsAt - ISO 8601 timestamp
 * @param {string} endsAt - ISO 8601 timestamp
 */
export async function updateRehearsalSlots(rehearsalId, projectId, startsAt, endsAt) {
  console.log(`[updateRehearsalSlots] START - Rehearsal ID: ${rehearsalId}, New time: ${startsAt} - ${endsAt}`);

  // Delete existing booked slots
  await deleteRehearsalSlots(rehearsalId);

  // Book new slots
  await bookRehearsalSlots(rehearsalId, projectId, startsAt, endsAt);

  console.log(`[updateRehearsalSlots] DONE - Updated slots for rehearsal ${rehearsalId}`);
}

/**
 * Delete all availability slots associated with a rehearsal
 * @param {number} rehearsalId - Rehearsal ID
 */
export async function deleteRehearsalSlots(rehearsalId) {
  console.log(`[deleteRehearsalSlots] START - Deleting slots for rehearsal ID: ${rehearsalId}`);
  console.log(`[deleteRehearsalSlots] Query params - source: "${AVAILABILITY_SOURCES.REHEARSAL}", external_event_id: "${rehearsalId.toString()}"`);

  const result = await db.run(
    "DELETE FROM native_user_availability WHERE source = $1 AND external_event_id = $2",
    [AVAILABILITY_SOURCES.REHEARSAL, rehearsalId.toString()]
  );

  console.log(`[deleteRehearsalSlots] DONE - Delete result:`, result);
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
