import db from '../../database/db.js';

/**
 * Respond to a rehearsal (like system: toggle between 'yes' and 'no')
 * @param {number} rehearsalId - Rehearsal ID
 * @param {number} userId - User ID
 * @param {string} response - 'yes' (liked) or 'no' (not responded)
 * @param {string|null} notes - Optional notes
 * @param {number} projectId - Project ID for calculating stats
 * @returns {Promise<object>} - Updated rehearsal stats (confirmed, invited)
 */
export async function respondToRehearsal(rehearsalId, userId, response, notes = null, projectId) {
  if (response === 'yes' || response === 'no') {
    // Update response (upsert)
    await db.run(
      `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response, notes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (rehearsal_id, user_id)
       DO UPDATE SET response = $3, notes = $4, updated_at = NOW()`,
      [rehearsalId, userId, response, notes]
    );

    // Update rehearsal timestamp
    await db.run(
      'UPDATE native_rehearsals SET updated_at = NOW() WHERE id = $1',
      [rehearsalId]
    );
  } else {
    throw new Error('Invalid response value. Must be "yes" or "no".');
  }

  // Get current stats: count responses and total members
  const responsesCount = await db.get(
    `SELECT
       COUNT(*) as total_responses,
       COUNT(CASE WHEN response = 'yes' THEN 1 END) as confirmed
     FROM native_rehearsal_responses
     WHERE rehearsal_id = $1`,
    [rehearsalId]
  );

  const memberCount = await db.get(
    `SELECT COUNT(*) as total_members
     FROM native_project_members
     WHERE project_id = $1 AND status = 'active'`,
    [projectId]
  );

  const confirmed = Number(responsesCount.confirmed) || 0;
  const totalMembers = Number(memberCount.total_members) || 0;
  const invited = totalMembers;

  return {
    confirmed,
    invited,
  };
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

  // Get only invited participants (those who have a response record)
  const allParticipants = await db.all(
    `SELECT
      u.id as user_id,
      u.first_name,
      u.last_name,
      u.email,
      r.response,
      r.notes,
      r.created_at,
      r.updated_at
     FROM native_rehearsal_responses r
     JOIN native_users u ON r.user_id = u.id
     WHERE r.rehearsal_id = $1
     ORDER BY u.first_name, u.last_name`,
    [rehearsalId]
  );

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
          name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
          email: p.email,
        },
      })),
    allParticipants: allParticipants.map((p) => ({
      userId: String(p.user_id),
      firstName: p.first_name,
      lastName: p.last_name,
      email: p.email,
      response: p.response,
    })),
    stats: {
      confirmed,
      invited,
    },
  };

  console.log(`[getRehearsalResponses] Rehearsal ${rehearsalId}: returning ${result.allParticipants.length} participants, stats:`, result.stats);
  return result;
}

/**
 * Get user's response for a rehearsal
 * @param {number} rehearsalId - Rehearsal ID
 * @param {number} userId - User ID
 * @returns {Promise<object|null>} - User's response or null
 */
export async function getUserResponse(rehearsalId, userId) {
  const response = await db.get(
    'SELECT * FROM native_rehearsal_responses WHERE rehearsal_id = $1 AND user_id = $2',
    [rehearsalId, userId]
  );

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
