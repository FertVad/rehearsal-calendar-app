/**
 * Reminder Scheduler
 * CRON job to send rehearsal reminders at 24h and 1h before start time
 */

import cron from 'node-cron';
import db from '../../database/db.js';
import { logger } from '../../utils/logger.js';
import { notifyRehearsal24h, notifyRehearsal1h } from './pushNotificationService.js';

/**
 * Check for upcoming rehearsals and send reminders
 */
async function checkUpcomingRehearsals() {
  try {
    logger.info('[Reminder] Checking for upcoming rehearsals...');

    const now = new Date();

    // Check 24-hour reminders (23-24 hours from now)
    await check24hReminders(now);

    // Check 1-hour reminders (50-60 minutes from now)
    await check1hReminders(now);

    logger.info('[Reminder] Check complete');
  } catch (err) {
    logger.error('[Reminder] Error checking reminders:', err);
  }
}

/**
 * Check and send 24-hour reminders
 */
async function check24hReminders(now) {
  const start24h = new Date(now.getTime() + 23 * 60 * 60 * 1000); // 23 hours from now
  const end24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);   // 24 hours from now

  const rehearsals = await db.all(
    `SELECT r.*, p.name as project_name
     FROM native_rehearsals r
     JOIN native_projects p ON r.project_id = p.id
     WHERE r.starts_at BETWEEN ? AND ?
       AND r.is_all_day = 0
       AND NOT EXISTS (
         SELECT 1 FROM native_push_reminders pr
         WHERE pr.rehearsal_id = r.id AND pr.reminder_type = '24h'
       )`,
    [start24h.toISOString(), end24h.toISOString()]
  );

  logger.info(`[Reminder] Found ${rehearsals.length} rehearsals for 24h reminder`);

  for (const rehearsal of rehearsals) {
    try {
      // Get all active project members
      const members = await db.all(
        `SELECT user_id FROM native_project_members
         WHERE project_id = ? AND status = 'active'`,
        [rehearsal.project_id]
      );

      const memberIds = members.map(m => m.user_id);

      if (memberIds.length > 0) {
        await notifyRehearsal24h(rehearsal, rehearsal.project_name, memberIds);

        // Mark reminder as sent
        await db.run(
          `INSERT INTO native_push_reminders (rehearsal_id, reminder_type, sent_at)
           VALUES (?, '24h', ?)`,
          [rehearsal.id, now.toISOString()]
        );

        logger.info(`[Reminder] Sent 24h reminder for rehearsal ${rehearsal.id}`);
      }
    } catch (err) {
      logger.error(`[Reminder] Error sending 24h reminder for rehearsal ${rehearsal.id}:`, err);
    }
  }
}

/**
 * Check and send 1-hour reminders
 */
async function check1hReminders(now) {
  const start1h = new Date(now.getTime() + 50 * 60 * 1000); // 50 minutes from now
  const end1h = new Date(now.getTime() + 70 * 60 * 1000);   // 70 minutes from now

  const rehearsals = await db.all(
    `SELECT r.*, p.name as project_name
     FROM native_rehearsals r
     JOIN native_projects p ON r.project_id = p.id
     WHERE r.starts_at BETWEEN ? AND ?
       AND r.is_all_day = 0
       AND NOT EXISTS (
         SELECT 1 FROM native_push_reminders pr
         WHERE pr.rehearsal_id = r.id AND pr.reminder_type = '1h'
       )`,
    [start1h.toISOString(), end1h.toISOString()]
  );

  logger.info(`[Reminder] Found ${rehearsals.length} rehearsals for 1h reminder`);

  for (const rehearsal of rehearsals) {
    try {
      // Get all active project members
      const members = await db.all(
        `SELECT user_id FROM native_project_members
         WHERE project_id = ? AND status = 'active'`,
        [rehearsal.project_id]
      );

      const memberIds = members.map(m => m.user_id);

      if (memberIds.length > 0) {
        await notifyRehearsal1h(rehearsal, rehearsal.project_name, memberIds);

        // Mark reminder as sent
        await db.run(
          `INSERT INTO native_push_reminders (rehearsal_id, reminder_type, sent_at)
           VALUES (?, '1h', ?)`,
          [rehearsal.id, now.toISOString()]
        );

        logger.info(`[Reminder] Sent 1h reminder for rehearsal ${rehearsal.id}`);
      }
    } catch (err) {
      logger.error(`[Reminder] Error sending 1h reminder for rehearsal ${rehearsal.id}:`, err);
    }
  }
}

/**
 * Start the reminder scheduler
 * Runs every 10 minutes
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
