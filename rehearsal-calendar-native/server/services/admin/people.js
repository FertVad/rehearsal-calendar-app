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

const SERVICE_DOMAINS = ['rehearsly.me', 'demo.rehearsly.me'];
const DAY_MS = 24 * 60 * 60 * 1000;

// What a person marked themselves or brought in from a calendar — not the busy
// slots the server books for rehearsals.
const MARK_SOURCES = [AVAILABILITY_SOURCES.MANUAL, AVAILABILITY_SOURCES.GOOGLE, AVAILABILITY_SOURCES.APPLE];
export const MARK_SOURCES_SQL = MARK_SOURCES.map((source) => `'${source}'`).join(', ');

const PERIODS = { 7: 7, 30: 30, 90: 90, all: null };
const SOURCES = ['invite', 'own', 'none'];

export class FilterRefused extends Error {}

export const toMs = (value) => {
  if (value === null || value === undefined) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};
const truthy = (value) => value === true || value === 1 || value === '1' || value === 't' || value === 'true';
export const count = (value) => Number(value) || 0;

/** period, source, lang and the service switch, from a query string; refuses anything else. */
export function parseFilters(query, now = Date.now()) {
  const period = query.period === undefined || query.period === '' ? 'all' : String(query.period);
  if (!Object.hasOwn(PERIODS, period)) throw new FilterRefused('period must be 7, 30, 90 or all');
  const source = query.source === undefined || query.source === '' ? null : String(query.source);
  if (source !== null && !SOURCES.includes(source)) throw new FilterRefused('source must be invite, own or none');
  const lang = query.lang === undefined || query.lang === '' ? null : String(query.lang);
  if (lang !== null && !/^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{1,8})?$/.test(lang)) throw new FilterRefused('lang is not a language code');
  const days = PERIODS[period];
  return { period, since: days === null ? null : now - days * DAY_MS, source, lang, service: query.service === '1', now };
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
  (!filters.source || person.source.kind === filters.source) && (!filters.lang || person.locale === filters.lang);

export const registeredSince = (person, since) => since === null || (person.createdAt !== null && person.createdAt >= since);

/** The real people these filters select: never a service account. */
export const counted = (people, filters) => [...people.values()].filter((person) => !person.service && matches(person, filters));

/** "YYYY-MM-DD" of an instant in a zone; UTC when the zone is unknown. */
function dateIn(ms, timeZone) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date(ms));
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}

/**
 * Per person: sign-in methods, availability marks, calendar, device, roster
 * answers and rehearsals they created. Six grouped queries; `ids` null — everyone.
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
    conn.all(`SELECT user_id, is_all_day, COUNT(*) AS marks, MIN(created_at) AS first_at, MAX(ends_at) AS last_end
              FROM native_user_availability WHERE source IN (${MARK_SOURCES_SQL}) ${and('user_id')}
              GROUP BY user_id, is_all_day`, params),
    conn.all(`SELECT user_id, COUNT(*) AS calendars FROM native_calendar_connections ${where('user_id')}
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
    if (!facts.has(key)) {
      facts.set(key, { signIn: new Set(), marks: 0, firstMarkAt: null, allDayLastEnd: null, timedLastEnd: null,
        calendar: false, device: false, onRoster: 0, seen: 0, ownRehearsals: 0 });
    }
    return facts.get(key);
  };
  for (const row of providers) of(row.user_id).signIn.add(row.provider_type);
  for (const row of marks) {
    const fact = of(row.user_id);
    fact.marks += count(row.marks);
    const first = toMs(row.first_at);
    if (first !== null && (fact.firstMarkAt === null || first < fact.firstMarkAt)) fact.firstMarkAt = first;
    if (truthy(row.is_all_day)) fact.allDayLastEnd = toMs(row.last_end);
    else fact.timedLastEnd = toMs(row.last_end);
  }
  for (const row of calendars) of(row.user_id).calendar = count(row.calendars) > 0;
  for (const row of devices) of(row.user_id).device = count(row.devices) > 0;
  for (const row of answers) {
    of(row.user_id).onRoster = count(row.on_roster);
    of(row.user_id).seen = count(row.seen);
  }
  for (const row of created) of(row.created_by).ownRehearsals = count(row.rehearsals);
  return facts;
}

export const emptyFacts = () => ({ signIn: new Set(), marks: 0, firstMarkAt: null, allDayLastEnd: null,
  timedLastEnd: null, calendar: false, device: false, onRoster: 0, seen: 0, ownRehearsals: 0 });

/**
 * The last date someone's marks reach. An all-day mark is a calendar date
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
      marks: fact.marks,
      marksUntil: marksUntil(person, fact),
      calendar: fact.calendar,
      device: fact.device,
      seen: fact.seen,
      onRoster: fact.onRoster,
      rehearsals: fact.ownRehearsals,
    },
  };
}
