/**
 * One way to spell a person's name.
 *
 * Six places composed it themselves and each got a different answer for the
 * same row. Trimming only the result is not enough: a first name stored as
 * "Ginger " joined to "Rode " gives "Ginger  Rode" — the gap in the middle
 * survives, and that is exactly what showed up in a push notification. So each
 * part is trimmed before they are joined, and empty parts drop out rather than
 * leaving a space behind.
 *
 * Names are trimmed on the way into the database too; this is what keeps the
 * rows that were written before that.
 */
export function fullName(user, fallback = '') {
  if (!user) return fallback;

  const parts = [user.first_name ?? user.firstName, user.last_name ?? user.lastName]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean);

  return parts.join(' ') || fallback;
}
