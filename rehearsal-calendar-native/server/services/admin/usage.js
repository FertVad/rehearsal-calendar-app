/**
 * The admin's figures of use (T-294), from what migration 016 records: the days
 * someone used the app, with its build, and the daily counts of each project's
 * invitation. Same people and projects as every other figure (people.js):
 * never a service account, nor the app owner while the switch is on (T-428),
 * then the source and language filters.
 *
 * Without 016 there is nothing to count, and the answer says so — `recorded:
 * false` — rather than zeros, which would read as nobody using the app
 * (CLAUDE.md, rule 10). Any other failure is the route's 500.
 *
 * Days are each person's own dates; "today" is today in their zone.
 */
import { isMissingTable } from '../usage/statsStore.js';
import { addDays, dateIn } from '../../utils/dateIn.js';
import { count, shortName, shownProject } from './people.js';

const RETENTION_DAYS = [1, 7, 30];
const rate = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

/** Run the reads of 016's tables; null when 016 is not applied. */
async function readRecorded(read) {
  try {
    return await read();
  } catch (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
}

/** The last day in the app per person; null when 016 is not applied. */
export async function lastAppDays(conn, ids = null) {
  if (ids && ids.length === 0) return new Map();
  const where = ids ? `WHERE user_id IN (${ids.map((_, i) => `$${i + 1}`).join(', ')})` : '';
  const rows = await readRecorded(() => conn.all(
    `SELECT user_id, CAST(MAX(day) AS TEXT) AS last_day FROM native_usage_days ${where} GROUP BY user_id`, ids || []));
  return rows && new Map(rows.map((row) => [Number(row.user_id), String(row.last_day).slice(0, 10)]));
}

const usedKey = (id, day) => `${Number(id)}|${String(day).slice(0, 10)}`;

/** The app days of these people, as a set of usedKey. */
async function usedDays(conn, people) {
  if (people.length === 0) return new Set();
  const rows = await conn.all(
    `SELECT user_id, CAST(day AS TEXT) AS day FROM native_usage_days WHERE user_id IN (${people.map((_, i) => `$${i + 1}`).join(', ')})`,
    people.map((person) => person.id));
  return new Set(rows.map((row) => usedKey(row.user_id, row.day)));
}

/**
 * Whether someone opened the app on day n after registering (registration day
 * is 0), in their zone: null when that day is not over yet, or fell before
 * recording began — before 016, nobody's use was recorded.
 */
function openedOnDay(person, n, now, firstDay, used) {
  const target = addDays(dateIn(person.createdAt, person.timezone), n);
  if (target >= dateIn(now, person.timezone) || firstDay === null || target < firstDay) return null;
  return used.has(usedKey(person.id, target));
}

/**
 * Days n of each group (T-425's test cohort and the week before it): per day,
 * who opened the app and of how many that day is over for. null without 016.
 */
export async function openedOnDays(conn, groups, now, days) {
  const recorded = await readRecorded(async () => {
    const [first, used] = await Promise.all([
      conn.get('SELECT CAST(MIN(day) AS TEXT) AS first_day FROM native_usage_days'),
      usedDays(conn, [...new Map(groups.flat().map((person) => [person.id, person])).values()]),
    ]);
    return { firstDay: first?.first_day ? String(first.first_day).slice(0, 10) : null, used };
  });
  if (recorded === null) return null;
  return groups.map((people) => Object.fromEntries(days.map((n) => {
    const tally = { opened: 0, of: 0 };
    for (const person of people) {
      const opened = person.createdAt === null ? null : openedOnDay(person, n, now, recorded.firstDay, recorded.used);
      if (opened === null) continue;
      tally.of += 1;
      if (opened) tally.opened += 1;
    }
    return [n, tally];
  })));
}

/**
 * Per project, the first UTC day its invitation was opened — in a browser or in
 * the app — or joined (T-427), as UTC midnight in ms. Counts tie to no person,
 * so the owner's own opening counts too. Empty without 016: then only a member
 * can say anyone joined.
 */
export async function firstInviteDays(conn) {
  const rows = await readRecorded(() => conn.all(
    `SELECT project_id, CAST(MIN(day) AS TEXT) AS first_day FROM native_invite_counts
     WHERE page_opens + app_opens + joins > 0 GROUP BY project_id`));
  return new Map((rows || []).map((row) => [Number(row.project_id),
    Date.parse(`${String(row.first_day).slice(0, 10)}T00:00:00.000Z`)]));
}

/** "YYYY-MM-DD" of the Monday of a date's week. */
function mondayOf(date) {
  const back = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(date, -back);
}

/**
 * Use of the app: active people, retention by registration week, builds in
 * use, and each project's invitation from page to join.
 * @param everyone the real people the filters select
 * @param cohort   those of them registered in the period
 */
export async function usage(conn, filters, { people, projects }, everyone, cohort) {
  const { now, since, until } = filters;
  const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);
  const recorded = await readRecorded(async () => {
    const [last, first, builds, invites] = await Promise.all([
      lastAppDays(conn),
      conn.get('SELECT CAST(MIN(day) AS TEXT) AS first_day FROM native_usage_days'),
      // Each person's latest build: on their latest day that named one.
      conn.all(`SELECT d.user_id, d.app_build FROM native_usage_days d
                WHERE d.app_build IS NOT NULL AND d.day = (SELECT MAX(x.day) FROM native_usage_days x
                  WHERE x.user_id = d.user_id AND x.app_build IS NOT NULL)`),
      conn.all(`SELECT project_id, SUM(page_opens) AS page_opens, SUM(app_opens) AS app_opens, SUM(joins) AS joins
                FROM native_invite_counts WHERE day >= $1 ${until === null ? '' : 'AND day < $2'} GROUP BY project_id`,
      [since === null ? '0001-01-01' : dayOf(since), ...(until === null ? [] : [dayOf(until)])]),
    ]);
    if (last === null) return null;
    return { last, firstDay: first?.first_day ? String(first.first_day).slice(0, 10) : null, builds, invites };
  });
  if (recorded === null) return { recorded: false };

  const todayOf = (person) => dateIn(now, person.timezone);
  const activeWithin = (person, days) => {
    const last = recorded.last.get(person.id);
    return last !== undefined && last >= addDays(todayOf(person), -(days - 1));
  };
  const active = { day: 0, week: 0, month: 0, of: everyone.length };
  for (const person of everyone) {
    if (activeWithin(person, 1)) active.day += 1;
    if (activeWithin(person, 7)) active.week += 1;
    if (activeWithin(person, 30)) active.month += 1;
  }

  // Retention: of the people registered in a week, who opened the app on
  // day 1, 7 and 30 after registering (openedOnDay).
  const used = await usedDays(conn, cohort);
  const weeks = new Map();
  for (const person of cohort) {
    if (person.createdAt === null) continue;
    const registered = dateIn(person.createdAt, person.timezone);
    const week = mondayOf(registered);
    if (!weeks.has(week)) {
      weeks.set(week, { week, registered: 0, ...Object.fromEntries(RETENTION_DAYS.map((n) => [`day${n}`, { opened: 0, of: 0 }])) });
    }
    const row = weeks.get(week);
    row.registered += 1;
    for (const n of RETENTION_DAYS) {
      const opened = openedOnDay(person, n, now, recorded.firstDay, used);
      if (opened === null) continue;
      row[`day${n}`].of += 1;
      if (opened) row[`day${n}`].opened += 1;
    }
  }
  const retention = [...weeks.values()].sort((a, b) => b.week.localeCompare(a.week)).map((row) => ({
    ...row, ...Object.fromEntries(RETENTION_DAYS.map((n) => [`day${n}`, { ...row[`day${n}`], rate: rate(row[`day${n}`].opened, row[`day${n}`].of) }])),
  }));

  // Builds among the people active in the last 30 days: what still runs
  // before MIN_IOS_BUILD is raised. "unknown": no day of theirs named one.
  const latestBuild = new Map(recorded.builds.map((row) => [Number(row.user_id), Number(row.app_build)]));
  const byBuild = new Map();
  for (const person of everyone) {
    if (!activeWithin(person, 30)) continue;
    const build = latestBuild.has(person.id) ? latestBuild.get(person.id) : null;
    byBuild.set(build, (byBuild.get(build) || 0) + 1);
  }
  const builds = [...byBuild.entries()].map(([build, peopleCount]) => ({ build, people: peopleCount }))
    .sort((a, b) => (b.build ?? -1) - (a.build ?? -1));

  const invitations = [];
  for (const row of recorded.invites) {
    const project = projects.get(Number(row.project_id));
    if (!project || !shownProject(project, filters)) continue;
    invitations.push({ project: project.name, owner: shortName(people.get(project.ownerId)),
      pageOpens: count(row.page_opens), appOpens: count(row.app_opens), joins: count(row.joins) });
  }
  invitations.sort((a, b) => b.pageOpens - a.pageOpens || b.appOpens - a.appOpens || b.joins - a.joins
    || a.project.localeCompare(b.project));

  return { recorded: true, since: recorded.firstDay, active, retention, builds, invitations };
}
