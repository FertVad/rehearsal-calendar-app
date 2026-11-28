/**
 * Who the admin counts, and where each of them came from (T-293).
 *
 * Read-only, and only what the database already keeps: nothing here writes,
 * schedules or records anything. The admin page asks; nothing else does.
 *
 * One rule for every figure and for the users table:
 * - Service accounts count nowhere: addresses on rehearsly.me and
 *   demo.rehearsly.me (the demo cast of seed-demo.mjs, the App Review
 *   accounts), and the addresses the owner lists in ADMIN_SERVICE_EMAILS,
 *   comma-separated. No other address is written here: the repository is
 *   public. The users table shows them only when asked, marked.
 * - A project is left out only when its owner is on one of the two domains —
 *   the demo troupe. A project of the owner of the service is real people.
 * - Where someone came from is their earliest active membership: role owner
 *   — their own project; any other — an invitation, whatever role they hold
 *   now (an invited member made admin is still "invited"). Someone who left
 *   every project has no membership row left, so they read "no project".
 *
 * Summaries are composed in JavaScript from a fixed handful of grouped
 * queries, one per kind of fact — never one per person. The SQL stays in the
 * dialect both PostgreSQL and the SQLite fixtures speak, and the medians do
 * not need percentile_cont.
 */
import { answersByPerson } from '../rehearsals/roster.js';
import { AVAILABILITY_SOURCES } from '../../constants/timezone.js';
import { dateIn } from '../../utils/dateIn.js';

const SERVICE_DOMAINS = ['rehearsly.me', 'demo.rehearsly.me'];
const DAY_MS = 24 * 60 * 60 * 1000;

// What a person marked themselves or brought in from a calendar — not the busy
// slots the server books for rehearsals, nor the weekend days busy by default.
const MARK_SOURCES = [AVAILABILITY_SOURCES.MANUAL, AVAILABILITY_SOURCES.GOOGLE, AVAILABILITY_SOURCES.APPLE];
export const MARK_SOURCES_SQL = MARK_SOURCES.map((source) => `'${source}'`).join(', ');
// "Calendar connected" (T-295, T-426) is either direction: busy times imported
// from a calendar, or rehearsals exported to the phone's calendar — whose
// records (native_calendar_connections, made by the first export) stay after
// sync is turned off. Sync turned on with nothing imported or exported leaves
// nothing on the server.
const CALENDAR_SOURCES_SQL = [AVAILABILITY_SOURCES.GOOGLE, AVAILABILITY_SOURCES.APPLE]
  .map((source) => `'${source}'`).join(', ');
const MANUAL_SQL = `'${AVAILABILITY_SOURCES.MANUAL}'`;

const PERIODS = { 7: 7, 30: 30, 90: 90, all: null };
const SOURCES = ['invite', 'own', 'none'];
// The test cohort (T-425): everyone who did not come by invitation. The source
// is the earliest active membership, so this is only an approximation of "not
// invited" — the one signal there is without a migration.
const COHORT_SOURCES = ['own', 'none'];
// The longest stretch of dates a request may name, both days counted (CLAUDE.md,
// rule 8: the cap comes before anything is read for it). The page checks the
// same number before asking (dashboard.js, MAX_PERIOD_DAYS).
const MAX_PERIOD_DAYS = 366;

/** `code` is what the page names the refusal by; the message stays English. */
export class FilterRefused extends Error {
  constructor(message, code = 'FILTER', details = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

const textOf = (value) => (value === undefined || value === '' ? null : String(value));

/** UTC midnight of a real "YYYY-MM-DD" day, or null — 2026-02-30 is not one. */
function dayStart(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  // Parsed as an ISO instant: Date.UTC would take the year 0001 for 1901.
  const ms = Date.parse(`${text}T00:00:00.000Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === text ? ms : null;
}

/** from=YYYY-MM-DD&to=YYYY-MM-DD: UTC days, both in; until is the midnight after `to`. */
function datesOf(query) {
  const from = textOf(query.from);
  const to = textOf(query.to);
  if (from === null || to === null) throw new FilterRefused('from and to are both required', 'DATES_MISSING');
  const since = dayStart(from);
  const last = dayStart(to);
  if (since === null || last === null) throw new FilterRefused('from and to must be dates, YYYY-MM-DD', 'DATES_FORMAT');
  if (since > last) throw new FilterRefused('from is after to', 'DATES_ORDER');
  if ((last - since) / DAY_MS + 1 > MAX_PERIOD_DAYS) {
    throw new FilterRefused(`at most ${MAX_PERIOD_DAYS} days`, 'DATES_TOO_LONG', { maxDays: MAX_PERIOD_DAYS });
  }
  return { since, until: last + DAY_MS };
}

export const toMs = (value) => {
  if (value === null || value === undefined) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};
const truthy = (value) => value === true || value === 1 || value === '1' || value === 't' || value === 'true';
export const count = (value) => Number(value) || 0;

/**
 * period (or from and to), source, lang, the test cohort and the service switch,
 * from a query string; refuses anything else. A period is [since, until):
 * `until` is null for "the last N days" and "all time", which run up to now.
 */
export function parseFilters(query, now = Date.now()) {
  const named = textOf(query.period);
  const dated = named === 'dates' || textOf(query.from) !== null || textOf(query.to) !== null;
  if (dated && named !== null && named !== 'dates') {
    throw new FilterRefused('from and to go with period=dates, not with another period', 'DATES_PERIOD');
  }
  const period = dated ? 'dates' : named ?? 'all';
  if (!dated && !Object.hasOwn(PERIODS, period)) throw new FilterRefused('period must be 7, 30, 90, all or dates');
  const { since, until } = dated ? datesOf(query)
    : { since: PERIODS[period] === null ? null : now - PERIODS[period] * DAY_MS, until: null };
  const source = textOf(query.source);
  if (source !== null && !SOURCES.includes(source)) throw new FilterRefused('source must be invite, own or none');
  const lang = textOf(query.lang);
  if (lang !== null && !/^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{1,8})?$/.test(lang)) throw new FilterRefused('lang is not a language code');
  const cohortValue = textOf(query.cohort);
  if (cohortValue !== null && cohortValue !== '0' && cohortValue !== '1') throw new FilterRefused('cohort must be 0 or 1');
  const cohort = cohortValue === '1';
  if (cohort && !dated) throw new FilterRefused('the test cohort needs from and to', 'COHORT_DATES');
  if (cohort && source !== null) throw new FilterRefused('the test cohort fixes the source', 'COHORT_SOURCE');
  const sources = cohort ? COHORT_SOURCES : source === null ? null : [source];
  return { period, since, until, source, sources, cohort, lang, service: query.service === '1', now };
}

function serviceAddresses() {
  return new Set(String(process.env.ADMIN_SERVICE_EMAILS || '').split(',')
    .map((address) => address.trim().toLowerCase()).filter(Boolean));
}

function onServiceDomain(email) {
  const address = String(email || '').trim().toLowerCase();
  return SERVICE_DOMAINS.includes(address.slice(address.lastIndexOf('@') + 1));
}

/** "Maria K." — the name the admin shows beside a project. */
export function shortName(person) {
  if (!person) return null;
  const first = (person.firstName || '').trim();
  const initial = Array.from((person.lastName || '').trim())[0];
  return [first, initial ? `${initial}.` : ''].filter(Boolean).join(' ') || null;
}

/**
 * Everyone, with their memberships and source; every project with its owner and
 * active members. Three queries whatever the number of people.
 */
export async function loadPeople(conn) {
  const listed = serviceAddresses();
  const [users, memberships, projectRows] = await Promise.all([
    conn.all(`SELECT id, email, first_name, last_name, locale, timezone, onboarding_completed,
                CASE WHEN password_hash IS NULL THEN 0 ELSE 1 END AS has_password, created_at, last_login_at
              FROM native_users`),
    conn.all(`SELECT id, user_id, project_id, role, COALESCE(joined_at, created_at) AS joined_at
              FROM native_project_members WHERE status = 'active'`),
    conn.all('SELECT id, name, created_at FROM native_projects'),
  ]);

  const people = new Map();
  for (const row of users) {
    const email = row.email;
    people.set(Number(row.id), {
      id: Number(row.id), email, firstName: row.first_name, lastName: row.last_name,
      locale: row.locale ?? null, timezone: row.timezone ?? null,
      onboarding: truthy(row.onboarding_completed), hasPassword: truthy(row.has_password),
      createdAt: toMs(row.created_at), lastLoginAt: toMs(row.last_login_at),
      service: onServiceDomain(email) || listed.has(String(email || '').trim().toLowerCase()),
      memberships: [], source: { kind: 'none', projectId: null },
    });
  }

  const projects = new Map();
  for (const row of projectRows) {
    projects.set(Number(row.id), { id: Number(row.id), name: row.name, createdAt: toMs(row.created_at),
      ownerId: null, members: [], serviceOwned: false });
  }

  const ordered = memberships.map((row) => ({ id: Number(row.id), userId: Number(row.user_id),
    projectId: Number(row.project_id), role: row.role, joinedAt: toMs(row.joined_at) }))
    .sort((a, b) => (a.joinedAt ?? Infinity) - (b.joinedAt ?? Infinity) || a.id - b.id);
  for (const membership of ordered) {
    const person = people.get(membership.userId);
    const project = projects.get(membership.projectId);
    if (!person || !project) continue;
    person.memberships.push(membership);
    project.members.push(membership);
    if (membership.role === 'owner' && project.ownerId === null) project.ownerId = membership.userId;
  }
  for (const person of people.values()) {
    const first = person.memberships[0];
    if (first) person.source = { kind: first.role === 'owner' ? 'own' : 'invite', projectId: first.projectId };
  }
  for (const project of projects.values()) {
    project.serviceOwned = onServiceDomain(people.get(project.ownerId)?.email);
  }
  return { people, projects };
}

export const matches = (person, filters) =>
  (!filters.sources || filters.sources.includes(person.source.kind)) && (!filters.lang || person.locale === filters.lang);

/** Registered in [since, until); a null end is open. */
export const registeredSince = (person, since, until = null) => (since === null && until === null)
  || (person.createdAt !== null && (since === null || person.createdAt >= since)
    && (until === null || person.createdAt < until));

/** The real people these filters select: never a service account. */
export const counted = (people, filters) => [...people.values()].filter((person) => !person.service && matches(person, filters));

/**
 * Per person: sign-in methods, marks by hand and marks from a calendar apart,
 * calendar connected (import or export) and since when, device, roster answers
 * and rehearsals they created. Six grouped queries; `ids` null — everyone.
 *
 * The times are the earliest rows still kept: saving a day again replaces its
 * marks, an import replaces its own, so either may read later than it was.
 */
export async function loadFacts(conn, ids = null) {
  if (ids && ids.length === 0) return new Map();
  const list = ids ? ids.map((_, i) => `$${i + 1}`).join(', ') : '';
  const where = (column) => (ids ? `WHERE ${column} IN (${list})` : '');
  const and = (column) => (ids ? `AND ${column} IN (${list})` : '');
  const params = ids || [];
  const [providers, marks, calendars, devices, answers, created] = await Promise.all([
    conn.all(`SELECT user_id, provider_type FROM native_auth_providers ${where('user_id')}
              GROUP BY user_id, provider_type`, params),
    conn.all(`SELECT user_id, is_all_day,
                SUM(CASE WHEN source = ${MANUAL_SQL} THEN 1 ELSE 0 END) AS manual,
                MIN(CASE WHEN source = ${MANUAL_SQL} THEN created_at END) AS manual_first_at,
                MAX(CASE WHEN source = ${MANUAL_SQL} THEN ends_at END) AS manual_last_end,
                SUM(CASE WHEN source IN (${CALENDAR_SOURCES_SQL}) THEN 1 ELSE 0 END) AS imported,
                MIN(CASE WHEN source IN (${CALENDAR_SOURCES_SQL}) THEN created_at END) AS imported_first_at
              FROM native_user_availability WHERE source IN (${MARK_SOURCES_SQL}) ${and('user_id')}
              GROUP BY user_id, is_all_day`, params),
    conn.all(`SELECT user_id, COUNT(*) AS calendars, MIN(created_at) AS first_at
              FROM native_calendar_connections ${where('user_id')}
              GROUP BY user_id`, params),
    conn.all(`SELECT user_id, COUNT(*) AS devices FROM native_push_tokens ${where('user_id')}
              GROUP BY user_id`, params),
    answersByPerson(conn, ids),
    conn.all(`SELECT created_by, COUNT(*) AS rehearsals FROM native_rehearsals
              WHERE created_by IS NOT NULL ${and('created_by')} GROUP BY created_by`, params),
  ]);

  const facts = new Map();
  const of = (id) => {
    const key = Number(id);
    if (!facts.has(key)) facts.set(key, emptyFacts());
    return facts.get(key);
  };
  const earlier = (known, value) => {
    const ms = toMs(value);
    return ms !== null && (known === null || ms < known) ? ms : known;
  };
  for (const row of providers) of(row.user_id).signIn.add(row.provider_type);
  for (const row of marks) {
    const fact = of(row.user_id);
    fact.manualMarks += count(row.manual);
    fact.firstManualAt = earlier(fact.firstManualAt, row.manual_first_at);
    fact.calendarMarks += count(row.imported);
    if (count(row.imported) > 0) {
      fact.calendar = true;
      fact.calendarAt = earlier(fact.calendarAt, row.imported_first_at);
    }
    // The last date reached is by hand marks alone (T-426).
    if (truthy(row.is_all_day)) fact.allDayLastEnd = toMs(row.manual_last_end);
    else fact.timedLastEnd = toMs(row.manual_last_end);
  }
  for (const row of calendars) {
    if (count(row.calendars) === 0) continue;
    const fact = of(row.user_id);
    fact.calendar = true;
    fact.calendarAt = earlier(fact.calendarAt, row.first_at);
  }
  for (const row of devices) of(row.user_id).device = count(row.devices) > 0;
  for (const row of answers) {
    of(row.user_id).onRoster = count(row.on_roster);
    of(row.user_id).seen = count(row.seen);
  }
  for (const row of created) of(row.created_by).ownRehearsals = count(row.rehearsals);
  return facts;
}

export const emptyFacts = () => ({ signIn: new Set(), manualMarks: 0, firstManualAt: null, allDayLastEnd: null,
  timedLastEnd: null, calendarMarks: 0, calendar: false, calendarAt: null, device: false, onRoster: 0, seen: 0,
  ownRehearsals: 0 });

/**
 * The last date someone's hand marks reach. An all-day mark is a calendar date
 * stored at UTC midnight, so it is read in UTC; a timed one in their own zone
 * (CLAUDE.md, rule 3).
 */
function marksUntil(person, fact) {
  const dates = [];
  if (fact.allDayLastEnd !== null) dates.push(new Date(fact.allDayLastEnd - 1).toISOString().slice(0, 10));
  if (fact.timedLastEnd !== null) dates.push(dateIn(fact.timedLastEnd - 1, person.timezone));
  return dates.sort().at(-1) ?? null;
}

function signInMethods(person, fact) {
  const methods = ['apple', 'google', 'email'].filter((method) => fact.signIn.has(method));
  // Accounts from before sign-in methods were recorded have a password and no row.
  if (methods.length === 0 && person.hasPassword) methods.push('email');
  return methods;
}

/** One row of the users table. Only this table carries addresses. */
export function userRow(person, fact, { people, projects }) {
  const project = projects.get(person.source.projectId);
  const roles = { owner: 0, admin: 0, member: 0 };
  for (const membership of person.memberships) {
    roles[Object.hasOwn(roles, membership.role) ? membership.role : 'member'] += 1;
  }
  return {
    id: person.id,
    email: person.email,
    firstName: person.firstName,
    lastName: person.lastName,
    createdAt: person.createdAt === null ? null : new Date(person.createdAt).toISOString(),
    lastLoginAt: person.lastLoginAt === null ? null : new Date(person.lastLoginAt).toISOString(),
    service: person.service,
    source: {
      kind: person.source.kind,
      project: project ? project.name : null,
      owner: project && person.source.kind === 'invite' ? shortName(people.get(project.ownerId)) : null,
    },
    signIn: signInMethods(person, fact),
    locale: person.locale,
    timezone: person.timezone,
    steps: {
      onboarding: person.onboarding,
      projects: person.memberships.length,
      roles,
      manualMarks: fact.manualMarks,
      marksUntil: marksUntil(person, fact),
      calendarMarks: fact.calendarMarks,
      calendar: fact.calendar,
      device: fact.device,
      seen: fact.seen,
      onRoster: fact.onRoster,
      rehearsals: fact.ownRehearsals,
    },
  };
}
