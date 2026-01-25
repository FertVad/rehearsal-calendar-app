/**
 * Push Notification Service
 * Handles sending push notifications via Expo Push API
 */

import { Expo } from 'expo-server-sdk';
import db from '../../database/db.js';
import { logger } from '../../utils/logger.js';

// Initialize Expo SDK
const expo = new Expo();

/**
 * Get active push tokens for given user IDs
 * @param {number[]} userIds - Array of user IDs
 * @returns {Promise<Array>} Array of {userId, token} objects
 */
export async function getUserPushTokens(userIds) {
  if (!userIds || userIds.length === 0) {
    return [];
  }

  const placeholders = userIds.map(() => '?').join(',');
  const tokens = await db.all(
    `SELECT t.user_id, t.device_token
     FROM native_push_tokens t
     JOIN native_users u ON t.user_id = u.id
     WHERE t.user_id IN (${placeholders})
       AND u.notifications_enabled = TRUE
     ORDER BY t.last_active_at DESC`,
    userIds
  );

  // Filter valid Expo push tokens
  return tokens.filter(({ device_token }) => Expo.isExpoPushToken(device_token));
}

/**
 * Send push notifications to multiple users
 * @param {number[]} userIds - Array of user IDs to notify
 * @param {Object} notification - Notification payload {title, body, data}
 * @returns {Promise<Object>} Result summary {sent, failed, errors}
 */
export async function sendPushNotification(userIds, notification) {
  try {
    const tokenData = await getUserPushTokens(userIds);

    if (tokenData.length === 0) {
      logger.info('[Push] No valid tokens found for users:', userIds);
      return { sent: 0, failed: 0, errors: [] };
    }

    // Build messages
    const messages = tokenData.map(({ device_token }) => ({
      to: device_token,
      sound: 'default',
      badge: 1,
      priority: 'high',
      channelId: 'rehearsal-notifications',
      ...notification,
    }));

    // Send in chunks of 100 (Expo limit)
    const chunks = expo.chunkPushNotifications(messages);
    let totalSent = 0;
    let totalFailed = 0;
    const allErrors = [];

    for (const chunk of chunks) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);

        tickets.forEach((ticket, index) => {
          if (ticket.status === 'ok') {
            totalSent++;
          } else {
            totalFailed++;
            logger.error('[Push] Ticket error:', ticket.message, ticket.details);
            allErrors.push(ticket.message);

            // Remove invalid tokens
            if (ticket.details?.error === 'DeviceNotRegistered') {
              const failedToken = chunk[index].to;
              removeInvalidToken(failedToken);
            }
          }
        });
      } catch (err) {
        logger.error('[Push] Chunk send error:', err);
        totalFailed += chunk.length;
        allErrors.push(err.message);
      }
    }

    logger.info(`[Push] Sent: ${totalSent}, Failed: ${totalFailed}`);
    return { sent: totalSent, failed: totalFailed, errors: allErrors };
  } catch (err) {
    logger.error('[Push] Send notification error:', err);
    return { sent: 0, failed: userIds.length, errors: [err.message] };
  }
}

/**
 * Remove invalid push token from database
 */
async function removeInvalidToken(token) {
  try {
    await db.run('DELETE FROM native_push_tokens WHERE device_token = ?', [token]);
    logger.info('[Push] Removed invalid token:', token);
  } catch (err) {
    logger.error('[Push] Error removing invalid token:', err);
  }
}

/**
 * Notification builders for different event types
 */

/**
 * Notify members when a new rehearsal is created
 * @param {Object} rehearsal - Rehearsal object
 * @param {string} projectName - Project name
 * @param {Array} members - Array of {user_id} objects
 */
export async function notifyRehearsalCreated(rehearsal, projectName, members) {
  const userIds = members.map(m => m.user_id).filter(id => id !== rehearsal.created_by);

  if (userIds.length === 0) return;

  const notification = {
    title: 'Новая репетиция',
    body: `${projectName}: ${rehearsal.title || 'Репетиция'} назначена`,
    data: {
      type: 'rehearsal_created',
      rehearsalId: rehearsal.id,
      projectId: rehearsal.project_id,
    },
  };

  await sendPushNotification(userIds, notification);
}

/**
 * Notify members when a rehearsal is updated
 * @param {Object} rehearsal - Updated rehearsal object
 * @param {string} projectName - Project name
 * @param {Array} members - Array of {user_id} objects
 * @param {string} changes - Description of changes (e.g., "дата/время, место")
 */
export async function notifyRehearsalUpdated(rehearsal, projectName, members, changes) {
  const userIds = members.map(m => m.user_id);

  if (userIds.length === 0) return;

  const notification = {
    title: 'Изменена репетиция',
    body: `${projectName}: ${rehearsal.title || 'Репетиция'} — ${changes}`,
    data: {
      type: 'rehearsal_updated',
      rehearsalId: rehearsal.id,
      projectId: rehearsal.project_id,
    },
  };

  await sendPushNotification(userIds, notification);
}

/**
 * Notify members when a rehearsal is deleted
 * @param {Object} rehearsal - Deleted rehearsal object
 * @param {string} projectName - Project name
 * @param {Array} members - Array of {user_id} objects
 */
export async function notifyRehearsalDeleted(rehearsal, projectName, members) {
  const userIds = members.map(m => m.user_id);

  if (userIds.length === 0) return;

  const notification = {
    title: 'Отменена репетиция',
    body: `${projectName}: ${rehearsal.title || 'Репетиция'} отменена`,
    data: {
      type: 'rehearsal_deleted',
      projectId: rehearsal.project_id,
    },
  };

  await sendPushNotification(userIds, notification);
}

/**
 * Notify admins when a member responds to a rehearsal
 * @param {Object} rehearsal - Rehearsal object
 * @param {string} projectName - Project name
 * @param {string} responderName - Name of user who responded
 * @param {number[]} adminIds - Array of admin user IDs
 */
export async function notifyMemberResponse(rehearsal, projectName, responderName, adminIds) {
  if (adminIds.length === 0) return;

  const notification = {
    title: 'Новый отклик',
    body: `${responderName} откликнулся на репетицию в проекте ${projectName}`,
    data: {
      type: 'member_response',
      rehearsalId: rehearsal.id,
      projectId: rehearsal.project_id,
    },
  };

  await sendPushNotification(adminIds, notification);
}

/**
 * Notify user when invited to a project
 * @param {string} projectName - Project name
 * @param {number} userId - User ID to notify
 * @param {string} inviterName - Name of user who invited
 */
export async function notifyProjectInvite(projectName, userId, inviterName) {
  const notification = {
    title: 'Приглашение в проект',
    body: `${inviterName} пригласил вас в проект ${projectName}`,
    data: {
      type: 'project_invite',
      projectName,
    },
  };

  await sendPushNotification([userId], notification);
}

/**
 * Notify user when their role is changed
 * @param {string} projectName - Project name
 * @param {number} userId - User ID to notify
 * @param {string} newRole - New role (admin, member, owner)
 */
export async function notifyRoleChanged(projectName, userId, newRole) {
  const roleText = newRole === 'admin' ? 'администратором' : 'участником';

  const notification = {
    title: 'Изменение роли',
    body: `Вы теперь ${roleText} проекта ${projectName}`,
    data: {
      type: 'role_changed',
      projectName,
      newRole,
    },
  };

  await sendPushNotification([userId], notification);
}

/**
 * Notify user when removed from a project
 * @param {string} projectName - Project name
 * @param {number} userId - User ID to notify
 */
export async function notifyMemberRemoved(projectName, userId) {
  const notification = {
    title: 'Удаление из проекта',
    body: `Вы были удалены из проекта ${projectName}`,
    data: {
      type: 'member_removed',
      projectName,
    },
  };

  await sendPushNotification([userId], notification);
}

/**
 * Notify all members when a project is deleted
 * @param {string} projectName - Project name
 * @param {number[]} memberIds - Array of member user IDs (excluding owner)
 */
export async function notifyProjectDeleted(projectName, memberIds) {
  if (memberIds.length === 0) return;

  const notification = {
    title: 'Проект удален',
    body: `Проект ${projectName} был удален`,
    data: {
      type: 'project_deleted',
      projectName,
    },
  };

  await sendPushNotification(memberIds, notification);
}

/**
 * Send 24-hour reminder for upcoming rehearsal
 * @param {Object} rehearsal - Rehearsal object
 * @param {string} projectName - Project name
 * @param {number[]} memberIds - Array of member user IDs
 */
export async function notifyRehearsal24h(rehearsal, projectName, memberIds) {
  if (memberIds.length === 0) return;

  const notification = {
    title: 'Репетиция завтра',
    body: `${projectName}: ${rehearsal.title || 'Репетиция'}`,
    data: {
      type: 'rehearsal_reminder_24h',
      rehearsalId: rehearsal.id,
      projectId: rehearsal.project_id,
    },
  };

  await sendPushNotification(memberIds, notification);
}

/**
 * Send 1-hour reminder for upcoming rehearsal
 * @param {Object} rehearsal - Rehearsal object
 * @param {string} projectName - Project name
 * @param {number[]} memberIds - Array of member user IDs
 */
export async function notifyRehearsal1h(rehearsal, projectName, memberIds) {
  if (memberIds.length === 0) return;

  const notification = {
    title: 'Репетиция через 1 час',
    body: `${projectName}: ${rehearsal.title || 'Репетиция'}`,
    data: {
      type: 'rehearsal_reminder_1h',
      rehearsalId: rehearsal.id,
      projectId: rehearsal.project_id,
    },
  };

  await sendPushNotification(memberIds, notification);
}
