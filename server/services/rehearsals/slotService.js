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
 * Book availability slots for all project members when rehearsal is created
 * @param {number} rehearsalId - Rehearsal ID
 * @param {number} projectId - Project ID
 * @param {string} startsAt - ISO 8601 timestamp
 * @param {string} endsAt - ISO 8601 timestamp
 */
export async function bookRehearsalSlots(rehearsalId, projectId, startsAt, endsAt) {
  // Get all project members
  const members = await db.all(
    "SELECT user_id FROM native_project_members WHERE project_id = $1 AND status = 'active'",
    [projectId]
  );

  // For each member, insert a busy slot using TIMESTAMPTZ columns
  for (const member of members) {
    await db.run(
      `INSERT INTO native_user_availability (user_id, starts_at, ends_at, type, source, external_event_id, title, is_all_day)
       VALUES ($1, $2::timestamptz, $3::timestamptz, $4, $5, $6, 'Rehearsal', FALSE)`,
      [
        member.user_id,
        startsAt,
        endsAt,
        AVAILABILITY_TYPES.BUSY,
        AVAILABILITY_SOURCES.REHEARSAL,
        rehearsalId.toString(),
      ]
    );
  }
}

/**
 * Update availability slots when rehearsal time is changed
 * @param {number} rehearsalId - Rehearsal ID
 * @param {number} projectId - Project ID
 * @param {string} startsAt - ISO 8601 timestamp
 * @param {string} endsAt - ISO 8601 timestamp
 */
export async function updateRehearsalSlots(rehearsalId, projectId, startsAt, endsAt) {
  // Delete existing booked slots
  await deleteRehearsalSlots(rehearsalId);

  // Book new slots
  await bookRehearsalSlots(rehearsalId, projectId, startsAt, endsAt);
}

/**
 * Delete all availability slots associated with a rehearsal
 * @param {number} rehearsalId - Rehearsal ID
 */
export async function deleteRehearsalSlots(rehearsalId) {
  await db.run(
    "DELETE FROM native_user_availability WHERE source = $1 AND external_event_id = $2",
    [AVAILABILITY_SOURCES.REHEARSAL, rehearsalId.toString()]
  );
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
