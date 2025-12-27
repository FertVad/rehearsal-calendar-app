import db from '../../database/db.js';

/**
 * Respond to a rehearsal (like system: yes or null to unlike)
 * @param {number} rehearsalId - Rehearsal ID
 * @param {number} userId - User ID
 * @param {string|null} response - 'yes' or null
 * @param {string|null} notes - Optional notes
 * @param {number} projectId - Project ID for calculating stats
 * @returns {Promise<object>} - Updated rehearsal stats (confirmed, invited)
 */
export async function respondToRehearsal(rehearsalId, userId, response, notes = null, projectId) {
  if (response === 'yes') {
    // Like: upsert response
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
  } else if (response === null) {
    // Unlike: delete response
    await db.run(
      'DELETE FROM native_rehearsal_responses WHERE rehearsal_id = $1 AND user_id = $2',
      [rehearsalId, userId]
    );

    // Update rehearsal timestamp
    await db.run(
      'UPDATE native_rehearsals SET updated_at = NOW() WHERE id = $1',
      [rehearsalId]
    );
  } else {
    throw new Error('Invalid response value. Must be "yes" or null.');
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
  const totalResponses = Number(responsesCount.total_responses) || 0;
  const invited = totalMembers - totalResponses;

  return {
    confirmed,
    invited,
  };
}

/**
 * Get all responses for a rehearsal
 * @param {number} rehearsalId - Rehearsal ID
 * @returns {Promise<Array>} - Array of responses with user info
 */
export async function getRehearsalResponses(rehearsalId) {
  const responses = await db.all(
    `SELECT
      r.id,
      r.rehearsal_id,
      r.user_id,
      r.response,
      r.notes,
      r.created_at,
      r.updated_at,
      u.name as user_name,
      u.email as user_email
     FROM native_rehearsal_responses r
     JOIN users u ON r.user_id = u.id
     WHERE r.rehearsal_id = $1
     ORDER BY r.created_at DESC`,
    [rehearsalId]
  );

  return responses.map((r) => ({
    id: String(r.id),
    rehearsalId: String(r.rehearsal_id),
    userId: String(r.user_id),
    response: r.response,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    user: {
      id: String(r.user_id),
      name: r.user_name,
      email: r.user_email,
    },
  }));
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
