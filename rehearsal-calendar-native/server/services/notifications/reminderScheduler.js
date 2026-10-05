/**
 * Rehearsal reminders — the day before, and an hour before.
 *
 * Driven by GET /api/cron/reminders. Whatever calls that endpoint decides how
 * often this runs, and nothing here assumes it is punctual: a run that arrives
 * late, or not at all, must not cost anyone their reminder. See the window
 * constants below for how that is arranged.
 *
 * Each rehearsal is reminded in one transaction (R8: GR01, GR02, GR05): the
 * rehearsal is locked as long as it still starts when the run read it, the
 * people not yet told are claimed, the push goes out, and the claims of anyone
 * no device took are released before the commit. A run that stops half-way —
 * an error, a timeout, a killed function — commits nothing, so nobody is left
 * claimed and untold; a rehearsal moved meanwhile either waits for the send or
 * is skipped by it, never claimed at its old time.
 */

import db from '../../database/db.js';
import { logger } from '../../utils/logger.js';
import { notifyRehearsal24h, notifyRehearsal1h, checkPushReceipts, EXPO_TIMEOUT_MS } from './pushNotificationService.js';
import { ROSTER } from '../rehearsals/roster.js';

/**
 * Search windows, as offsets from "now".
 *
 * These used to be narrow bands — 23–24h ahead, and 50–70 minutes ahead — which
 * only work under a metronome. Miss one run and the rehearsal has crossed the
 * band by the next; it then gets no reminder at all, silently. Since no free
 * scheduler promises punctuality, the windows are wide enough that any run
 * within hours of the intended one still catches the same rehearsals.
 *
 * Sending twice is prevented by native_push_reminders, not by the window, so
 * widening costs nothing. The 12-hour floor on the day-before reminder is what
 * keeps its wording honest: "Rehearsal tomorrow" should not arrive for
 * something starting this afternoon.
 */
const DAY_BEFORE_FLOOR_MS = 12 * 60 * 60 * 1000;
const DAY_BEFORE_CEILING_MS = 24 * 60 * 60 * 1000;
const HOUR_BEFORE_CEILING_MS = 60 * 60 * 1000;

/**
 * How long one run may keep starting rehearsals (R8-01). Every request to Expo
 * has its own deadline; this one keeps a run with many slow sends from
 * outliving whatever drives it. Rehearsals left over wait for the next run,
 * and the run says so.
 */
const RUN_BUDGET_MS = 45_000;

/**
 * PostgreSQL's own backstop for a reminder transaction that stops moving —
 * the process stalled rather than an Expo request that times out: the
 * session is ended and everything it held, the lock on the rehearsal
 * included, is released.
 */
const IDLE_IN_TRANSACTION_MS = EXPO_TIMEOUT_MS * 3;

const placeholders = (values, first) => values.map((_, i) => `$${i + first}`).join(', ');

/**
 * Read the receipts that are due, then send the reminders that are.
 *
 * `ok` is false when anything failed — the due rehearsals could not be read, a
 * rehearsal's transaction failed, somebody's devices all refused, or the
 * receipts could not be read or kept — and `errors` says what (R8: GR03). The
 * counts are there so a scheduler's log can tell "nothing was due" from
 * "something is broken"; `ok` is what it should alarm on.
 *
 * @param {{now?: Date, expo?: object}} options - `expo` stands in for the Expo
 *   client in tests.
 */
export async function checkUpcomingRehearsals({
  now = new Date(), expo, budgetMs = RUN_BUDGET_MS, idleInTransactionMs = IDLE_IN_TRANSACTION_MS,
} = {}) {
  logger.info('[Reminder] Checking for upcoming rehearsals...');
  const errors = [];
  const stopAt = Date.now() + budgetMs;

  // Receipts first: a token a receipt shows dead is gone before the
  // reminders go out.
  let receipts = null;
  try {
    receipts = await checkPushReceipts({ now, ...(expo ? { expo } : {}) });
  } catch (err) {
    logger.error('[Reminder] Could not read the push receipts:', err);
    errors.push({ step: 'receipts', error: err.message });
  }

  const dayBefore = await sendReminders({
    type: '24h',
    from: new Date(now.getTime() + DAY_BEFORE_FLOOR_MS),
    to: new Date(now.getTime() + DAY_BEFORE_CEILING_MS),
    notify: notifyRehearsal24h,
    now,
    expo,
    stopAt,
    idleInTransactionMs,
  });

  const hourBefore = await sendReminders({
    type: '1h',
    from: now,
    to: new Date(now.getTime() + HOUR_BEFORE_CEILING_MS),
    notify: notifyRehearsal1h,
    now,
    expo,
    stopAt,
    idleInTransactionMs,
  });

  errors.push(...dayBefore.errors, ...hourBefore.errors);
  const result = {
    ok: errors.length === 0,
    found: { '24h': dayBefore.found, '1h': hourBefore.found },
    sent: { '24h': dayBefore.sent, '1h': hourBefore.sent },
    told: { '24h': dayBefore.told, '1h': hourBefore.told },
    retry: { '24h': dayBefore.retry, '1h': hourBefore.retry },
    receipts,
    errors,
  };

  logger.info(
    `[Reminder] Check complete — told ${result.told['24h']} day-before, ${result.told['1h']} hour-before; ` +
      `${errors.length} error(s)`
  );

  return result;
}

/**
 * Find the rehearsals starting inside one window that someone on them has not
 * had this kind of reminder for, and remind each in its own transaction.
 *
 * `sent` counts rehearsals someone was told about, `told` the people, `retry`
 * the people whose devices all refused and who stay unclaimed for the next run.
 */
async function sendReminders({ type, from, to, notify, now, expo, stopAt, idleInTransactionMs }) {
  const tally = { found: 0, sent: 0, told: 0, retry: 0, errors: [] };
  let rehearsals;
  try {
    rehearsals = await db.all(
      `SELECT r.*, p.name as project_name
       FROM native_rehearsals r
       JOIN native_projects p ON r.project_id = p.id
       -- Due, and with somebody on it who has not been told yet.
       --
       -- This used to exclude a rehearsal the moment any claim existed for it,
       -- which with one claim per rehearsal was the same question. It is not
       -- the same question now: a person added after the first send has no
       -- claim of their own, and excluding the whole rehearsal is how they came
       -- to be never reminded at all.
       WHERE r.starts_at BETWEEN ? AND ?
         AND r.is_all_day = FALSE
         AND EXISTS (
           SELECT 1 FROM ${ROSTER} rr
           WHERE rr.rehearsal_id = r.id
             AND NOT EXISTS (
               SELECT 1 FROM native_push_reminders pr
               WHERE pr.rehearsal_id = r.id
                 AND pr.user_id = rr.user_id
                 AND pr.reminder_type = ?
             )
         )`,
      [from.toISOString(), to.toISOString(), type]
    );
  } catch (err) {
    // Not "nothing was due": the run could not find out, and says so.
    logger.error(`[Reminder] Could not load rehearsals for the ${type} reminder:`, err);
    tally.errors.push({ step: type, error: err.message });
    return tally;
  }

  tally.found = rehearsals.length;
  logger.info(`[Reminder] Found ${rehearsals.length} rehearsals for the ${type} reminder`);

  for (const [index, rehearsal] of rehearsals.entries()) {
    if (Date.now() >= stopAt) {
      tally.errors.push({ step: type, error: 'Run budget spent', left: rehearsals.length - index });
      break;
    }
    try {
      const outcome = await db.transaction((tx) => remindRehearsal(tx, {
        rehearsal, type, from, to, notify, now, expo, idleInTransactionMs,
      }));
      if (outcome.told > 0) tally.sent += 1;
      tally.told += outcome.told;
      tally.retry += outcome.retry;
      if (outcome.retry > 0) {
        tally.errors.push({ step: type, rehearsalId: rehearsal.id, undelivered: outcome.retry, error: outcome.error });
      }
      if (outcome.ticketsLost) {
        tally.errors.push({ step: type, rehearsalId: rehearsal.id, error: 'Tickets not kept for their receipts' });
      }
    } catch (err) {
      // The transaction is undone: no claim of this run survives, and the next
      // run tries these people again.
      logger.error(`[Reminder] Error sending ${type} reminder for rehearsal ${rehearsal.id}:`, err);
      tally.errors.push({ step: type, rehearsalId: rehearsal.id, error: err.message });
    }
  }

  return tally;
}

/**
 * Remind one rehearsal's people, inside the caller's transaction.
 *
 * Exported for the tests that hand it a snapshot the database has moved on
 * from; the scheduler is its only caller.
 *
 * @returns {Promise<{told: number, retry: number, moved?: boolean, error?: string, ticketsLost?: number}>}
 */
export async function remindRehearsal(tx, {
  rehearsal, type, from, to, notify, now, expo, idleInTransactionMs = IDLE_IN_TRANSACTION_MS,
}) {
  await tx.run(`SET LOCAL idle_in_transaction_session_timeout = ${Math.max(1, Math.trunc(idleInTransactionMs))}`);

  // Still due for this reminder — by the same window the run found it in —
  // and held so while it is reminded. A move that commits first is seen here:
  // moved out of the window, the rehearsal is skipped; a move that comes after
  // waits until the claims are in, and the edit then releases them
  // (rehearsalService.updateRehearsal) — so no claim stands for a time the
  // rehearsal no longer has (GR05). Until the edit is one transaction (cause
  // fix 10), the release is a separate statement after the move.
  //
  // The window, not the start the run read: that came back through JavaScript
  // at millisecond precision, and a start stored to the microsecond never
  // compared equal — such a rehearsal read as moved and was never reminded
  // (R8-02).
  const current = await tx.get(
    `SELECT id FROM native_rehearsals
     WHERE id = $1 AND is_all_day = FALSE AND starts_at BETWEEN $2 AND $3
     FOR SHARE`,
    [rehearsal.id, from.toISOString(), to.toISOString()]
  );
  if (!current) return { told: 0, retry: 0, moved: true };

  // Claim before sending, not after, one claim per person, in one statement.
  //
  // Two schedulers may well overlap — a primary and a backup, or one run still
  // going when the next starts — and the unique key means only one of them
  // gets a row back for a given recipient: the other waits on the first one's
  // transaction and then skips. Taken in user order, so two runs queue on the
  // same row first rather than lock each other out.
  //
  // Per person rather than per rehearsal because the claim used to retire the
  // whole call on the first send: anyone added afterwards never got a reminder
  // at all. Now they simply have no row, so the next run sends to them and to
  // nobody else.
  const claimed = await tx.all(
    `INSERT INTO native_push_reminders (rehearsal_id, user_id, reminder_type, sent_at)
     SELECT rr.rehearsal_id, rr.user_id, $2, $3
     FROM ${ROSTER} rr
     WHERE rr.rehearsal_id = $1
     ORDER BY rr.user_id
     ON CONFLICT (rehearsal_id, user_id, reminder_type) DO NOTHING
     RETURNING user_id`,
    [rehearsal.id, type, now.toISOString()]
  );
  const userIds = claimed.map((row) => Number(row.user_id));
  if (userIds.length === 0) {
    logger.info(`[Reminder] ${type} reminder for rehearsal ${rehearsal.id} already claimed`);
    return { told: 0, retry: 0 };
  }

  const delivery = await notify(rehearsal, rehearsal.project_name, userIds, { executor: tx, ...(expo ? { expo } : {}) });

  // Nobody's device took it: release their claims, and the inbox rows written
  // for them, so the next run tries again without doubling the inbox (GR01).
  // Whoever was told, or has no device to tell — the inbox row is theirs —
  // keeps the claim.
  const retry = delivery.undelivered;
  if (retry.length > 0) {
    await tx.run(
      `DELETE FROM native_push_reminders
       WHERE rehearsal_id = $1 AND reminder_type = $2 AND user_id IN (${placeholders(retry, 3)})`,
      [rehearsal.id, type, ...retry]
    );
    const rows = retry.map((userId) => delivery.notificationIds.get(userId)).filter((id) => id != null);
    if (rows.length > 0) {
      await tx.run(`DELETE FROM native_notifications WHERE id IN (${placeholders(rows, 1)})`, rows);
    }
  }

  logger.info(
    `[Reminder] ${type} reminder for rehearsal ${rehearsal.id}: told ${userIds.length - retry.length}, retry ${retry.length}`
  );
  return {
    told: userIds.length - retry.length,
    retry: retry.length,
    ...(retry.length > 0 ? { error: delivery.errors[0] || 'No device accepted the push' } : {}),
    ...(delivery.ticketsLost ? { ticketsLost: delivery.ticketsLost } : {}),
  };
}
