import { logger } from '../../utils/logger.js';
import db from '../../database/db.js';
import { fullName } from '../../utils/names.js';
import { answer, rosterStats, rosterWithNames, placeOnRoster, RosterRefused } from './roster.js';

/**
 * Mark a rehearsal seen ('yes') or not yet seen ('no').
 *
 * Changes the answer of someone already on the rehearsal and nothing else. It
 * used to upsert: an answer from someone with no row put them on the call, so a
 * member could add themselves to a rehearsal they were never invited to by
 * knowing its id (review D02). Now an answer from anyone not on it is refused
 * and writes nothing (roster.js).
 *
 * @returns {Promise<{confirmed: number, invited: number}>} the rehearsal's counts
 */
export async function respondToRehearsal(rehearsalId, userId, response, notes = null) {
  if (response !== 'yes' && response !== 'no') {
    throw new RosterRefused(400, 'RESPONSE_INVALID', 'response must be "yes" or "no"');
  }
  await answer(db, rehearsalId, userId, response, notes ?? null);

  // Update rehearsal timestamp
  await db.run('UPDATE native_rehearsals SET updated_at = NOW() WHERE id = $1', [rehearsalId]);

  // `invited` is the people on THIS rehearsal, which is what the list endpoint
  // and the participants screen both report. Counting the whole project here
  // made the number jump the moment you tapped — 2 of 5 became 3 of 8 — and
  // snap back on the next refresh.
  return (await rosterStats(db, [Number(rehearsalId)])).get(Number(rehearsalId)) || { confirmed: 0, invited: 0 };
}

/**
 * Get all responses for a rehearsal
 * @param {number} rehearsalId - Rehearsal ID
 * @returns {Promise<object>} - Object with responses array and allParticipants array
 */
export async function getRehearsalResponses(rehearsalId) {
  // Get the project ID for this rehearsal
  const rehearsal = await db.get(
    'SELECT project_id FROM native_rehearsals WHERE id = $1',
    [rehearsalId]
  );

  if (!rehearsal) {
    return { responses: [], allParticipants: [] };
  }

  // The people on it who are still active members of the project (roster.js).
  const allParticipants = await rosterWithNames(db, rehearsalId);

  // Calculate stats
  const confirmed = allParticipants.filter((p) => p.response === 'yes').length;
  const invited = allParticipants.length;

  const result = {
    responses: allParticipants
      .filter((p) => p.response !== null)
      .map((p) => ({
        id: p.user_id,
        rehearsalId: String(rehearsalId),
        userId: String(p.user_id),
        response: p.response,
        notes: p.notes,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        user: {
          id: String(p.user_id),
          name: fullName(p),
        },
      })),
    allParticipants: allParticipants.map((p) => ({
      userId: String(p.user_id),
      firstName: p.first_name,
      lastName: p.last_name,
      response: p.response,
    })),
    stats: {
      confirmed,
      invited,
    },
  };

  logger.debug(`[getRehearsalResponses] Rehearsal ${rehearsalId}: returning ${result.allParticipants.length} participants, stats:`, result.stats);
  return result;
}

/**
 * Get user's response for a rehearsal
 * @param {number} rehearsalId - Rehearsal ID
 * @param {number} userId - User ID
 * @returns {Promise<object|null>} - User's response or null
 */
export async function getUserResponse(rehearsalId, userId) {
  const response = await placeOnRoster(db, rehearsalId, userId);

  if (!response) {
    return null;
  }

  return {
    id: String(response.id),
    rehearsalId: String(response.rehearsal_id),
    userId: String(response.user_id),
    response: response.response,
    notes: response.notes,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
  };
}
