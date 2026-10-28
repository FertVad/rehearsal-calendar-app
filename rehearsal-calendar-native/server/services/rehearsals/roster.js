/**
 * The roster: who is on a rehearsal, and who may do what with one (R4: D01, D02).
 *
 * One place, because the question used to be answered in seven — the routes,
 * the lists, the slot booking, the announcements, the reminder run — and the
 * answers drifted apart. An admin could put a stranger on a call and write busy
 * hours into that stranger's calendar; a member could put themselves on one by
 * answering it; anyone in the project could read the cast of a rehearsal they
 * were not on; a leftover row kept someone who had left in the announcements.
 *
 * The rule:
 * - Someone is on a rehearsal when they have a row in native_rehearsal_responses
 *   AND are an active member of the rehearsal's project. Every read goes
 *   through ROSTER, which joins the two, so a leftover row — a removal racing an
 *   edit, data from before this rule — puts nobody anywhere.
 * - A roster is changed only to active members of that project. A list naming
 *   anyone else is refused whole, before anything is written, never trimmed.
 * - Answering changes the answer, never the roster: only someone already on a
 *   rehearsal can answer it.
 * - A rehearsal is visible to an admin of its project and to the people on it.
 *
 * Nothing else in the server names the table; a test holds that.
 */

export const ADMIN_ROLES = ['owner', 'admin'];

// A cast is tens of people. The cap only keeps a request from making the
// membership lookup as long as it likes before it is refused.
export const MAX_PARTICIPANTS = 500;

export class RosterRefused extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.name = 'RosterRefused';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get body() {
    return { error: this.message, code: this.code, ...this.details };
  }
}

// The one definition of "on the roster", as a derived table: the row's id,
// rehearsal_id, user_id, response, notes and timestamps, active members only.
export const ROSTER = `(
  SELECT rr.id, rr.rehearsal_id, rr.user_id, rr.response, rr.notes, rr.created_at, rr.updated_at
  FROM native_rehearsal_responses rr
  JOIN native_rehearsals roster_rehearsal ON roster_rehearsal.id = rr.rehearsal_id
  JOIN native_project_members roster_member ON roster_member.project_id = roster_rehearsal.project_id
    AND roster_member.user_id = rr.user_id AND roster_member.status = 'active'
)`;

const placeholders = (values, first) => values.map((_, i) => `$${i + first}`).join(', ');

export async function activeMembership(conn, projectId, userId) {
  return conn.get(
    "SELECT role FROM native_project_members WHERE project_id = $1 AND user_id = $2 AND status = 'active'",
    [projectId, userId]
  );
}

export const isAdminRole = (membership) => Boolean(membership) && ADMIN_ROLES.includes(membership.role);

/** The people on a rehearsal, with their answers. */
export async function rosterOf(conn, rehearsalId) {
  return conn.all(`SELECT user_id, response FROM ${ROSTER} roster WHERE rehearsal_id = $1 ORDER BY user_id`,
    [rehearsalId]);
}

/** This person's row on this rehearsal, or null when they are not on it. */
export async function placeOnRoster(conn, rehearsalId, userId) {
  return (await conn.get(`SELECT * FROM ${ROSTER} roster WHERE rehearsal_id = $1 AND user_id = $2`,
    [rehearsalId, userId])) || null;
}

/**
 * Whether this person may see this rehearsal: null when not, otherwise their
 * membership, whether they are an admin, and their place on the roster.
 */
export async function viewerOf(conn, rehearsal, userId) {
  const membership = await activeMembership(conn, rehearsal.project_id, userId);
  if (!membership) return null;
  const place = await placeOnRoster(conn, rehearsal.id, userId);
  const isAdmin = isAdminRole(membership);
  if (!place && !isAdmin) return null;
  return { membership, isAdmin, place };
}

/**
 * The participant list a create or an edit carries, checked before anything is
 * written. undefined: none sent — an edit keeps its roster. An array: the whole
 * new roster, [] clearing it, each person once.
 */
export async function checkParticipants(conn, projectId, raw) {
  if (raw === undefined) return undefined;
  const invalid = () => new RosterRefused(400, 'PARTICIPANTS_INVALID', 'participant_ids must be a list of user ids');
  if (!Array.isArray(raw) || raw.length > MAX_PARTICIPANTS) throw invalid();
  const ids = [];
  for (const value of raw) {
    const id = typeof value === 'string' && /^\d{1,15}$/.test(value) ? Number(value) : value;
    if (!Number.isSafeInteger(id) || id <= 0) throw invalid();
    if (!ids.includes(id)) ids.push(id);
  }
  if (ids.length === 0) return [];
  const members = await conn.all(
    `SELECT user_id FROM native_project_members
     WHERE project_id = $1 AND status = 'active' AND user_id IN (${placeholders(ids, 2)})`,
    [projectId, ...ids]
  );
  const found = new Set(members.map((row) => Number(row.user_id)));
  const unknown = ids.filter((id) => !found.has(id));
  if (unknown.length > 0) {
    throw new RosterRefused(400, 'NOT_PROJECT_MEMBERS', 'Participants must be active members of the project',
      { userIds: unknown });
  }
  return ids;
}

/**
 * Make the roster exactly `ids` (already checked): keep the answers of those
 * who stay, add newcomers as invited and not yet seen ('no'), take off the rest.
 */
export async function settleRoster(conn, rehearsalId, ids) {
  if (ids.length === 0) {
    await clearRoster(conn, rehearsalId);
    return;
  }
  await conn.run(
    `DELETE FROM native_rehearsal_responses WHERE rehearsal_id = $1 AND user_id NOT IN (${placeholders(ids, 2)})`,
    [rehearsalId, ...ids]
  );
  for (const userId of ids) {
    await conn.run(
      `INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response, created_at, updated_at)
       VALUES ($1, $2, 'no', NOW(), NOW())
       ON CONFLICT (rehearsal_id, user_id) DO NOTHING`,
      [rehearsalId, userId]
    );
  }
}

export async function clearRoster(conn, rehearsalId) {
  await conn.run('DELETE FROM native_rehearsal_responses WHERE rehearsal_id = $1', [rehearsalId]);
}

/** Someone leaving a project leaves every rehearsal of it. */
export async function takeOffProjectRehearsals(conn, projectId, userId) {
  await conn.run(
    `DELETE FROM native_rehearsal_responses
     WHERE user_id = $1 AND rehearsal_id IN (SELECT id FROM native_rehearsals WHERE project_id = $2)`,
    [userId, projectId]
  );
}

/**
 * Change the answer of someone on the rehearsal. Refuses — writing nothing —
 * when they are not on it: an answer never puts anyone on a rehearsal.
 */
export async function answer(conn, rehearsalId, userId, response, notes) {
  if (!(await placeOnRoster(conn, rehearsalId, userId))) {
    throw new RosterRefused(403, 'NOT_ON_REHEARSAL', 'You are not on this rehearsal');
  }
  await conn.run(
    `UPDATE native_rehearsal_responses SET response = $3, notes = $4, updated_at = NOW()
     WHERE rehearsal_id = $1 AND user_id = $2`,
    [rehearsalId, userId, response, notes]
  );
}

/** Seen and invited counts per rehearsal, from the roster. */
export async function rosterStats(conn, rehearsalIds) {
  const stats = new Map();
  if (rehearsalIds.length === 0) return stats;
  const rows = await conn.all(
    `SELECT rehearsal_id, COUNT(*) AS invited, COUNT(CASE WHEN response = 'yes' THEN 1 END) AS confirmed
     FROM ${ROSTER} roster WHERE rehearsal_id IN (${placeholders(rehearsalIds, 1)})
     GROUP BY rehearsal_id`,
    rehearsalIds
  );
  for (const row of rows) {
    stats.set(Number(row.rehearsal_id), { confirmed: Number(row.confirmed) || 0, invited: Number(row.invited) || 0 });
  }
  return stats;
}

/** The people on a rehearsal with their names, for the participants screen. */
export async function rosterWithNames(conn, rehearsalId) {
  return conn.all(
    `SELECT u.id AS user_id, u.first_name, u.last_name,
       -- Email deliberately not selected: the participant list shows names
       -- only, and there is no reason to hand every project member the
       -- addresses of everyone else.
       roster.response, roster.notes, roster.created_at, roster.updated_at
     FROM ${ROSTER} roster
     JOIN native_users u ON u.id = roster.user_id
     WHERE roster.rehearsal_id = $1
     ORDER BY u.first_name, u.last_name`,
    [rehearsalId]
  );
}
