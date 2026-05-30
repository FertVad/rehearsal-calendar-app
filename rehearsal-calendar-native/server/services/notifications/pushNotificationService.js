/**
 * Push Notification Service
 * Handles sending push notifications via Expo Push API
 */

import { Expo } from 'expo-server-sdk';
import db from '../../database/db.js';
import { logger } from '../../utils/logger.js';
import { t } from '../../i18n/pushNotifications.js';

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
 * Fetch locale preference for given user IDs.
 * Returns a Map of userId → locale ('ru' | 'en'), falling back to 'en'.
 */
async function getUserLocales(userIds) {
  if (userIds.length === 0) return new Map();
  const placeholders = userIds.map(() => '?').join(',');
  const rows = await db.all(
    `SELECT id, locale FROM native_users WHERE id IN (${placeholders})`,
    userIds
  );
  return new Map(rows.map(r => [r.id, r.locale || 'en']));
}

/**
 * Group user IDs by their locale.
 * Returns Map<locale, userIds[]>.
 */
function groupByLocale(userIds, localesMap) {
  const groups = new Map();
  for (const userId of userIds) {
    const locale = localesMap.get(userId) || 'en';
    if (!groups.has(locale)) groups.set(locale, []);
    groups.get(locale).push(userId);
  }
  return groups;
}

/**
 * Send a localized notification to a list of users.
 * @param {number[]} userIds
 * @param {string} key - Translation key in pushNotifications.js
 * @param {Object} params - Params passed to the body template
 * @param {Object} data - Notification data payload (same for all locales)
 */
async function sendLocalizedNotification(userIds, key, params, data) {
  if (userIds.length === 0) return;
  const locales = await getUserLocales(userIds);
  const groups = groupByLocale(userIds, locales);

  for (const [locale, ids] of groups.entries()) {
    const tr = t(locale, key);
    await sendPushNotification(ids, {
      title: tr.title,
      body: tr.body(params),
      data,
    });
  }
}

/**
 * Notify members when a new rehearsal is created
 */
export async function notifyRehearsalCreated(rehearsal, projectName, members) {
  const userIds = members.map(m => m.user_id).filter(id => id !== rehearsal.created_by);
  await sendLocalizedNotification(
    userIds,
    'newRehearsal',
    { projectName, rehearsalTitle: rehearsal.title },
    { type: 'rehearsal_created', rehearsalId: rehearsal.id, projectId: rehearsal.project_id }
  );
}

/**
 * Notify members when a rehearsal is updated
 * @param {string[]} changeKeys - keys from translations.changes (e.g. ['datetime', 'location'])
 */
export async function notifyRehearsalUpdated(rehearsal, projectName, members, changeKeys) {
  const userIds = members.map(m => m.user_id);
  if (userIds.length === 0) return;

  const locales = await getUserLocales(userIds);
  const groups = groupByLocale(userIds, locales);

  for (const [locale, ids] of groups.entries()) {
    const tr = t(locale, 'rehearsalUpdated');
    const changesDict = t(locale, 'changes');
    const localizedChanges = changeKeys && changeKeys.length > 0
      ? changeKeys.map(k => changesDict[k] || k).join(', ')
      : changesDict.default;

    await sendPushNotification(ids, {
      title: tr.title,
      body: tr.body({ projectName, rehearsalTitle: rehearsal.title, changes: localizedChanges }),
      data: { type: 'rehearsal_updated', rehearsalId: rehearsal.id, projectId: rehearsal.project_id },
    });
  }
}

/**
 * Notify members when a rehearsal is deleted
 */
export async function notifyRehearsalDeleted(rehearsal, projectName, members) {
  const userIds = members.map(m => m.user_id);
  await sendLocalizedNotification(
    userIds,
    'rehearsalDeleted',
    { projectName, rehearsalTitle: rehearsal.title },
    { type: 'rehearsal_deleted', projectId: rehearsal.project_id }
  );
}

/**
 * Notify admins when a member responds to a rehearsal
 */
export async function notifyMemberResponse(rehearsal, projectName, responderName, adminIds) {
  await sendLocalizedNotification(
    adminIds,
    'memberResponse',
    { responderName, projectName },
    { type: 'member_response', rehearsalId: rehearsal.id, projectId: rehearsal.project_id }
  );
}

/**
 * Notify user when invited to a project
 */
export async function notifyProjectInvite(projectName, userId, inviterName) {
  await sendLocalizedNotification(
    [userId],
    'projectInvite',
    { inviterName, projectName },
    { type: 'project_invite', projectName }
  );
}

/**
 * Notify user when their role is changed
 */
export async function notifyRoleChanged(projectName, userId, newRole) {
  const locales = await getUserLocales([userId]);
  const locale = locales.get(userId) || 'en';
  const tr = t(locale, 'roleChanged');
  const roleText = newRole === 'admin' ? tr.adminRole : tr.memberRole;

  await sendPushNotification([userId], {
    title: tr.title,
    body: tr.body({ roleText, projectName }),
    data: { type: 'role_changed', projectName, newRole },
  });
}

/**
 * Notify user when removed from a project
 */
export async function notifyMemberRemoved(projectName, userId) {
  await sendLocalizedNotification(
    [userId],
    'memberRemoved',
    { projectName },
    { type: 'member_removed', projectName }
  );
}

/**
 * Notify all members when a project is deleted
 */
export async function notifyProjectDeleted(projectName, memberIds) {
  await sendLocalizedNotification(
    memberIds,
    'projectDeleted',
    { projectName },
    { type: 'project_deleted', projectName }
  );
}

/**
 * Send 24-hour reminder for upcoming rehearsal
 */
export async function notifyRehearsal24h(rehearsal, projectName, memberIds) {
  await sendLocalizedNotification(
    memberIds,
    'rehearsal24h',
    { projectName, rehearsalTitle: rehearsal.title },
    { type: 'rehearsal_reminder_24h', rehearsalId: rehearsal.id, projectId: rehearsal.project_id }
  );
}

/**
 * Send 1-hour reminder for upcoming rehearsal
 */
export async function notifyRehearsal1h(rehearsal, projectName, memberIds) {
  await sendLocalizedNotification(
    memberIds,
    'rehearsal1h',
    { projectName, rehearsalTitle: rehearsal.title },
    { type: 'rehearsal_reminder_1h', rehearsalId: rehearsal.id, projectId: rehearsal.project_id }
  );
}

/**
 * Notify user that recurring payment has failed
 */
export async function notifyPaymentFailed(userId, errorMessage) {
  await sendLocalizedNotification(
    [userId],
    'paymentFailed',
    {},
    { type: 'payment_failed', errorMessage }
  );
}
