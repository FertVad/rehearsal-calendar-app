/**
 * "X has seen the rehearsal": told to the admins once per person (T-034).
 *
 * Every mark used to be announced, so unmarking and marking again told the
 * admins the same thing twice (Apple, notifications.md: "Avoid sending multiple
 * notifications for the same thing").
 *
 * The rule, all of it here:
 * - A person's "seen" is announced once per rehearsal.
 * - Once more only when the rehearsal's date, time or place has changed since
 *   the last announced one: what they saw is not what it is now.
 * - Unmarking announces nothing and gives nothing back.
 *
 * The record is a claim in native_push_reminders, the table that already says
 * "this person has been told about this rehearsal" for the reminders: the row
 * (rehearsal, the person who marked it, 'seen'). Its unique key is what makes it
 * once: two marks at the same moment both try to insert it and only one gets
 * the row back, so only one is announced. The reminder scheduler never sees
 * these rows; it asks for its own types by name.
 */

export const SEEN = 'seen';

/**
 * Claim the announcement of this person's "seen", inside the caller's
 * transaction — the one that records the mark, so a claim never stands for a
 * mark that was undone.
 *
 * @returns {Promise<boolean>} true when this mark is the one to announce
 */
export async function claimSeenNotice(tx, rehearsalId, userId) {
  const claimed = await tx.all(
    `INSERT INTO native_push_reminders (rehearsal_id, user_id, reminder_type, sent_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (rehearsal_id, user_id, reminder_type) DO NOTHING
     RETURNING user_id`,
    [rehearsalId, userId, SEEN]
  );
  return claimed.length > 0;
}

const instant = (value) => (value == null ? null : new Date(value).getTime());

/**
 * After an edit, inside its transaction: when the date, time or place changed,
 * the next "seen" of everyone on it is news again. A new title or description
 * is not.
 *
 * @param {{starts_at, ends_at, location}} before - the row as the edit found it
 * @param {{starts_at, ends_at, location}} after - the row as the edit left it
 */
export async function releaseSeenNotices(tx, rehearsalId, before, after) {
  const moved = instant(before.starts_at) !== instant(after.starts_at)
    || instant(before.ends_at) !== instant(after.ends_at)
    || (before.location || '') !== (after.location || '');
  if (!moved) return;
  await tx.run('DELETE FROM native_push_reminders WHERE rehearsal_id = $1 AND reminder_type = $2', [rehearsalId, SEEN]);
}
