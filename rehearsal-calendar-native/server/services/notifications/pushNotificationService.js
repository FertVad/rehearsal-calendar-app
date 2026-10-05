/**
 * Push Notification Service
 * Handles sending push notifications via Expo Push API
 */

import http from 'node:http';
import https from 'node:https';
import { Expo } from 'expo-server-sdk';
import db from '../../database/db.js';
import { logger } from '../../utils/logger.js';
import { recordNotifications, getUnreadCounts } from './notificationStore.js';
import { t } from '../../i18n/pushNotifications.js';
import { reminderWhen } from './reminderText.js';

const EXPO_CHUNK = 100;
export const EXPO_TIMEOUT_MS = 10_000;

/**
 * The one way this server talks to Expo: a send and a receipts request, each
 * given a deadline that covers the whole exchange — connecting, waiting and
 * reading the answer — and that destroys the connection when it passes (R8-01).
 *
 * The SDK's client set no deadline at all: a server that accepted the request
 * and never answered held the await for ever, and with it the reminder's
 * transaction, its lock on the rehearsal and a pooled connection. A send that
 * runs out of time fails like any other — its people are released for the next
 * run — and Expo may still have delivered it, which the at-least-once contract
 * allows.
 *
 * `EXPO_BASE_URL` is the SDK's own variable for pointing at another host; the
 * tests point it at a local server that never answers.
 */
/**
 * Expo's answer: `{ data }` on success, `{ errors: [...] }` on failure. Anything
 * else — not JSON, `null`, a list, `errors` that is not a list — is not an
 * answer, and is thrown as one more way the request failed.
 */
function readAnswer(status, text) {
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(`Expo answered ${status} without JSON`);
  }
  if (!result || typeof result !== 'object' || Array.isArray(result)
    || (result.errors !== undefined && !Array.isArray(result.errors))) {
    throw new Error(`Expo answered ${status} with something that is not an answer`);
  }
  if (status !== 200 || result.errors) {
    const reasons = (result.errors || []).map((error) => error?.message).filter(Boolean).join('; ');
    throw new Error(`Expo answered ${status}${reasons ? `: ${reasons}` : ''}`);
  }
  return result.data;
}

export function expoTransport({ baseUrl = process.env.EXPO_BASE_URL || 'https://exp.host', timeoutMs = EXPO_TIMEOUT_MS } = {}) {
  // node:http rather than fetch, and no connection pool: fetch's shared pool
  // opened a fresh connection to the origin the moment a request was aborted,
  // behind the caller's back. Here each request has its own connection, and
  // the deadline destroys it, answer and all.
  function post(path, body) {
    const url = new URL(`${baseUrl}/--/api/v2/push/${path}`);
    const payload = Buffer.from(JSON.stringify(body));
    const client = url.protocol === 'http:' ? http : https;
    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error); else resolve(value);
      };
      const request = client.request(url, {
        method: 'POST',
        agent: false,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'Content-Length': payload.length },
      }, (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('error', (error) => settle(error));
        response.on('aborted', () => settle(new Error('Expo closed the answer half-way')));
        // Everything about the answer is read inside one guard: this runs in
        // an event handler, outside the promise, so anything thrown here would
        // not reject it — it would end the process (R8-04).
        response.on('end', () => {
          try {
            settle(null, readAnswer(response.statusCode, Buffer.concat(chunks).toString('utf8')));
          } catch (error) {
            settle(error);
          }
        });
      });
      const timer = setTimeout(() => {
        const error = new Error(`Expo did not answer within ${timeoutMs} ms`);
        error.name = 'TimeoutError';
        settle(error);
        request.destroy(error);
      }, timeoutMs);
      request.on('error', (error) => settle(error));
      request.end(payload);
    });
  }
  return {
    async sendPushNotificationsAsync(messages) {
      const tickets = await post('send', messages);
      if (!Array.isArray(tickets) || tickets.length !== messages.length) {
        throw new Error(`Expo answered ${Array.isArray(tickets) ? tickets.length : 'no'} tickets for ${messages.length} messages`);
      }
      return tickets;
    },
    getPushNotificationReceiptsAsync: (ids) => post('getReceipts', { ids }),
  };
}

// Every send goes through this unless a caller hands in another client — the
// reminder scheduler's tests and PostgreSQL scenarios do.
const expoClient = expoTransport();

/**
 * Get active push tokens for given user IDs
 * @param {number[]} userIds - Array of user IDs
 * @returns {Promise<Array>} Array of {userId, token} objects
 */
export async function getUserPushTokens(userIds, executor = db) {
  if (!userIds || userIds.length === 0) {
    return [];
  }

  const placeholders = userIds.map(() => '?').join(',');
  const tokens = await executor.all(
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
 * Send one notification to these people, and say what became of it for each
 * (R8: GR01).
 *
 * It used to answer with counts nobody read: the helpers above it resolved to
 * nothing whether Expo took the message or refused it, so the reminder
 * scheduler counted an outage as a send and kept its claims — nobody told,
 * and nobody tried again.
 *
 * - `delivered`: Expo accepted the message for at least one of their devices.
 *   Accepted, not shown: whether the phone got it is in the receipt, read
 *   later (checkPushReceipts).
 * - `undelivered`: they have devices and none of them took it — worth another
 *   try.
 * - `unreachable`: no device to send to, or notifications turned off. The inbox
 *   row is the delivery.
 *
 * A database failure is thrown: "could not find out" is not "nobody". The
 * caller's `executor` carries the inbox rows, the lookups and the token
 * cleanup, so a scheduler can hold them in its own transaction; `expo` is the
 * client that sends.
 *
 * @returns {Promise<{delivered: number[], undelivered: number[], unreachable: number[],
 *   notificationIds: Map<number, number>, sent: number, failed: number, errors: string[]}>}
 */
export async function sendPushNotification(userIds, notification, { executor = db, expo = expoClient } = {}) {
  const ids = [...new Set((userIds || []).map(Number))];

  // Recorded before anything is sent, and for every intended recipient —
  // including those with no device registered. The inbox is what the user
  // reads later; whether a phone was reachable at this instant is a separate
  // question.
  const notificationIds = await recordNotifications(ids, notification, { executor });
  const tokenData = await getUserPushTokens(ids, executor);
  const reachable = new Set(tokenData.map(({ user_id }) => Number(user_id)));
  const outcome = {
    delivered: [],
    undelivered: [],
    unreachable: ids.filter((id) => !reachable.has(id)),
    notificationIds,
    sent: 0,
    failed: 0,
    errors: [],
  };

  if (tokenData.length === 0) {
    logger.info('[Push] No valid tokens found for users:', ids);
    return outcome;
  }

  // The badge is the recipient's unread count, not a constant 1. It used to
  // be the latter, so two unread notifications still showed "1" and the
  // number meant nothing beyond "something happened".
  const unread = await getUnreadCounts([...reachable], executor);

  // Each message carries the id of that recipient's own inbox row, so tapping
  // the push can mark exactly that notification read rather than guessing.
  const messages = tokenData.map(({ device_token, user_id }) => ({
    userId: Number(user_id),
    message: {
      to: device_token,
      sound: 'default',
      badge: unread.get(Number(user_id)) ?? 1,
      priority: 'high',
      channelId: 'rehearsal-notifications',
      ...notification,
      data: {
        ...(notification.data || {}),
        notificationId: notificationIds.get(Number(user_id)) ?? null,
      },
    },
  }));

  // When the tickets' sends began, taken before the wait for Expo: a token
  // registered again while the answer was outstanding is newer than the send,
  // and a late "not registered" receipt must leave it (checkPushReceipts).
  const sentAt = new Date().toISOString();

  // In chunks of 100, Expo's limit, each ticket read against the message it
  // answers — by position, which is how Expo returns them.
  const accepted = new Set();
  const tickets = [];
  for (let first = 0; first < messages.length; first += EXPO_CHUNK) {
    const chunk = messages.slice(first, first + EXPO_CHUNK);
    let answers;
    try {
      answers = await expo.sendPushNotificationsAsync(chunk.map(({ message }) => message));
    } catch (err) {
      logger.error('[Push] Chunk send error:', err);
      outcome.failed += chunk.length;
      outcome.errors.push(err.message);
      continue;
    }
    for (const [index, { userId, message }] of chunk.entries()) {
      const ticket = answers[index];
      if (ticket?.status === 'ok') {
        outcome.sent += 1;
        accepted.add(userId);
        if (ticket.id) tickets.push({ id: ticket.id, userId, token: message.to });
        continue;
      }
      outcome.failed += 1;
      outcome.errors.push(ticket?.message || 'No ticket');
      logger.error('[Push] Ticket error:', ticket?.message, ticket?.details);
      if (ticket?.details?.error === 'DeviceNotRegistered') {
        await removeDeadToken(message.to, { executor });
      }
    }
  }

  outcome.delivered = [...reachable].filter((id) => accepted.has(id));
  outcome.undelivered = [...reachable].filter((id) => !accepted.has(id));

  // Kept for the receipts, outside any caller's transaction: these pushes went
  // out whatever becomes of it. A failure here is reported, not swallowed —
  // without the rows, dead tokens are never found (G02).
  try {
    await recordTickets(tickets, sentAt);
  } catch (err) {
    logger.error('[Push] Could not keep the tickets for their receipts:', err);
    outcome.errors.push(`Tickets not kept: ${err.message}`);
    outcome.ticketsLost = tickets.length;
  }

  logger.info(`[Push] Sent: ${outcome.sent}, Failed: ${outcome.failed}`);
  return outcome;
}

async function recordTickets(tickets, sentAt) {
  for (let first = 0; first < tickets.length; first += EXPO_CHUNK) {
    const chunk = tickets.slice(first, first + EXPO_CHUNK);
    // RETURNING named: the adapter's run() adds `RETURNING id` to an INSERT
    // without one, and this table's key is the ticket.
    await db.all(
      `INSERT INTO native_push_tickets (ticket_id, user_id, device_token, created_at)
       VALUES ${chunk.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4}::timestamptz)`).join(', ')}
       ON CONFLICT (ticket_id) DO NOTHING
       RETURNING ticket_id`,
      chunk.flatMap(({ id, userId, token }) => [id, userId, token, sentAt])
    );
  }
}

/**
 * Remove a token Expo or Apple/Google says belongs to no installed app.
 *
 * `notAfter` keeps a token registered again since the message was sent: the
 * receipt is about the send, and a sign-in since may have brought the token
 * back to life.
 */
async function removeDeadToken(token, { executor = db, notAfter = null } = {}) {
  const result = notAfter
    ? await executor.run(
      // Strictly before: a sign-in in the same instant as the send is not
      // proof the token died — kept, a dead one only fails the next send.
      'DELETE FROM native_push_tokens WHERE device_token = ? AND last_active_at < ?',
      [token, notAfter]
    )
    : await executor.run('DELETE FROM native_push_tokens WHERE device_token = ?', [token]);
  logger.info('[Push] Removed a token no app answers to');
  return result.changes || 0;
}

/**
 * Read the receipts of pushes Expo accepted at least fifteen minutes ago
 * (R8: G02).
 *
 * A ticket only says Expo took the message; the receipt says whether Apple or
 * Google did. Expo keeps receipts for about a day and asks that they be read
 * no sooner than fifteen minutes after the send. A receipt saying the device is
 * no longer registered — the app was deleted — removes the token, so the next
 * send does not go to it; any other receipt, or one Expo no longer holds,
 * retires the ticket. A ticket whose receipt is not ready yet waits for the
 * next run.
 *
 * Throws when Expo cannot be asked: the tickets stay for the next run, and the
 * run says it failed.
 */
export async function checkPushReceipts({ now = new Date(), expo = expoClient, limit = 1000 } = {}) {
  const due = await db.all(
    `SELECT ticket_id, device_token, created_at FROM native_push_tickets
     WHERE created_at <= ? ORDER BY created_at LIMIT ?`,
    [new Date(now.getTime() - RECEIPT_DELAY_MS).toISOString(), limit]
  );
  const result = { checked: due.length, ok: 0, failed: 0, tokensRemoved: 0, waiting: 0, expired: 0 };
  if (due.length === 0) return result;

  const receipts = {};
  for (let first = 0; first < due.length; first += RECEIPT_CHUNK) {
    const ids = due.slice(first, first + RECEIPT_CHUNK).map((row) => row.ticket_id);
    Object.assign(receipts, await expo.getPushNotificationReceiptsAsync(ids));
  }

  const retired = [];
  for (const row of due) {
    const receipt = receipts[row.ticket_id];
    if (!receipt) {
      if (now.getTime() - new Date(row.created_at).getTime() < RECEIPT_KEPT_MS) {
        result.waiting += 1;
        continue;
      }
      result.expired += 1;
    } else if (receipt.status === 'ok') {
      result.ok += 1;
    } else {
      result.failed += 1;
      logger.warn('[Push] Receipt error:', receipt.message, receipt.details);
      if (receipt.details?.error === 'DeviceNotRegistered') {
        result.tokensRemoved += await removeDeadToken(row.device_token, {
          notAfter: new Date(row.created_at).toISOString(),
        });
      }
    }
    retired.push(row.ticket_id);
  }

  for (let first = 0; first < retired.length; first += RECEIPT_CHUNK) {
    const ids = retired.slice(first, first + RECEIPT_CHUNK);
    await db.run(`DELETE FROM native_push_tickets WHERE ticket_id IN (${ids.map(() => '?').join(', ')})`, ids);
  }
  return result;
}

const RECEIPT_DELAY_MS = 15 * 60 * 1000;
const RECEIPT_KEPT_MS = 24 * 60 * 60 * 1000;
const RECEIPT_CHUNK = 300;

/**
 * Notification builders for different event types
 */

/**
 * Fetch locale preference for given user IDs.
 * Returns a Map of userId → locale ('ru' | 'en'), falling back to 'en'.
 */
async function getUserLocales(userIds, executor = db) {
  if (userIds.length === 0) return new Map();
  const placeholders = userIds.map(() => '?').join(',');
  const rows = await executor.all(
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
async function sendLocalizedNotification(userIds, key, params, data, options = {}) {
  const outcome = emptyOutcome();
  if (userIds.length === 0) return outcome;
  const locales = await getUserLocales(userIds, options.executor);
  const groups = groupByLocale(userIds, locales);

  for (const [locale, ids] of groups.entries()) {
    const tr = t(locale, key);
    merge(outcome, await sendPushNotification(ids, {
      title: tr.title,
      body: tr.body(params),
      data,
    }, options));
  }
  return outcome;
}

function emptyOutcome() {
  return { delivered: [], undelivered: [], unreachable: [], notificationIds: new Map(), sent: 0, failed: 0, errors: [] };
}

/** One recipient's outcome in one locale group; the groups do not overlap. */
function merge(into, part) {
  into.delivered.push(...part.delivered);
  into.undelivered.push(...part.undelivered);
  into.unreachable.push(...part.unreachable);
  for (const [userId, id] of part.notificationIds) into.notificationIds.set(userId, id);
  into.sent += part.sent;
  into.failed += part.failed;
  into.errors.push(...part.errors);
  if (part.ticketsLost) into.ticketsLost = (into.ticketsLost || 0) + part.ticketsLost;
}

/**
 * Notify members when a new rehearsal is created
 */
export async function notifyRehearsalCreated(rehearsal, projectName, members) {
  // The caller decides who is on the list — including leaving out the author.
  const userIds = members.map(m => m.user_id);
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
/**
 * Tell the people responsible for a project that somebody has joined it.
 *
 * This used to tell the person who had just joined, who had tapped Join a
 * moment earlier and knew. The owner — whose invite link it was, and who
 * answers for who is in the room — was told nothing at all.
 */
export async function notifyMemberJoined(projectName, memberName, recipientIds) {
  await sendLocalizedNotification(
    recipientIds,
    'memberJoined',
    { memberName, projectName },
    { type: 'member_joined', projectName }
  );
}

/**
 * Tell everyone who runs a project that it has another administrator.
 *
 * Administrators may appoint administrators here, so this is not something the
 * owner can assume they did themselves.
 */
export async function notifyAdminAppointed(projectName, memberName, recipientIds) {
  await sendLocalizedNotification(
    recipientIds,
    'adminAppointed',
    { memberName, projectName },
    { type: 'admin_appointed', projectName }
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
 * A rehearsal reminder, worded for each reader (R8: GR04).
 *
 * Grouped by language and time zone rather than language alone: the title
 * carries the rehearsal's start — today, tomorrow or the date, and the time —
 * as the reader's own clock shows it (reminderText.js), so two people in one
 * language but different zones read different times. `options.now` is the
 * moment the run sends at; the rest passes to sendPushNotification.
 */
async function sendRehearsalReminder(rehearsal, projectName, userIds, key, data, { now = new Date(), ...options } = {}) {
  const outcome = emptyOutcome();
  if (userIds.length === 0) return outcome;
  const executor = options.executor || db;
  const rows = await executor.all(
    `SELECT id, locale, timezone FROM native_users WHERE id IN (${userIds.map(() => '?').join(',')})`,
    userIds
  );
  const readers = new Map(rows.map((row) => [Number(row.id), row]));
  const groups = new Map();
  for (const userId of userIds) {
    const reader = readers.get(Number(userId));
    const locale = reader?.locale || 'en';
    const timeZone = reader?.timezone || 'UTC';
    const group = `${locale}|${timeZone}`;
    if (!groups.has(group)) groups.set(group, { locale, timeZone, ids: [] });
    groups.get(group).ids.push(userId);
  }

  for (const { locale, timeZone, ids } of groups.values()) {
    const tr = t(locale, key);
    const when = reminderWhen(locale, rehearsal.starts_at, now, timeZone);
    merge(outcome, await sendPushNotification(ids, {
      title: tr.title({ when }),
      body: tr.body({ projectName, rehearsalTitle: rehearsal.title }),
      data,
    }, options));
  }
  return outcome;
}

/**
 * Send the day-before reminder for an upcoming rehearsal
 */
export async function notifyRehearsal24h(rehearsal, projectName, memberIds, options) {
  return sendRehearsalReminder(
    rehearsal, projectName, memberIds, 'rehearsal24h',
    { type: 'rehearsal_reminder_24h', rehearsalId: rehearsal.id, projectId: rehearsal.project_id },
    options
  );
}

/**
 * Send the hour-before reminder for an upcoming rehearsal
 */
export async function notifyRehearsal1h(rehearsal, projectName, memberIds, options) {
  return sendRehearsalReminder(
    rehearsal, projectName, memberIds, 'rehearsal1h',
    { type: 'rehearsal_reminder_1h', rehearsalId: rehearsal.id, projectId: rehearsal.project_id },
    options
  );
}
