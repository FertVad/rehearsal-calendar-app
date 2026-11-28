/**
 * The admin's figures (T-293): the cards, the newcomer funnel, the organiser
 * funnel (T-427), where people come
 * from, how projects live, notifications and email codes, and use of the app
 * (T-294, usage.js). Read-only, computed when the admin page asks and at no
 * other time.
 *
 * Who is counted is people.js's: never a service account, then the source and
 * language filters. "The last N days" run back from now; dates (T-425) are
 * UTC days, both in, and bound every section above as well as below.
 */
import { seenBeforeStart } from '../rehearsals/roster.js';
import {
  MARK_SOURCES_SQL, count, counted, emptyFacts, leftOut, loadFacts, loadPeople, ownerAnswer, registeredSince,
  shortName, shownProject, toMs,
} from './people.js';
import { firstInviteDays, openedOnDays, usage } from './usage.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const iso = (ms) => new Date(ms).toISOString();
const EPOCH = iso(0);

const rate = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);
function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
const hours = (ms) => (ms === null ? null : Math.round((ms / 3600000) * 10) / 10);
const dayOf = (ms) => iso(ms).slice(0, 10);
/** The Monday (UTC) of an instant's week. */
function weekOf(ms) {
  const day = new Date(ms);
  const back = (day.getUTCDay() + 6) % 7;
  return dayOf(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() - back));
}

/** Rehearsal counts per project: all, the last four weeks, since the period began, and the next one. */
async function rehearsalsByProject(conn, now, since) {
  const rows = await conn.all(
    `SELECT project_id, COUNT(*) AS total,
       COUNT(CASE WHEN starts_at >= $1 AND starts_at <= $2 THEN 1 END) AS last_four_weeks,
       COUNT(CASE WHEN starts_at >= $3 THEN 1 END) AS since_start,
       MIN(CASE WHEN starts_at > $2 THEN starts_at END) AS next_at
     FROM native_rehearsals GROUP BY project_id`,
    [iso(now - 28 * DAY_MS), iso(now), since === null ? EPOCH : iso(since)]
  );
  return new Map(rows.map((row) => [Number(row.project_id), {
    total: count(row.total), lastFourWeeks: count(row.last_four_weeks), sinceStart: count(row.since_start),
    nextAt: toMs(row.next_at),
  }]));
}

/** The cards at the top: as of now, for the real people the filters select. */
export async function summary(conn, filters) {
  const { now } = filters;
  const [{ people, projects }, rehearsals] = await Promise.all([
    loadPeople(conn), rehearsalsByProject(conn, now, null),
  ]);
  const real = counted(people, filters);
  const since = (days) => real.filter((person) => registeredSince(person, now - days * DAY_MS)).length;
  // Who has not signed in for 30 days — and that is all it can say: the app
  // renews its session without a sign-in (H03). Use is the days in the app
  // (usage.js, from migration 016).
  const notSignedIn = real.filter((person) => (person.lastLoginAt ?? person.createdAt ?? 0) < now - 30 * DAY_MS).length;
  const liveProjects = [...projects.values()].filter((project) => shownProject(project, filters));
  return {
    owner: ownerAnswer(filters),
    users: { total: real.length, newThisWeek: since(7), newThisMonth: since(30) },
    signIns: { notInLast30Days: notSignedIn, rate: rate(notSignedIn, real.length) ?? 0 },
    usage: {
      projects: liveProjects.length,
      rehearsals: liveProjects.reduce((sum, project) => sum + (rehearsals.get(project.id)?.total || 0), 0),
    },
  };
}

// The calendar connected apart from marks made by hand (T-426): people.js's
// `calendar`, and rows with the source `manual` — weekends busy by default are
// neither.
const STEPS = ['registered', 'onboarding', 'project', 'calendar', 'manual', 'engaged'];
const emptySteps = () => Object.fromEntries(STEPS.map((step) => [step, 0]));
const emptyWaits = () => ({ project: [], calendar: [], manual: [] });

function funnel(cohort, facts) {
  const weeks = new Map();
  const total = { invite: emptySteps(), other: emptySteps() };
  const waits = { invite: emptyWaits(), other: emptyWaits() };
  for (const person of cohort) {
    if (person.createdAt === null) continue;
    const fact = facts.get(person.id) || emptyFacts();
    const group = person.source.kind === 'invite' ? 'invite' : 'other';
    const reached = {
      registered: true,
      onboarding: person.onboarding,
      project: person.memberships.length > 0,
      calendar: fact.calendar,
      manual: fact.manualMarks > 0,
      engaged: fact.seen > 0 || fact.ownRehearsals > 0,
    };
    const week = weekOf(person.createdAt);
    if (!weeks.has(week)) weeks.set(week, { week, invite: emptySteps(), other: emptySteps() });
    for (const step of STEPS) {
      if (!reached[step]) continue;
      weeks.get(week)[group][step] += 1;
      total[group][step] += 1;
    }
    const joined = person.memberships[0]?.joinedAt;
    if (joined !== null && joined !== undefined) waits[group].project.push(Math.max(0, joined - person.createdAt));
    if (fact.calendarAt !== null) waits[group].calendar.push(Math.max(0, fact.calendarAt - person.createdAt));
    if (fact.firstManualAt !== null) waits[group].manual.push(Math.max(0, fact.firstManualAt - person.createdAt));
  }
  const medians = Object.fromEntries(Object.entries(waits).map(([group, wait]) => [group, {
    toProjectHours: hours(median(wait.project)), toProjectOf: wait.project.length,
    toCalendarHours: hours(median(wait.calendar)), toCalendarOf: wait.calendar.length,
    toManualHours: hours(median(wait.manual)), toManualOf: wait.manual.length,
  }]));
  return { weeks: [...weeks.values()].sort((a, b) => b.week.localeCompare(a.week)), total, medians };
}

// The organiser's steps (T-427), after owning a project still there.
const ORGANIZER_STEPS = ['invite', 'member', 'threeMembers', 'firstRehearsal', 'secondRehearsal'];
/** The earliest of times reached; null when reached at an unknown time, undefined when not at all. */
const earliest = (times) => (times.length === 0 ? undefined
  : times.reduce((known, at) => (known === null ? at : at === null ? known : Math.min(known, at))));

/**
 * The first two rehearsals each person created in a project they own and that
 * is still there — not in someone else's project. A deleted rehearsal or
 * project has no row left. Nulls last in both dialects.
 */
async function ownRehearsals(conn) {
  const rows = await conn.all(
    `SELECT created_by, created_at FROM (
       SELECT r.created_by, r.created_at, ROW_NUMBER() OVER (PARTITION BY r.created_by
         ORDER BY CASE WHEN r.created_at IS NULL THEN 1 ELSE 0 END, r.created_at, r.id) AS n
       FROM native_rehearsals r
       JOIN native_projects p ON p.id = r.project_id
       JOIN native_project_members m ON m.project_id = r.project_id AND m.user_id = r.created_by
         AND m.role = 'owner' AND m.status = 'active'
       WHERE r.created_by IS NOT NULL) ranked
     WHERE n <= 2 ORDER BY created_by, n`
  );
  const byPerson = new Map();
  for (const row of rows) {
    const id = Number(row.created_by);
    if (!byPerson.has(id)) byPerson.set(id, []);
    byPerson.get(id).push(toMs(row.created_at));
  }
  return byPerson;
}

/**
 * Per person, a function of their organiser steps: null without a project of
 * their own still there; otherwise when each step was reached (earliest()).
 * Members are active ones other than the organiser and those left out of every
 * figure (people.js's leftOut), in one project — those of different projects
 * are not added up. The invitation is opened when 016 counted an opening or a
 * join on one of their projects, or one of them has such a member.
 */
async function loadOrganizers(conn, { people, projects }, filters) {
  const [inviteDays, rehearsals] = await Promise.all([firstInviteDays(conn), ownRehearsals(conn)]);
  return (person) => {
    const owned = person.memberships.filter((membership) => membership.role === 'owner' && projects.has(membership.projectId))
      .map((membership) => projects.get(membership.projectId));
    if (owned.length === 0) return null;
    const joined = owned.map((project) => project.members.filter((membership) => membership.userId !== person.id
      && people.has(membership.userId) && !leftOut(people.get(membership.userId), filters))
      .map((membership) => membership.joinedAt));
    const nth = (n) => earliest(joined.filter((times) => times.length >= n).map((times) => times[n - 1]));
    const created = rehearsals.get(person.id) || [];
    return {
      invite: earliest(owned.flatMap((project, index) => [
        ...(inviteDays.has(project.id) ? [inviteDays.get(project.id)] : []), ...joined[index].slice(0, 1)])),
      member: nth(1),
      threeMembers: nth(3),
      firstRehearsal: created.length >= 1 ? created[0] : undefined,
      secondRehearsal: created.length >= 2 ? created[1] : undefined,
    };
  };
}

/** The organiser funnel: by registration week, steps as of now; the median to the first own rehearsal. */
function organizerFunnel(cohort, organizer) {
  const empty = () => Object.fromEntries(['registered', 'project', ...ORGANIZER_STEPS].map((step) => [step, 0]));
  const weeks = new Map();
  const total = empty();
  const waits = [];
  for (const person of cohort) {
    if (person.createdAt === null) continue;
    const week = weekOf(person.createdAt);
    if (!weeks.has(week)) weeks.set(week, { week, ...empty() });
    const rows = [weeks.get(week), total];
    const reached = organizer(person);
    const add = (step) => rows.forEach((row) => { row[step] += 1; });
    add('registered');
    if (reached === null) continue;
    add('project');
    for (const step of ORGANIZER_STEPS) if (reached[step] !== undefined) add(step);
    if (reached.firstRehearsal !== undefined && reached.firstRehearsal !== null) {
      waits.push(Math.max(0, reached.firstRehearsal - person.createdAt));
    }
  }
  return {
    weeks: [...weeks.values()].sort((a, b) => b.week.localeCompare(a.week)),
    total,
    median: { toFirstRehearsalHours: hours(median(waits)), toFirstRehearsalOf: waits.length },
  };
}

function sources(cohort, everyone, projects, people, filters) {
  const { since, until } = filters;
  const byDay = new Map();
  const byWeek = new Map();
  const tally = (map, key, kind) => {
    if (!map.has(key)) map.set(key, { date: key, invite: 0, own: 0, none: 0 });
    map.get(key)[kind] += 1;
  };
  const languages = new Map();
  const timezones = new Map();
  for (const person of cohort) {
    if (person.createdAt !== null) {
      tally(byDay, dayOf(person.createdAt), person.source.kind);
      tally(byWeek, weekOf(person.createdAt), person.source.kind);
    }
    languages.set(person.locale ?? '', (languages.get(person.locale ?? '') || 0) + 1);
    timezones.set(person.timezone ?? '', (timezones.get(person.timezone ?? '') || 0) + 1);
  }
  const real = new Set(everyone.map((person) => person.id));
  const brought = [];
  for (const project of projects.values()) {
    if (!shownProject(project, filters)) continue;
    const joined = project.members.filter((membership) => membership.role !== 'owner' && real.has(membership.userId)
      && ((since === null && until === null) || (membership.joinedAt !== null
        && (since === null || membership.joinedAt >= since) && (until === null || membership.joinedAt < until)))).length;
    const newcomers = cohort.filter((person) => person.source.kind === 'invite'
      && person.source.projectId === project.id).length;
    if (joined || newcomers) {
      brought.push({ project: project.name, owner: shortName(people.get(project.ownerId)), joined, newcomers });
    }
  }
  const sorted = (map) => [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
  const ranked = (map) => [...map.entries()].map(([value, people]) => ({ value: value || null, people }))
    .sort((a, b) => b.people - a.people || String(a.value).localeCompare(String(b.value)));
  return {
    byDay: sorted(byDay), byWeek: sorted(byWeek),
    projects: brought.sort((a, b) => b.joined - a.joined || b.newcomers - a.newcomers),
    languages: ranked(languages), timezones: ranked(timezones),
  };
}

/**
 * Who has anything in the next 14 days. All-day marks are dates kept at UTC
 * midnight and are read in UTC: anything that has not ended before today's UTC
 * date and starts before the 15th date — so a stretch from a calendar that
 * began before today and is still going counts. Timed ones are instants:
 * anything that has not ended by now and starts within 14 days.
 */
async function coveredPeople(conn, now) {
  const today = new Date(now);
  const firstDate = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const rows = await conn.all(
    `SELECT DISTINCT user_id FROM native_user_availability
     WHERE source IN (${MARK_SOURCES_SQL})
       AND ((is_all_day = TRUE AND ends_at > $1 AND starts_at < $2)
         OR (is_all_day = FALSE AND ends_at > $3 AND starts_at < $4))`,
    [iso(firstDate), iso(firstDate + 14 * DAY_MS), iso(now), iso(now + 14 * DAY_MS)]
  );
  return new Set(rows.map((row) => Number(row.user_id)));
}

async function projectHealth(conn, filters, { people, projects }, everyone, facts) {
  const { now, since, until } = filters;
  const [rehearsals, seen, covered] = await Promise.all([
    rehearsalsByProject(conn, now, since),
    seenBeforeStart(conn, iso(now - 30 * DAY_MS), iso(now)),
    coveredPeople(conn, now),
  ]);
  const real = new Set(everyone.map((person) => person.id));
  const seenByProject = new Map();
  for (const row of seen) {
    if (!real.has(Number(row.user_id))) continue;
    const entry = seenByProject.get(Number(row.project_id)) || { seen: 0, of: 0 };
    entry.seen += count(row.seen_before);
    entry.of += count(row.on_roster);
    seenByProject.set(Number(row.project_id), entry);
  }
  const list = [];
  for (const project of projects.values()) {
    if (!shownProject(project, filters)) continue;
    const counts = rehearsals.get(project.id) || { total: 0, lastFourWeeks: 0, sinceStart: 0, nextAt: null };
    // Created in the period, or a rehearsal from its start on — in the future
    // too, as the page's note says, whether or not the period has an end.
    const live = since === null || (project.createdAt !== null && project.createdAt >= since
      && (until === null || project.createdAt < until)) || counts.sinceStart > 0;
    if (!live) continue;
    const members = project.members.filter((membership) => real.has(membership.userId));
    const withMarks = members.filter((membership) => covered.has(membership.userId)).length;
    // The funnel's "calendar connected" (T-426), of the same members.
    const connected = members.filter((membership) => facts.get(membership.userId)?.calendar === true).length;
    const seenRow = seenByProject.get(project.id) || { seen: 0, of: 0 };
    list.push({
      id: project.id,
      name: project.name,
      owner: shortName(people.get(project.ownerId)),
      createdAt: project.createdAt === null ? null : iso(project.createdAt),
      members: members.length,
      rehearsals: counts.total,
      rehearsalsLastFourWeeks: counts.lastFourWeeks,
      nextRehearsalAt: counts.nextAt === null ? null : iso(counts.nextAt),
      seenBeforeStart: { seen: seenRow.seen, of: seenRow.of, rate: rate(seenRow.seen, seenRow.of) },
      coverage: { people: withMarks, of: members.length, rate: rate(withMarks, members.length) },
      calendar: { people: connected, of: members.length, rate: rate(connected, members.length) },
    });
  }
  return list.sort((a, b) => b.members - a.members || b.rehearsals - a.rehearsals || a.id - b.id);
}

async function notifications(conn, filters, cohort, everyone, facts) {
  const from = filters.since === null ? EPOCH : iso(filters.since);
  const before = (column) => (filters.until === null ? '' : `AND ${column} < $2`);
  const range = filters.until === null ? [from] : [from, iso(filters.until)];
  const [inbox, codes] = await Promise.all([
    conn.all(`SELECT user_id, type, created_at, read_at FROM native_notifications
              WHERE created_at >= $1 ${before('created_at')}`, range),
    // "Used": closed while still live — neither replaced by a newer code (the
    // replacement closes it at its own creation time) nor locked by the fifth
    // wrong guess. A reset or an address change also closes the codes still
    // live, and the table does not tell that apart from a right code.
    conn.all(
      `SELECT c.user_id, c.purpose, COUNT(*) AS created, COUNT(c.sent_at) AS sent, COUNT(c.failed_at) AS failed,
         COUNT(CASE WHEN c.consumed_at IS NOT NULL AND EXISTS (
           SELECT 1 FROM native_email_codes n WHERE n.user_id = c.user_id AND n.purpose = c.purpose
             AND n.id > c.id AND n.created_at = c.consumed_at) THEN 1 END) AS replaced,
         COUNT(CASE WHEN c.consumed_at IS NOT NULL AND c.attempts >= 5 THEN 1 END) AS locked,
         COUNT(CASE WHEN c.consumed_at IS NOT NULL AND c.attempts < 5 AND NOT EXISTS (
           SELECT 1 FROM native_email_codes n WHERE n.user_id = c.user_id AND n.purpose = c.purpose
             AND n.id > c.id AND n.created_at = c.consumed_at) THEN 1 END) AS used
       FROM native_email_codes c WHERE c.created_at >= $1 ${before('c.created_at')}
       GROUP BY c.user_id, c.purpose`,
      range
    ),
  ]);
  const real = new Set(everyone.map((person) => person.id));
  const types = new Map();
  for (const row of inbox) {
    if (!real.has(Number(row.user_id))) continue;
    const entry = types.get(row.type) || { type: row.type, created: 0, read: 0, waits: [] };
    entry.created += 1;
    const created = toMs(row.created_at);
    const read = toMs(row.read_at);
    if (read !== null) {
      entry.read += 1;
      if (created !== null) entry.waits.push(Math.max(0, read - created));
    }
    types.set(row.type, entry);
  }
  const purposes = new Map();
  for (const row of codes) {
    if (!real.has(Number(row.user_id))) continue;
    const entry = purposes.get(row.purpose) || { purpose: row.purpose, created: 0, sent: 0, failed: 0, used: 0, replaced: 0, locked: 0 };
    for (const key of ['created', 'sent', 'failed', 'used', 'replaced', 'locked']) entry[key] += count(row[key]);
    purposes.set(row.purpose, entry);
  }
  const withDevice = cohort.filter((person) => (facts.get(person.id) || emptyFacts()).device).length;
  return {
    devices: { people: withDevice, of: cohort.length, rate: rate(withDevice, cohort.length) },
    inbox: [...types.values()].map(({ waits, ...entry }) => ({
      ...entry, readRate: rate(entry.read, entry.created),
      medianMinutesToRead: waits.length ? Math.round(median(waits) / 60000) : null,
    })).sort((a, b) => b.created - a.created || a.type.localeCompare(b.type)),
    emailCodes: [...purposes.values()].sort((a, b) => a.purpose.localeCompare(b.purpose)),
  };
}

// The test cohort's steps count when reached within this many days of
// registering, for both columns alike: otherwise the week before would have had
// a week longer to get there (T-425, the monitor's decision).
const STEP_DAYS = 7;
const STEP_MS = STEP_DAYS * DAY_MS;
const OPENED_DAYS = [1, 7];
// A share, or no figure at all when nobody's time is up yet — never 0.
const cell = (part, whole) => (whole > 0 ? { count: part, of: whole, rate: rate(part, whole) } : null);

/**
 * One column of the test cohort: the people registered in [since, until).
 * Onboarding has no time recorded, so it is as of now and of everyone in the
 * column. Each other step is reached within STEP_DAYS of registering, of those
 * whose STEP_DAYS are over; days 1 and 7 are usage.js's.
 */
function cohortColumn({ since, until, begun }, people, { facts, projects, now, opened, organizer }) {
  const days = Math.round((until - since) / DAY_MS);
  // The days already begun (T-425, point 6): a running test divided by all its
  // days would read low beside a full week before. None begun: no figure.
  const daysBegun = Math.round((Math.min(until, begun) - since) / DAY_MS);
  const due = people.filter((person) => person.createdAt + STEP_MS <= now);
  const within = (person, at) => at !== null && at !== undefined && at < person.createdAt + STEP_MS;
  const reached = (step) => cell(due.filter(step).length, due.length);
  const day = (n) => (opened === null ? null : cell(opened[n].opened, opened[n].of));
  // Owns a project, still there, created within the days.
  const createdProject = (person) => person.memberships.some((membership) => membership.role === 'owner'
    && within(person, projects.get(membership.projectId)?.createdAt));
  // The organiser's steps (T-427): of those who created a project within the
  // days, as in the funnel. Nobody's time up: null; time up, but nobody created
  // a project: 0 of 0, no figure.
  const creators = due.filter(createdProject);
  const organizerStep = (step) => {
    if (due.length === 0) return null;
    const count = creators.filter((person) => within(person, organizer(person)?.[step])).length;
    return { count, of: creators.length, rate: rate(count, creators.length) };
  };
  return {
    from: dayOf(since),
    to: dayOf(until - DAY_MS),
    days,
    registered: people.length,
    perDay: daysBegun > 0 ? Math.round((people.length / daysBegun) * 10) / 10 : null,
    onboarding: cell(people.filter((person) => person.onboarding).length, people.length),
    project: reached(createdProject),
    ...Object.fromEntries(ORGANIZER_STEPS.map((step) => [step, organizerStep(step)])),
    // The earliest membership still active.
    inProject: reached((person) => within(person, person.memberships[0]?.joinedAt)),
    // The earliest record of a connected calendar still kept: an export, an import.
    calendar: reached((person) => within(person, (facts.get(person.id) || emptyFacts()).calendarAt)),
    // The earliest hand mark still kept.
    manual: reached((person) => within(person, (facts.get(person.id) || emptyFacts()).firstManualAt)),
    day1: day(1),
    day7: day(7),
  };
}

/** The test cohort (the dates) beside the seven days before its first one, same filters. */
async function testCohort(conn, filters, everyone, projects, facts, organizer) {
  // The test counts up to the end of today (UTC); the week before is always whole.
  const today = Math.floor(filters.now / DAY_MS) * DAY_MS;
  const ranges = [
    { since: filters.since, until: filters.until, begun: today + DAY_MS },
    { since: filters.since - 7 * DAY_MS, until: filters.since, begun: filters.since },
  ];
  const groups = ranges.map(({ since, until }) => everyone.filter((person) => person.createdAt !== null
    && registeredSince(person, since, until)));
  const opened = await openedOnDays(conn, groups, filters.now, OPENED_DAYS);
  const [test, before] = ranges.map((range, index) => cohortColumn(range, groups[index], {
    facts, projects, now: filters.now, opened: opened === null ? null : opened[index], organizer,
  }));
  return { stepDays: STEP_DAYS, recorded: opened !== null, test, before };
}

/** Everything under the cards, for one period and filter. */
export async function analytics(conn, filters) {
  const directory = await loadPeople(conn);
  const everyone = counted(directory.people, filters);
  const cohort = everyone.filter((person) => registeredSince(person, filters.since, filters.until));
  const [facts, organizer] = await Promise.all([loadFacts(conn, null), loadOrganizers(conn, directory, filters)]);
  const [health, delivery, use, test] = await Promise.all([
    projectHealth(conn, filters, directory, everyone, facts),
    notifications(conn, filters, cohort, everyone, facts),
    usage(conn, filters, directory, everyone, cohort),
    filters.cohort ? testCohort(conn, filters, everyone, directory.projects, facts, organizer) : null,
  ]);
  const languages = [...new Set([...directory.people.values()].filter((person) => !leftOut(person, filters))
    .map((person) => person.locale).filter(Boolean))].sort();
  return {
    owner: ownerAnswer(filters),
    period: filters.period,
    from: filters.since === null ? null : iso(filters.since),
    to: iso(filters.until ?? filters.now),
    people: cohort.length,
    languages,
    ...(test ? { cohort: test } : {}),
    funnel: funnel(cohort, facts),
    organizers: organizerFunnel(cohort, organizer),
    sources: sources(cohort, everyone, directory.projects, directory.people, filters),
    projects: health,
    notifications: delivery,
    usage: use,
  };
}
