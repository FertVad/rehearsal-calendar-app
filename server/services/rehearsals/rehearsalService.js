import db from '../../database/db.js';
import { localToTimestamp, timestampToISO } from '../../utils/timezone.js';
import { getProjectTimezone, formatDateString, bookRehearsalSlots, updateRehearsalSlots, deleteRehearsalSlots } from './slotService.js';

/**
 * Check if user is an active member of the project
 * @param {number} projectId - Project ID
 * @param {number} userId - User ID
 * @returns {Promise<object|null>} - Membership object or null
 */
export async function checkUserMembership(projectId, userId) {
  return await db.get(
    "SELECT * FROM native_project_members WHERE project_id = $1 AND user_id = $2 AND status = 'active'",
    [projectId, userId]
  );
}

/**
 * Check if user is admin/owner of the project
 * @param {number} projectId - Project ID
 * @param {number} userId - User ID
 * @returns {Promise<boolean>} - True if user is admin/owner
 */
export async function checkUserIsAdmin(projectId, userId) {
  const membership = await checkUserMembership(projectId, userId);
  return membership && (membership.role === 'owner' || membership.role === 'admin');
}

/**
 * Check if rehearsal exists
 * @param {number} rehearsalId - Rehearsal ID
 * @param {number|null} projectId - Optional project ID for additional check
 * @returns {Promise<object|null>} - Rehearsal object or null
 */
export async function checkRehearsalExists(rehearsalId, projectId = null) {
  if (projectId) {
    return await db.get(
      'SELECT * FROM native_rehearsals WHERE id = $1 AND project_id = $2',
      [rehearsalId, projectId]
    );
  }
  return await db.get('SELECT * FROM native_rehearsals WHERE id = $1', [rehearsalId]);
}

/**
 * Get rehearsals for multiple projects (batch operation)
 * @param {Array<string>} projectIds - Array of project IDs
 * @param {number} userId - User ID
 * @returns {Promise<Array>} - Array of rehearsals with admin stats
 */
export async function getRehearsalsForProjects(projectIds, userId) {
  if (projectIds.length === 0) {
    return [];
  }

  // Check user membership for all projects in one query
  const memberships = await db.all(
    `SELECT project_id FROM native_project_members
     WHERE project_id IN (${projectIds.map(() => '?').join(',')})
     AND user_id = ?
     AND status = 'active'`,
    [...projectIds, userId]
  );

  const accessibleProjectIds = memberships.map(m => String(m.project_id));

  if (accessibleProjectIds.length === 0) {
    return [];
  }

  // Fetch all rehearsals for accessible projects with user's RSVP data
  const rehearsals = await db.all(
    `SELECT r.*, p.name as project_name,
            ur.response as user_response
     FROM native_rehearsals r
     JOIN native_projects p ON r.project_id = p.id
     LEFT JOIN native_rehearsal_responses ur ON r.id = ur.rehearsal_id AND ur.user_id = ?
     WHERE r.project_id IN (${accessibleProjectIds.map(() => '?').join(',')})
     ORDER BY r.starts_at DESC`,
    [userId, ...accessibleProjectIds]
  );

  // For each rehearsal, fetch admin stats if user is admin
  // Group rehearsals by project to check admin status
  const projectAdminMap = {};
  const membershipsWithRole = await db.all(
    `SELECT project_id, role FROM native_project_members
     WHERE project_id IN (${accessibleProjectIds.map(() => '?').join(',')})
     AND user_id = ?
     AND status = 'active'`,
    [...accessibleProjectIds, userId]
  );

  for (const m of membershipsWithRole) {
    projectAdminMap[m.project_id] = (m.role === 'owner' || m.role === 'admin');
  }

  // Collect rehearsal IDs where user is admin
  const adminRehearsalIds = rehearsals
    .filter(r => projectAdminMap[r.project_id])
    .map(r => r.id);

  // Fetch stats for admin rehearsals in batch
  const statsMap = {};
  if (adminRehearsalIds.length > 0) {
    // Get all responses for admin rehearsals
    const allResponses = await db.all(
      `SELECT rehearsal_id, response
       FROM native_rehearsal_responses
       WHERE rehearsal_id IN (${adminRehearsalIds.map(() => '?').join(',')})`,
      adminRehearsalIds
    );

    // Get total members for each project
    const projectMemberCounts = await db.all(
      `SELECT project_id, COUNT(*) as member_count
       FROM native_project_members
       WHERE project_id IN (${accessibleProjectIds.map(() => '?').join(',')})
       AND status = 'active'
       GROUP BY project_id`,
      accessibleProjectIds
    );

    const memberCountMap = {};
    for (const pm of projectMemberCounts) {
      memberCountMap[pm.project_id] = pm.member_count;
    }

    // Calculate stats for each rehearsal
    const responsesByRehearsal = {};
    for (const response of allResponses) {
      if (!responsesByRehearsal[response.rehearsal_id]) {
        responsesByRehearsal[response.rehearsal_id] = [];
      }
      responsesByRehearsal[response.rehearsal_id].push(response.response);
    }

    for (const rehearsal of rehearsals) {
      if (adminRehearsalIds.includes(rehearsal.id)) {
        const responses = responsesByRehearsal[rehearsal.id] || [];
        const confirmed = responses.filter(r => r === 'yes').length;
        const totalMembers = memberCountMap[rehearsal.project_id] || 0;
        const invited = totalMembers - responses.length;

        statsMap[rehearsal.id] = { confirmed, invited };
      }
    }
  }

  return rehearsals.map(r => ({
    id: String(r.id),
    projectId: String(r.project_id),
    projectName: r.project_name,
    title: r.title,
    description: r.description,
    startsAt: timestampToISO(r.starts_at),
    endsAt: timestampToISO(r.ends_at),
    location: r.location,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    userResponse: r.user_response || null,
    adminStats: statsMap[r.id] || null,
  }));
}

/**
 * Get all rehearsals for a project
 * @param {number} projectId - Project ID
 * @returns {Promise<Array>} - Array of rehearsals
 */
export async function getProjectRehearsals(projectId) {
  const rehearsals = await db.all(
    `SELECT * FROM native_rehearsals
     WHERE project_id = $1
     ORDER BY starts_at DESC`,
    [projectId]
  );

  return rehearsals.map(r => ({
    id: String(r.id),
    projectId: String(r.project_id),
    title: r.title,
    description: r.description,
    startsAt: timestampToISO(r.starts_at),
    endsAt: timestampToISO(r.ends_at),
    location: r.location,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/**
 * Create a new rehearsal
 * @param {number} projectId - Project ID
 * @param {number} userId - User ID (creator)
 * @param {object} rehearsalData - Rehearsal data
 * @returns {Promise<object>} - Created rehearsal
 */
export async function createRehearsal(projectId, userId, rehearsalData) {
  const { title, description, date, startTime, endTime, startsAt, endsAt, location } = rehearsalData;

  let startsAtISO, endsAtISO;

  // Support both new format (startsAt/endsAt) and old format (date/startTime/endTime)
  if (startsAt && endsAt) {
    // New format: ISO timestamps
    startsAtISO = startsAt;
    endsAtISO = endsAt;
  } else if (date && startTime && endTime) {
    // Old format: convert to ISO timestamps
    const timezone = await getProjectTimezone(projectId);
    const formattedDate = formatDateString(date);
    if (!formattedDate) {
      throw new Error('Invalid date format');
    }
    startsAtISO = localToTimestamp(formattedDate, startTime, timezone);
    endsAtISO = localToTimestamp(formattedDate, endTime, timezone);
  } else {
    throw new Error('Either (startsAt, endsAt) or (date, startTime, endTime) are required');
  }

  // Create rehearsal using new TIMESTAMPTZ columns
  const newRehearsal = await db.get(
    `INSERT INTO native_rehearsals (project_id, starts_at, ends_at, location, created_by, created_at, updated_at)
     VALUES ($1, $2::timestamptz, $3::timestamptz, $4, $5, NOW(), NOW())
     RETURNING *`,
    [
      projectId,
      startsAtISO,
      endsAtISO,
      location || null,
      userId,
    ]
  );

  // Book slots in user availability for all project members
  await bookRehearsalSlots(
    newRehearsal.id,
    projectId,
    startsAtISO,
    endsAtISO
  );

  return {
    id: String(newRehearsal.id),
    projectId: String(newRehearsal.project_id),
    title: newRehearsal.title,
    description: newRehearsal.description,
    startsAt: timestampToISO(newRehearsal.starts_at),
    endsAt: timestampToISO(newRehearsal.ends_at),
    location: newRehearsal.location,
    createdAt: newRehearsal.created_at,
    updatedAt: newRehearsal.updated_at,
  };
}

/**
 * Update a rehearsal
 * @param {number} rehearsalId - Rehearsal ID
 * @param {number} projectId - Project ID
 * @param {object} updateData - Update data
 * @returns {Promise<object>} - Updated rehearsal
 */
export async function updateRehearsal(rehearsalId, projectId, updateData) {
  const { title, description, date, startTime, endTime, startsAt, endsAt, location, participant_ids } = updateData;

  let startsAtISO, endsAtISO;

  // Support both new format (startsAt/endsAt) and old format (date/startTime/endTime)
  if (startsAt && endsAt) {
    // New format: ISO timestamps
    startsAtISO = startsAt;
    endsAtISO = endsAt;
  } else if (date && startTime && endTime) {
    // Old format: convert to ISO timestamps
    const timezone = await getProjectTimezone(projectId);
    const formattedDate = formatDateString(date);
    if (!formattedDate) {
      throw new Error('Invalid date format');
    }
    startsAtISO = localToTimestamp(formattedDate, startTime, timezone);
    endsAtISO = localToTimestamp(formattedDate, endTime, timezone);
  } else {
    throw new Error('Either (startsAt, endsAt) or (date, startTime, endTime) are required');
  }

  // Update rehearsal using new TIMESTAMPTZ columns
  const updatedRehearsal = await db.get(
    `UPDATE native_rehearsals
     SET starts_at = $1::timestamptz, ends_at = $2::timestamptz, location = $3, updated_at = NOW()
     WHERE id = $4 AND project_id = $5
     RETURNING *`,
    [
      startsAtISO,
      endsAtISO,
      location || null,
      rehearsalId,
      projectId,
    ]
  );

  // Update booked slots
  await updateRehearsalSlots(
    rehearsalId,
    projectId,
    startsAtISO,
    endsAtISO
  );

  // Update participants if provided
  if (participant_ids !== undefined) {
    // Delete existing responses for this rehearsal
    await db.run('DELETE FROM native_rehearsal_responses WHERE rehearsal_id = $1', [rehearsalId]);

    // Insert new participant responses (if any selected)
    if (participant_ids.length > 0) {
      for (const userId of participant_ids) {
        await db.run(
          'INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
          [rehearsalId, userId, 'yes']
        );
      }
    }
  }

  return {
    id: String(updatedRehearsal.id),
    projectId: String(updatedRehearsal.project_id),
    title: updatedRehearsal.title,
    description: updatedRehearsal.description,
    startsAt: timestampToISO(updatedRehearsal.starts_at),
    endsAt: timestampToISO(updatedRehearsal.ends_at),
    location: updatedRehearsal.location,
    createdAt: updatedRehearsal.created_at,
    updatedAt: updatedRehearsal.updated_at,
  };
}

/**
 * Delete a rehearsal
 * @param {number} rehearsalId - Rehearsal ID
 * @returns {Promise<void>}
 */
export async function deleteRehearsal(rehearsalId) {
  // Delete booked slots first
  await deleteRehearsalSlots(rehearsalId);

  // Delete RSVP responses
  await db.run('DELETE FROM native_rehearsal_responses WHERE rehearsal_id = $1', [rehearsalId]);

  // Delete rehearsal
  await db.run('DELETE FROM native_rehearsals WHERE id = $1', [rehearsalId]);
}
