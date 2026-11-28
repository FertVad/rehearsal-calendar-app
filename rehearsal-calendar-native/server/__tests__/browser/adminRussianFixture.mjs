import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import express from 'express';
import { generateAdminPageHTML } from '../../routes/admin/dashboardPage.js';
import { securityHeaders } from '../../middleware/securityHeaders.js';
import { trackOwnedHttpServer } from './ownedFixture.mjs';

// The real admin document and assets under the production CSP, with synthetic
// API replies for every code the page names (T-419). adminRussian.browser.test.mjs
// reads the page through it; adminRussianShots.mjs photographs it, before and
// after. No database, server.js or .env.
export const ZONE = 'America/New_York';
export const PASSWORD = 't419-fixture-password';
const TOKEN = 't419-synthetic-admin-token';
export const INBOX_TYPES = ['rehearsal_created', 'rehearsal_updated', 'rehearsal_deleted', 'rehearsal_removed',
  'member_response', 'member_joined', 'admin_appointed', 'member_left', 'role_changed', 'member_removed',
  'project_deleted', 'rehearsal_reminder_24h', 'rehearsal_reminder_1h'];

const steps = { onboarding: true, projects: 2, roles: { owner: 1, admin: 0, member: 1 }, manualMarks: 3,
  marksUntil: '2026-09-10', calendarMarks: 2, calendar: true, device: false, seen: 1, onRoster: 2, rehearsals: 1 };
const users = [
  { id: 1, firstName: 'Мария', lastName: 'К.', email: 'maria@example.test', createdAt: '2026-09-10T15:00:00Z',
    lastLoginAt: '2026-09-10T15:00:00Z', service: false, source: { kind: 'invite', project: 'Гамлет', owner: 'Ольга О.' },
    signIn: ['apple', 'google', 'email'], locale: 'ru', timezone: ZONE, steps, lastAppDay: '2026-09-10' },
  { id: 2, firstName: 'Ольга', lastName: 'О.', email: 'olga@example.test', createdAt: '2026-09-01T12:00:00Z',
    lastLoginAt: null, service: false, source: { kind: 'own', project: '«Вишнёвый сад»', owner: null },
    signIn: ['email'], locale: 'en', timezone: 'Europe/Moscow',
    steps: { ...steps, onboarding: false, roles: { owner: 1, admin: 1, member: 0 }, manualMarks: 0, marksUntil: null,
      calendarMarks: 0, calendar: false, device: true }, lastAppDay: null },
  { id: 3, firstName: null, lastName: null, email: 'service@rehearsly.me', createdAt: null, lastLoginAt: null,
    service: true, source: { kind: 'none', project: null, owner: null }, signIn: [], locale: null, timezone: null,
    steps: { ...steps, projects: 0, roles: { owner: 0, admin: 0, member: 0 } }, lastAppDay: null },
];
const counts = { registered: 3, onboarding: 2, project: 2, calendar: 1, manual: 1, engaged: 1 };
const organizerCounts = { registered: 3, project: 2, invite: 2, member: 1, threeMembers: 0, firstRehearsal: 1,
  secondRehearsal: 0 };
export const analytics = {
  period: 'all', from: null, to: '2026-09-11T12:00:00Z', people: 3, languages: ['en', 'ru'],
  funnel: { weeks: [{ week: '2026-09-07', invite: counts, other: counts }], total: { invite: counts, other: counts },
    medians: { invite: { toProjectHours: 2.5, toProjectOf: 12, toCalendarHours: 4, toCalendarOf: 3,
      toManualHours: null, toManualOf: 0 },
      other: { toProjectHours: 30, toProjectOf: 1, toCalendarHours: null, toCalendarOf: 0,
      toManualHours: 0.5, toManualOf: 2 } } },
  // T-427: the organiser funnel.
  organizers: { weeks: [{ week: '2026-09-07', ...organizerCounts }], total: organizerCounts,
    median: { toFirstRehearsalHours: 26.5, toFirstRehearsalOf: 1 } },
  sources: { byDay: [{ date: '2026-09-10', invite: 1, own: 0, none: 0 }], byWeek: [{ date: '2026-09-07', invite: 1, own: 1, none: 0 }],
    projects: [{ project: 'Гамлет', owner: 'Ольга О.', joined: 1, newcomers: 1 }],
    languages: [{ value: 'ru', people: 2 }, { value: null, people: 1 }], timezones: [{ value: ZONE, people: 1 }] },
  usage: { recorded: true, since: '2026-09-10', active: { day: 1, week: 1, month: 2, of: 3 },
    retention: [{ week: '2026-09-07', registered: 2, day1: { opened: 1, of: 2, rate: 50 },
      day7: { opened: 0, of: 0, rate: null }, day30: { opened: 0, of: 0, rate: null } }],
    builds: [{ build: 42, people: 1 }, { build: null, people: 1 }],
    invitations: [{ project: 'Гамлет', owner: 'Ольга О.', pageOpens: 6, appOpens: 3, joins: 2 }] },
  projects: [{ id: 1, name: 'Гамлет', owner: 'Ольга О.', createdAt: '2026-09-10T15:00:00Z', members: 3, rehearsals: 4,
    rehearsalsLastFourWeeks: 2, nextRehearsalAt: '2026-09-12T18:00:00Z',
    seenBeforeStart: { seen: 0, of: 0, rate: null }, coverage: { people: 2, of: 3, rate: 66.7 },
    calendar: { people: 1, of: 3, rate: 33.3 } }],
  notifications: { devices: { people: 1, of: 3, rate: 33.3 },
    // Medians of 30 min, 2.5 h, 1 h and none, in turn; the last type is one the page has no name for.
    inbox: [...INBOX_TYPES, 'future_kind'].map((type, i) => ({ type, created: 2, read: 1, readRate: 40.5,
      medianMinutesToRead: [30, 150, 60, null][i % 4] })),
    emailCodes: ['change', 'confirm', 'reset', 'verify'].map(purpose => ({ purpose, created: 2, sent: 2, failed: 0,
      used: 1, replaced: 0, locked: 0 })) },
};
const stats = { users: { total: 12, newThisWeek: 1, newThisMonth: 3 }, signIns: { rate: 40.5, notInLast30Days: 5 },
  usage: { projects: 2, rehearsals: 4 } };
const reports = [
  { id: 7, name: 'Мария К.', message: 'Не открывается экран', screen: 'Profile', status: 'in_progress', createdAt: '2026-09-10T15:00:00Z' },
  { id: 8, name: 'Ольга О.', message: 'Пропала репетиция', screen: null, status: 'new', createdAt: '2026-09-01T12:00:00Z' },
];

/**
 * Starts the fixture on a free loopback port. `state.plans[key]` holds the next
 * replies of one endpoint ({ status, headers, body } or a held one, see held());
 * an empty queue answers with the data above, a wrong password with adminAuth.js's 401.
 */
export async function startAdminFixture() {
  const state = { plans: { login: [], stats: [], analytics: [], users: [], bugs: [], patch: [] }, held: [] };
  const app = express();
  app.use(securityHeaders);
  app.use(express.json());
  app.use(express.static(fileURLToPath(new URL('../../public', import.meta.url))));
  app.get(['/admin', '/admin/'], (_req, res) => res.type('html').send(generateAdminPageHTML()));
  const reply = (key, normal) => async (req, res) => {
    if (key !== 'login' && req.headers.authorization !== `Bearer ${TOKEN}`) return res.status(401).json({ error: 'Unauthorized' });
    const plan = state.plans[key].shift();
    if (plan?.gate) { plan.arrived(); await plan.gate; }
    if (plan?.headers) res.set(plan.headers);
    if (plan?.status) return res.status(plan.status).json(plan.body ?? {});
    const body = normal(req);
    if (body === null) return res.status(401).json({ error: 'Invalid password' });
    return res.json(body);
  };
  app.post('/admin/api/login', reply('login', req => (req.body.password === PASSWORD ? { token: TOKEN } : null)));
  app.get('/admin/api/stats', reply('stats', () => stats));
  app.get('/admin/api/analytics', reply('analytics', () => analytics));
  app.get('/admin/api/users', reply('users', () => ({ users, total: 40, appDaysRecorded: true })));
  app.get('/admin/api/bug-reports', reply('bugs', () => ({ reports, total: 40 })));
  app.patch('/admin/api/bug-reports/:id/status', reply('patch', () => ({ success: true })));
  const server = createServer(app);
  const owned = trackOwnedHttpServer(server);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { base: `http://127.0.0.1:${server.address().port}`, state, owned };
}

/** A reply that waits until `release()`; `arrival` resolves once the request is in. */
export function held(state, key, plan = {}) {
  let release;
  let arrived;
  const arrival = new Promise(resolve => { arrived = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const entry = { ...plan, gate, release, arrived, arrival };
  state.plans[key].push(entry);
  state.held.push(entry);
  return entry;
}

/** Signs in through the form and waits until every section has drawn its data. */
export async function login(page) {
  await page.locator('#password-input').fill(PASSWORD);
  await page.locator('#login-button').click();
  await page.locator('#dashboard').waitFor({ state: 'visible' });
  await page.locator('#stats-cards .card').first().waitFor();
  await page.locator('#analytics-body .analytics-block').first().waitFor();
  await page.locator('#users-body tr td:nth-child(9)').first().waitFor();
  await page.locator('#bugs-body .status-btn').first().waitFor();
}
