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

  // Fetch only rehearsals where user is invited (has a response record)
  const rehearsals = await db.all(
    `SELECT r.*, p.name as project_name,
            ur.response as user_response
     FROM native_rehearsals r
     JOIN native_projects p ON r.project_id = p.id
     INNER JOIN native_rehearsal_responses ur ON r.id = ur.rehearsal_id AND ur.user_id = ?
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
        // invited = number of participants invited to THIS rehearsal (not all project members)
        const invited = responses.length;

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
 * Get rehearsals for a project
 * For admins: returns all rehearsals
 * For regular members: returns only rehearsals where user is invited
 * @param {number} projectId - Project ID
 * @param {number} userId - User ID
 * @returns {Promise<Array>} - Array of rehearsals
 */
export async function getProjectRehearsals(projectId, userId) {
  console.log(`[getProjectRehearsals] START - projectId: ${projectId}, userId: ${userId}`);

  // Check if user is admin
  const isAdmin = await checkUserIsAdmin(projectId, userId);
  console.log(`[getProjectRehearsals] isAdmin: ${isAdmin}`);

  let rehearsals;

  if (isAdmin) {
    // Admin: get all rehearsals for the project (with optional RSVP data)
    rehearsals = await db.all(
      `SELECT r.*, ur.response as user_response
       FROM native_rehearsals r
       LEFT JOIN native_rehearsal_responses ur ON r.id = ur.rehearsal_id AND ur.user_id = $2
       WHERE r.project_id = $1
       ORDER BY r.starts_at DESC`,
      [projectId, userId]
    );
    console.log(`[getProjectRehearsals] Admin query returned ${rehearsals.length} rehearsals`);
  } else {
    // Regular member: only get rehearsals where user is invited
    rehearsals = await db.all(
      `SELECT r.*, ur.response as user_response
       FROM native_rehearsals r
       INNER JOIN native_rehearsal_responses ur ON r.id = ur.rehearsal_id AND ur.user_id = $2
       WHERE r.project_id = $1
       ORDER BY r.starts_at DESC`,
      [projectId, userId]
    );
    console.log(`[getProjectRehearsals] Member query returned ${rehearsals.length} rehearsals`);
  }

  const result = rehearsals.map(r => {
    const startsAtISO = timestampToISO(r.starts_at);
    const endsAtISO = timestampToISO(r.ends_at);

    // Parse ISO timestamps to extract date and time (legacy format for compatibility)
    const startsAtDate = new Date(r.starts_at);
    const endsAtDate = new Date(r.ends_at);

    // Format: YYYY-MM-DD
    const date = startsAtDate.toISOString().split('T')[0];

    // Format: HH:mm:ss
    const time = startsAtDate.toISOString().split('T')[1].substring(0, 8);
    const endTime = endsAtDate.toISOString().split('T')[1].substring(0, 8);

    return {
      id: String(r.id),
      projectId: String(r.project_id),
      title: r.title || 'Репетиция', // Fallback if title is NULL
      description: r.description,
      startsAt: startsAtISO,
      endsAt: endsAtISO,
      // Legacy format for backward compatibility
      date,
      time,
      endTime,
      status: 'scheduled', // Default status
      location: r.location,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      userResponse: r.user_response || null,
    };
  });

  console.log(`[getProjectRehearsals] Returning ${result.length} formatted rehearsals`);
  if (result.length > 0) {
    console.log(`[getProjectRehearsals] First rehearsal:`, JSON.stringify(result[0], null, 2));
  }

  return result;
}

/**
 * Create a new rehearsal
 * @param {number} projectId - Project ID
 * @param {number} userId - User ID (creator)
 * @param {object} rehearsalData - Rehearsal data
 * @returns {Promise<object>} - Created rehearsal
 */
export async function createRehearsal(projectId, userId, rehearsalData) {
  console.log(`[createRehearsal] START - projectId: ${projectId}, userId: ${userId}`);
  console.log(`[createRehearsal] rehearsalData:`, JSON.stringify(rehearsalData, null, 2));

  const { title, description, date, startTime, endTime, startsAt, endsAt, location, participant_ids } = rehearsalData;

  let startsAtISO, endsAtISO;

  // Support both new format (startsAt/endsAt) and old format (date/startTime/endTime)
  if (startsAt && endsAt) {
    // New format: ISO timestamps
    startsAtISO = startsAt;
    endsAtISO = endsAt;
    console.log(`[createRehearsal] Using new format - startsAt: ${startsAtISO}, endsAt: ${endsAtISO}`);
  } else if (date && startTime && endTime) {
    // Old format: convert to ISO timestamps
    const timezone = await getProjectTimezone(projectId);
    const formattedDate = formatDateString(date);
    if (!formattedDate) {
      throw new Error('Invalid date format');
    }
    startsAtISO = localToTimestamp(formattedDate, startTime, timezone);
    endsAtISO = localToTimestamp(formattedDate, endTime, timezone);
    console.log(`[createRehearsal] Using old format - startsAt: ${startsAtISO}, endsAt: ${endsAtISO}`);
  } else {
    console.error(`[createRehearsal] ERROR - Neither format provided!`);
    throw new Error('Either (startsAt, endsAt) or (date, startTime, endTime) are required');
  }

  console.log(`[createRehearsal] Inserting into database...`);
  console.log(`[createRehearsal] Parameters:`, {
    projectId,
    title: title || null,
    description: description || null,
    startsAtISO,
    endsAtISO,
    location: location || null,
    userId,
  });

  // Create rehearsal using new TIMESTAMPTZ columns
  const newRehearsal = await db.get(
    `INSERT INTO native_rehearsals (project_id, title, description, starts_at, ends_at, location, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6, $7, NOW(), NOW())
     RETURNING *`,
    [
      projectId,
      title || null,
      description || null,
      startsAtISO,
      endsAtISO,
      location || null,
      userId,
    ]
  );

  console.log(`[createRehearsal] Rehearsal created with ID: ${newRehearsal.id}`);

  // Add participant invitations with 'no' status (invited but not responded)
  if (participant_ids && participant_ids.length > 0) {
    console.log(`[createRehearsal] Adding ${participant_ids.length} RSVP records...`);
    for (const participantId of participant_ids) {
      await db.run(
        'INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
        [newRehearsal.id, participantId, 'no']
      );
    }
    console.log(`[createRehearsal] RSVP records added successfully`);
  } else {
    console.log(`[createRehearsal] No participant_ids provided - skipping RSVP records`);
  }

  // Book slots in user availability for selected participants
  console.log(`[createRehearsal] Booking rehearsal slots...`);
  await bookRehearsalSlots(
    newRehearsal.id,
    projectId,
    startsAtISO,
    endsAtISO
  );
  console.log(`[createRehearsal] Slots booked successfully`);

  const result = {
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

  console.log(`[createRehearsal] DONE - Returning:`, JSON.stringify(result, null, 2));
  return result;
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
     SET title = $1, description = $2, starts_at = $3::timestamptz, ends_at = $4::timestamptz, location = $5, updated_at = NOW()
     WHERE id = $6 AND project_id = $7
     RETURNING *`,
    [
      title || null,
      description || null,
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
  console.log(`[deleteRehearsal] START - Deleting rehearsal ID: ${rehearsalId}`);

  // Delete booked slots first
  console.log(`[deleteRehearsal] Step 1: Deleting availability slots...`);
  await deleteRehearsalSlots(rehearsalId);

  // Delete RSVP responses
  console.log(`[deleteRehearsal] Step 2: Deleting RSVP responses...`);
  await db.run('DELETE FROM native_rehearsal_responses WHERE rehearsal_id = $1', [rehearsalId]);

  // Delete rehearsal
  console.log(`[deleteRehearsal] Step 3: Deleting rehearsal record...`);
  await db.run('DELETE FROM native_rehearsals WHERE id = $1', [rehearsalId]);

  console.log(`[deleteRehearsal] DONE - Successfully deleted rehearsal ${rehearsalId}`);
}
