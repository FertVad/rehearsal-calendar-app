import { logger } from '../../utils/logger.js';
import db from '../../database/db.js';
import { localToTimestamp, timestampToISO, timestampToLocal } from '../../utils/timezone.js';
import { DEFAULT_TIMEZONE } from '../../constants/timezone.js';
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
    // Get all responses for admin rehearsals - only from active project members
    const allResponses = await db.all(
      `SELECT r.rehearsal_id, r.response, reh.project_id
       FROM native_rehearsal_responses r
       JOIN native_rehearsals reh ON r.rehearsal_id = reh.id
       JOIN native_project_members pm ON pm.user_id = r.user_id AND pm.project_id = reh.project_id
       WHERE r.rehearsal_id IN (${adminRehearsalIds.map(() => '?').join(',')})
       AND pm.status = 'active'`,
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
  logger.debug(`[getProjectRehearsals] START - projectId: ${projectId}, userId: ${userId}`);

  // Get user's timezone for correct date/time conversion
  const userResult = await db.get(
    'SELECT timezone FROM native_users WHERE id = $1',
    [userId]
  );
  const userTimezone = userResult?.timezone || DEFAULT_TIMEZONE;
  logger.debug(`[getProjectRehearsals] User timezone: ${userTimezone}`);

  // Check if user is admin
  const isAdmin = await checkUserIsAdmin(projectId, userId);
  logger.debug(`[getProjectRehearsals] isAdmin: ${isAdmin}`);

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
    logger.debug(`[getProjectRehearsals] Admin query returned ${rehearsals.length} rehearsals`);
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
    logger.debug(`[getProjectRehearsals] Member query returned ${rehearsals.length} rehearsals`);
  }

  const result = rehearsals.map(r => {
    const startsAtISO = timestampToISO(r.starts_at);
    const endsAtISO = timestampToISO(r.ends_at);

    // Convert timestamps to user's local timezone
    const startLocal = timestampToLocal(startsAtISO, userTimezone);
    const endLocal = timestampToLocal(endsAtISO, userTimezone);

    // Legacy format fields (date, time, endTime) in user's timezone
    const date = startLocal.date;
    const time = `${startLocal.time}:00`; // Add seconds for HH:mm:ss format
    const endTime = `${endLocal.time}:00`;

    return {
      id: String(r.id),
      projectId: String(r.project_id),
      title: r.title, // null/empty handled on frontend via i18n
      description: r.description,
      startsAt: startsAtISO,
      endsAt: endsAtISO,
      // Legacy format for backward compatibility - now in user's timezone
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

  logger.debug(`[getProjectRehearsals] Returning ${result.length} formatted rehearsals`);
  if (result.length > 0) {
    logger.debug(`[getProjectRehearsals] First rehearsal:`, JSON.stringify(result[0], null, 2));
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
  logger.debug(`[createRehearsal] START - projectId: ${projectId}, userId: ${userId}`);
  logger.debug(`[createRehearsal] rehearsalData:`, JSON.stringify(rehearsalData, null, 2));

  const { title, description, date, startTime, endTime, startsAt, endsAt, location, participant_ids } = rehearsalData;

  let startsAtISO, endsAtISO;

  // Support both new format (startsAt/endsAt) and old format (date/startTime/endTime)
  if (startsAt && endsAt) {
    // New format: ISO timestamps
    startsAtISO = startsAt;
    endsAtISO = endsAt;
    logger.debug(`[createRehearsal] Using new format - startsAt: ${startsAtISO}, endsAt: ${endsAtISO}`);
  } else if (date && startTime && endTime) {
    // Old format: convert to ISO timestamps
    const timezone = await getProjectTimezone(projectId);
    const formattedDate = formatDateString(date);
    if (!formattedDate) {
      throw new Error('Invalid date format');
    }
    startsAtISO = localToTimestamp(formattedDate, startTime, timezone);
    endsAtISO = localToTimestamp(formattedDate, endTime, timezone);
    logger.debug(`[createRehearsal] Using old format - startsAt: ${startsAtISO}, endsAt: ${endsAtISO}`);
  } else {
    console.error(`[createRehearsal] ERROR - Neither format provided!`);
    throw new Error('Either (startsAt, endsAt) or (date, startTime, endTime) are required');
  }

  logger.debug(`[createRehearsal] Inserting into database...`);
  logger.debug(`[createRehearsal] Parameters:`, {
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

  logger.debug(`[createRehearsal] Rehearsal created with ID: ${newRehearsal.id}`);

  // Add participant invitations with 'no' status (invited but not responded)
  if (participant_ids && participant_ids.length > 0) {
    logger.debug(`[createRehearsal] Adding ${participant_ids.length} RSVP records...`);
    for (const participantId of participant_ids) {
      await db.run(
        'INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
        [newRehearsal.id, participantId, 'no']
      );
    }
    logger.debug(`[createRehearsal] RSVP records added successfully`);
  } else {
    logger.debug(`[createRehearsal] No participant_ids provided - skipping RSVP records`);
  }

  // Book slots in user availability for selected participants
  logger.debug(`[createRehearsal] Booking rehearsal slots...`);
  await bookRehearsalSlots(
    newRehearsal.id,
    projectId,
    startsAtISO,
    endsAtISO
  );
  logger.debug(`[createRehearsal] Slots booked successfully`);

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

  logger.debug(`[createRehearsal] DONE - Returning:`, JSON.stringify(result, null, 2));
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

  // Participants first, slots second. bookRehearsalSlots reads the roster out
  // of native_rehearsal_responses, so doing it the other way round books the
  // people who *were* on the rehearsal: someone added by this edit gets no
  // busy slot at all, and someone removed keeps one.
  if (participant_ids !== undefined) {
    const ids = participant_ids.map(Number).filter((id) => Number.isInteger(id));

    // Drop anyone no longer on the rehearsal, keep the rest as they are.
    if (ids.length > 0) {
      const placeholders = ids.map((_, i) => `$${i + 2}`).join(', ');
      await db.run(
        `DELETE FROM native_rehearsal_responses
         WHERE rehearsal_id = $1 AND user_id NOT IN (${placeholders})`,
        [rehearsalId, ...ids]
      );
    } else {
      await db.run('DELETE FROM native_rehearsal_responses WHERE rehearsal_id = $1', [rehearsalId]);
    }

    // Newcomers are invited-but-unseen, exactly as on creation. Re-inserting
    // everyone as 'yes' used to mark the whole cast as having seen a rehearsal
    // the moment it changed, which is the one time they have not.
    for (const userId of ids) {
      await db.run(
        `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response, created_at, updated_at)
         VALUES ($1, $2, 'no', NOW(), NOW())
         ON CONFLICT (rehearsal_id, user_id) DO NOTHING`,
        [rehearsalId, userId]
      );
    }
  }

  // Rebuild the busy slots from the roster we just settled
  await updateRehearsalSlots(
    rehearsalId,
    projectId,
    startsAtISO,
    endsAtISO
  );

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
  logger.debug(`[deleteRehearsal] START - Deleting rehearsal ID: ${rehearsalId}`);

  // Delete booked slots first
  logger.debug(`[deleteRehearsal] Step 1: Deleting availability slots...`);
  await deleteRehearsalSlots(rehearsalId);

  // Delete RSVP responses
  logger.debug(`[deleteRehearsal] Step 2: Deleting RSVP responses...`);
  await db.run('DELETE FROM native_rehearsal_responses WHERE rehearsal_id = $1', [rehearsalId]);

  // Delete rehearsal
  logger.debug(`[deleteRehearsal] Step 3: Deleting rehearsal record...`);
  await db.run('DELETE FROM native_rehearsals WHERE id = $1', [rehearsalId]);

  logger.debug(`[deleteRehearsal] DONE - Successfully deleted rehearsal ${rehearsalId}`);
}
