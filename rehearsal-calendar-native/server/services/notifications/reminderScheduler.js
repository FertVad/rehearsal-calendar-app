/**
 * Rehearsal reminders — the day before, and an hour before.
 *
 * Driven by GET /api/cron/reminders. Whatever calls that endpoint decides how
 * often this runs, and nothing here assumes it is punctual: a run that arrives
 * late, or not at all, must not cost anyone their reminder. See the window
 * constants below for how that is arranged.
 */

import cron from 'node-cron';
import db from '../../database/db.js';
import { logger } from '../../utils/logger.js';
import { notifyRehearsal24h, notifyRehearsal1h } from './pushNotificationService.js';

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
 * Check for upcoming rehearsals and send the reminders that are due.
 *
 * @returns {Promise<{sent: {'24h': number, '1h': number}, found: {'24h': number, '1h': number}}>}
 */
export async function checkUpcomingRehearsals() {
  logger.info('[Reminder] Checking for upcoming rehearsals...');

  const now = new Date();

  const dayBefore = await sendReminders({
    type: '24h',
    from: new Date(now.getTime() + DAY_BEFORE_FLOOR_MS),
    to: new Date(now.getTime() + DAY_BEFORE_CEILING_MS),
    notify: notifyRehearsal24h,
    now,
  });

  const hourBefore = await sendReminders({
    type: '1h',
    from: now,
    to: new Date(now.getTime() + HOUR_BEFORE_CEILING_MS),
    notify: notifyRehearsal1h,
    now,
  });

  const result = {
    found: { '24h': dayBefore.found, '1h': hourBefore.found },
    sent: { '24h': dayBefore.sent, '1h': hourBefore.sent },
  };

  logger.info(
    `[Reminder] Check complete — sent ${result.sent['24h']} day-before, ${result.sent['1h']} hour-before`
  );

  return result;
}

/**
 * Find the rehearsals starting inside one window that have not had this kind of
 * reminder yet, and notify their project members.
 */
async function sendReminders({ type, from, to, notify, now }) {
  let rehearsals;
  try {
    rehearsals = await db.all(
      `SELECT r.*, p.name as project_name
       FROM native_rehearsals r
       JOIN native_projects p ON r.project_id = p.id
       WHERE r.starts_at BETWEEN ? AND ?
         AND r.is_all_day = FALSE
         AND NOT EXISTS (
           SELECT 1 FROM native_push_reminders pr
           WHERE pr.rehearsal_id = r.id AND pr.reminder_type = ?
         )`,
      [from.toISOString(), to.toISOString(), type]
    );
  } catch (err) {
    logger.error(`[Reminder] Could not load rehearsals for the ${type} reminder:`, err);
    return { found: 0, sent: 0 };
  }

  logger.info(`[Reminder] Found ${rehearsals.length} rehearsals for the ${type} reminder`);

  let sent = 0;

  for (const rehearsal of rehearsals) {
    try {
      const members = await db.all(
        `SELECT user_id FROM native_project_members
         WHERE project_id = ? AND status = 'active'`,
        [rehearsal.project_id]
      );

      const memberIds = members.map((m) => m.user_id);
      if (memberIds.length === 0) continue;

      // Claim before sending, not after. Two schedulers may well overlap — a
      // primary and a backup, or one run still going when the next starts — and
      // the unique index on (rehearsal_id, reminder_type) means only one of them
      // gets a row back. The loser skips instead of sending a second push.
      const claim = await db.get(
        `INSERT INTO native_push_reminders (rehearsal_id, reminder_type, sent_at)
         VALUES (?, ?, ?)
         ON CONFLICT (rehearsal_id, reminder_type) DO NOTHING
         RETURNING id`,
        [rehearsal.id, type, now.toISOString()]
      );

      if (!claim) {
        logger.info(`[Reminder] ${type} reminder for rehearsal ${rehearsal.id} already claimed`);
        continue;
      }

      try {
        await notify(rehearsal, rehearsal.project_name, memberIds);
        sent += 1;
        logger.info(`[Reminder] Sent ${type} reminder for rehearsal ${rehearsal.id}`);
      } catch (err) {
        // Release the claim so the next run tries again — the alternative is a
        // rehearsal permanently marked as reminded that nobody was told about.
        await db.run(
          `DELETE FROM native_push_reminders WHERE rehearsal_id = ? AND reminder_type = ?`,
          [rehearsal.id, type]
        );
        throw err;
      }
    } catch (err) {
      logger.error(`[Reminder] Error sending ${type} reminder for rehearsal ${rehearsal.id}:`, err);
    }
  }

  return { found: rehearsals.length, sent };
}

/**
 * Start the in-process scheduler.
 *
 * Only useful when the server is a long-lived process. On Vercel nothing here
 * runs — the function is torn down after each request — so production drives
 * the same work through GET /api/cron/reminders instead.
 */
export function startReminderScheduler() {
  // Run every 10 minutes
  cron.schedule('*/10 * * * *', () => {
    checkUpcomingRehearsals();
  });

  logger.info('[Reminder] Scheduler started (runs every 10 minutes)');

  // Run immediately on startup
  checkUpcomingRehearsals();
}
