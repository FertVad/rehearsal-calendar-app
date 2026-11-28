import assert from 'node:assert/strict';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { manifest, inspectSchema } from '../../database/schema/manifest.mjs';
import { loadArtifacts, runMigrations } from '../../database/migrations/core.mjs';

// The admin statistics on PostgreSQL (T-293): the grouped queries, the roster
// reads and the 14-day window run on the canonical schema, through the real
// app and admin login — booleans, timestamptz and bigint counts as PostgreSQL
// returns them. The SQLite route test (adminAnalytics.test.js) has the same
// people; here times run from the real now.
export async function probeT293Admin({ connectionString, control, allowedPorts }) {
  const artifacts = await loadArtifacts(manifest, fileURLToPath(new URL('../../', import.meta.url)));
  assert.equal((await runMigrations({ connectionString, schema: 'r0_fixture', request: { mode: 'fresh' },
    artifacts, inspectSchema })).outcome, 'applied');
  const database = await import('../../database/db.js');
  const { createApp } = await import('../../app.js');
  await database.initDatabase({ connectionString });
  const server = await new Promise((resolve, reject) => {
    const listener = createApp().listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  allowedPorts.add(server.address().port);
  process.env.ADMIN_SERVICE_EMAILS = 'listed@example.test';
  const contracts = [];

  const call = (method, path, { token, body } = {}) => new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, method, path,
      headers: { Connection: 'close', ...(payload ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}) } }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; });
      res.once('end', () => resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }));
    });
    req.once('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error(`T-293 ${path} timed out`)));
    req.end(payload);
  });

  const q = (sql, params) => control.query(sql, params);
  const NOW = Date.now();
  const H = 3600000;
  const D = 24 * H;
  const at = (ms) => new Date(ms).toISOString();
  const ago = (ms) => at(NOW - ms);
  const today = new Date(NOW);
  const firstDate = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const date = (ms) => at(ms).slice(0, 10);

  try {
    const people = [
      [1, 'olga@example.test', 'Olga', 'Owner', ago(20 * D), 'ru', 'America/Mazatlan', true, null],
      [2, 'ivan@example.test', 'Ivan', 'Invitee', ago(10 * D), 'en', 'Europe/Berlin', true, null],
      [3, 'anna@example.test', 'Anna', 'Admin', ago(9 * D), 'en', 'UTC', false, null],
      [4, 'loner@example.test', 'Lone', 'Ranger', ago(3 * D), 'es', 'UTC', false, null],
      [5, 'left@example.test', 'Leo', 'Left', ago(8 * D), 'en', 'UTC', true, 'hash'],
      [6, 'removed@example.test', 'Rem', 'Oved', ago(60 * D), 'en', 'UTC', true, null],
      [7, 'old@example.test', 'Otto', 'Old', ago(200 * D), 'de', 'UTC', true, null],
      [8, 'demo@rehearsly.me', 'Demo', 'Director', ago(30 * D), 'en', 'UTC', true, null],
      [9, 'maria@demo.rehearsly.me', 'Maria', 'Kovacs', ago(5 * D), 'en', 'UTC', true, null],
      [10, 'listed@example.test', 'Lena', 'Service', ago(100 * D), 'ru', 'UTC', true, null],
    ];
    for (const row of people) {
      await q(`INSERT INTO native_users (id, email, first_name, last_name, created_at, locale, timezone,
        onboarding_completed, password_hash) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, row);
    }
    for (const [user, type] of [[1, 'apple'], [2, 'google'], [3, 'apple'], [3, 'email'], [4, 'email']]) {
      await q(`INSERT INTO native_auth_providers (user_id, provider_type, provider_user_id, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())`, [user, type, `${type}-${user}`]);
    }
    for (const row of [[1, 'Hamlet', ago(20 * D)], [2, 'Second', ago(5 * D)], [3, 'Demo Hamlet', ago(30 * D)],
      [4, "Owner's troupe", ago(150 * D)]]) {
      await q('INSERT INTO native_projects (id, name, created_at) VALUES ($1, $2, $3)', row);
    }
    for (const row of [[1, 1, 'owner', ago(20 * D - H)], [2, 1, 'member', ago(10 * D - 3 * H)],
      [3, 1, 'admin', ago(9 * D - H)], [3, 2, 'owner', ago(5 * D)], [9, 1, 'member', ago(4 * D)],
      [8, 3, 'owner', ago(30 * D)], [9, 3, 'member', ago(5 * D)], [10, 4, 'owner', ago(150 * D)],
      [7, 4, 'member', ago(100 * D)]]) {
      await q(`INSERT INTO native_project_members (user_id, project_id, role, status, joined_at, created_at)
        VALUES ($1, $2, $3, 'active', $4, $4)`, row);
    }
    for (const row of [[1, 1, ago(2 * D), 1], [3, 1, at(NOW + 3 * D), 1], [4, 1, ago(1 * D), 3],
      [5, 3, ago(3 * D), 8], [6, 4, ago(50 * D), 10]]) {
      await q(`INSERT INTO native_rehearsals (id, project_id, starts_at, ends_at, created_by)
        VALUES ($1, $2, $3::timestamptz, $3::timestamptz + INTERVAL '2 hours', $4)`, row);
    }
    for (const row of [[1, 1, 'yes', ago(3 * D)], [1, 2, 'yes', ago(2 * D + H)], [1, 3, 'no', ago(4 * D)],
      [1, 6, 'yes', ago(3 * D)], [4, 3, 'yes', ago(12 * H)], [3, 2, 'yes', ago(1 * D)]]) {
      await q(`INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $4)`, row);
    }
    const timedEnd = firstDate + 20 * D + 3 * H; // the day before in Mazatlán (UTC-7)
    for (const row of [
      [1, at(firstDate + 13 * D), at(firstDate + 14 * D - 1), true, 'manual', ago(20 * D - 2 * H)],
      [1, at(timedEnd - 2 * H), at(timedEnd), false, 'manual', ago(19 * D)],
      [2, at(firstDate + 14 * D), at(firstDate + 15 * D - 1), true, 'manual', ago(10 * D - 5 * H)],
      [2, ago(2 * D), ago(2 * D - H), false, 'manual', ago(9 * D)],
      [2, at(NOW + D), at(NOW + D + 2 * H), false, 'rehearsal', ago(1 * D)],
      [3, at(NOW + 2 * H), at(NOW + 3 * H), false, 'apple_calendar', ago(9 * D - 4 * H)],
      [9, at(NOW + 2 * H), at(NOW + 3 * H), false, 'manual', ago(1 * D)],
    ]) {
      await q(`INSERT INTO native_user_availability (user_id, starts_at, ends_at, is_all_day, source, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)`, row);
    }
    await q(`INSERT INTO native_calendar_connections (user_id, provider, device_calendar_id) VALUES (3, 'apple', 'cal-3')`);
    for (const user of [1, 9]) {
      await q(`INSERT INTO native_push_tokens (user_id, device_token, last_active_at) VALUES ($1, $2, NOW())`,
        [user, `ExponentPushToken[t293-${user}]`]);
    }
    for (const row of [[1, 'member_joined', ago(10 * D), ago(10 * D - 30 * 60000)], [1, 'member_joined', ago(9 * D), null],
      [2, 'rehearsal_created', ago(4 * D), ago(4 * D - 60 * 60000)], [9, 'rehearsal_created', ago(4 * D), ago(4 * D - 1000)],
      [1, 'member_joined', ago(40 * D), null]]) {
      await q(`INSERT INTO native_notifications (user_id, type, title, created_at, read_at) VALUES ($1, $2, 'T', $3, $4)`, row);
    }
    const hash = 'a'.repeat(64);
    for (const row of [
      [1, 4, 'verify', 0, ago(3 * D - 120000), ago(3 * D), null, ago(3 * D)],
      [2, 4, 'verify', 1, ago(3 * D - 300000), ago(3 * D - 120000), null, ago(3 * D - 120000)],
      [3, 4, 'reset', 0, null, null, ago(2 * D), ago(2 * D)],
      [4, 5, 'reset', 5, ago(7 * D), ago(8 * D), null, ago(8 * D)],
      [5, 9, 'verify', 0, ago(1 * D), ago(1 * D), null, ago(1 * D)],
    ]) {
      await q(`INSERT INTO native_email_codes (id, user_id, purpose, attempts, consumed_at, sent_at, failed_at, created_at,
        email, code_hash, expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'x@example.test', $9, NOW())`, [...row, hash]);
    }

    for (const path of ['/admin/api/stats', '/admin/api/users', '/admin/api/analytics']) {
      assert.equal((await call('GET', path)).status, 401, `${path} without a token`);
    }
    const login = await call('POST', '/admin/api/login', { body: { password: process.env.ADMIN_PASSWORD } });
    assert.equal(login.status, 200);
    const token = login.body.token;
    const get = async (path) => {
      const response = await call('GET', path, { token });
      assert.equal(response.status, 200, path);
      return response.body;
    };
    contracts.push('the three statistics routes refuse without the admin token');

    const stats = await get('/admin/api/stats');
    assert.deepEqual(stats, { users: { total: 7, newThisWeek: 1, newThisMonth: 5 },
      signIns: { notInLast30Days: 2, rate: 28.6 }, usage: { projects: 3, rehearsals: 4 } });
    contracts.push('cards: service accounts (both domains, ADMIN_SERVICE_EMAILS) and demo-owned projects count nowhere');

    const users = Object.fromEntries((await get('/admin/api/users?service=1')).users.map((user) => [user.email, user]));
    assert.equal(Object.keys(users).length, 10);
    assert.deepEqual(users['olga@example.test'].source, { kind: 'own', project: 'Hamlet', owner: null });
    assert.deepEqual(users['ivan@example.test'].source, { kind: 'invite', project: 'Hamlet', owner: 'Olga O.' });
    assert.deepEqual(users['anna@example.test'].source, { kind: 'invite', project: 'Hamlet', owner: 'Olga O.' });
    assert.deepEqual(users['removed@example.test'].source, { kind: 'none', project: null, owner: null });
    assert.deepEqual(users['olga@example.test'].steps, { onboarding: true, projects: 1,
      roles: { owner: 1, admin: 0, member: 0 }, manualMarks: 2, marksUntil: date(timedEnd - D), calendarMarks: 0,
      calendar: false,
      device: true, seen: 1, onRoster: 1, rehearsals: 2 });
    assert.deepEqual(users['anna@example.test'].signIn, ['apple', 'email']);
    assert.deepEqual(users['left@example.test'].signIn, ['email']);
    assert.equal(users['maria@demo.rehearsly.me'].service, true);
    contracts.push('users: source from the earliest active membership, steps and sign-in methods, service accounts marked');

    const month = await get('/admin/api/analytics?period=30');
    assert.deepEqual(month.funnel.total, {
      invite: { registered: 2, onboarding: 1, project: 2, calendar: 1, manual: 1, engaged: 2 },
      other: { registered: 3, onboarding: 2, project: 1, calendar: 0, manual: 1, engaged: 1 } });
    assert.deepEqual(month.funnel.medians, {
      // T-426: Anna's import 4 h after registering (her export record is from now), Ivan's first hand mark 5 h.
      invite: { toProjectHours: 2, toProjectOf: 2, toCalendarHours: 4, toCalendarOf: 1, toManualHours: 5, toManualOf: 1 },
      other: { toProjectHours: 1, toProjectOf: 1, toCalendarHours: null, toCalendarOf: 0, toManualHours: 2, toManualOf: 1 } });
    assert.deepEqual(month.sources.projects, [{ project: 'Hamlet', owner: 'Olga O.', joined: 2, newcomers: 2 }]);
    contracts.push('funnel and medians (the calendar connected apart from hand marks), and the projects that brought people, on PostgreSQL types');

    // T-427: Olga owns Hamlet — Ivan and Anna in it (Maria is a service
    // account), her two rehearsals; Anna owns Second, empty, and her rehearsal
    // is in Olga's project. Olga's first rehearsal: 6 h after registering.
    await q('UPDATE native_rehearsals SET created_at = $1 WHERE id = 1', [ago(20 * D - 6 * H)]);
    const organizers = (await get('/admin/api/analytics?period=30')).organizers;
    assert.deepEqual(organizers.total, { registered: 5, project: 2, invite: 1, member: 1, threeMembers: 0,
      firstRehearsal: 1, secondRehearsal: 1 });
    assert.deepEqual(organizers.median, { toFirstRehearsalHours: 6, toFirstRehearsalOf: 1 });
    contracts.push('organiser funnel: own projects, members in one project without service accounts, own rehearsals ranked by ROW_NUMBER');

    const hamlet = month.projects.find((project) => project.name === 'Hamlet');
    assert.deepEqual(hamlet.seenBeforeStart, { seen: 2, of: 4, rate: 50 });
    assert.deepEqual(hamlet.coverage, { people: 2, of: 3, rate: 66.7 });
    assert.deepEqual(hamlet.calendar, { people: 1, of: 3, rate: 33.3 });
    assert.equal(hamlet.rehearsalsLastFourWeeks, 2);
    assert.equal(hamlet.nextRehearsalAt, at(NOW + 3 * D));
    assert.ok(!month.projects.some((project) => project.name === 'Demo Hamlet'));
    contracts.push('seen before start through ROSTER (the removed member counts nowhere); coverage stops at the 14th UTC date; calendar connected by member');

    assert.deepEqual(month.notifications.devices, { people: 1, of: 5, rate: 20 });
    assert.deepEqual(month.notifications.inbox, [
      { type: 'member_joined', created: 2, read: 1, readRate: 50, medianMinutesToRead: 30 },
      { type: 'rehearsal_created', created: 1, read: 1, readRate: 100, medianMinutesToRead: 60 }]);
    assert.deepEqual(month.notifications.emailCodes, [
      { purpose: 'reset', created: 2, sent: 1, failed: 1, used: 0, replaced: 0, locked: 1 },
      { purpose: 'verify', created: 2, sent: 2, failed: 0, used: 1, replaced: 1, locked: 0 }]);
    assert.doesNotMatch(JSON.stringify(month), /@/);
    contracts.push('inbox by type with median to read, email codes by purpose; no address in the summaries');

    // An all-day stretch from a calendar that began before today: one that
    // ended yesterday is behind, one still going covers Ivan.
    const coverage = async () => (await get('/admin/api/analytics')).projects
      .find((project) => project.name === 'Hamlet').coverage;
    const stretch = (endsAt) => q(`INSERT INTO native_user_availability (user_id, starts_at, ends_at, is_all_day, source, created_at)
      VALUES (2, $1, $2, TRUE, 'google_calendar', $3)`, [at(firstDate - 5 * D), endsAt, ago(1 * D)]);
    await stretch(at(firstDate - 1));
    assert.deepEqual(await coverage(), { people: 2, of: 3, rate: 66.7 });
    await stretch(at(firstDate + 6 * D - 1));
    assert.deepEqual(await coverage(), { people: 3, of: 3, rate: 100 });
    contracts.push('coverage counts an all-day stretch begun before today and not yet over, not one that ended yesterday');

    // T-295: calendar sync used, either way. Ivan now has busy times imported
    // from a calendar and no export record; Leo gets an export record only.
    await q('DELETE FROM native_calendar_connections WHERE user_id = 3');
    await q(`INSERT INTO native_calendar_connections (user_id, provider, device_calendar_id) VALUES (5, 'apple', 'cal-5')`);
    const calendar = Object.fromEntries((await get('/admin/api/users')).users.map((user) => [user.email, user.steps.calendar]));
    assert.deepEqual([calendar['ivan@example.test'], calendar['anna@example.test'], calendar['left@example.test'],
      calendar['olga@example.test'], calendar['loner@example.test']], [true, true, true, false, false]);
    assert.ok(!('maria@demo.rehearsly.me' in calendar));
    contracts.push('calendar sync used: an import from a calendar or an export record; neither — no');

    // T-426: hand marks apart from marks from a calendar; a weekend busy by default is neither.
    await q(`INSERT INTO native_user_availability (user_id, starts_at, ends_at, is_all_day, source, created_at)
      VALUES (4, $1, $2, TRUE, 'weekend', $3)`, [at(firstDate + 3 * D), at(firstDate + 4 * D - 1), ago(1 * D)]);
    const split = Object.fromEntries((await get('/admin/api/users')).users.map(({ email, steps }) =>
      [email, [steps.manualMarks, steps.calendarMarks, steps.marksUntil, steps.calendar]]));
    assert.deepEqual(split['ivan@example.test'], [2, 2, date(firstDate + 14 * D), true]);
    assert.deepEqual(split['loner@example.test'], [0, 0, null, false]);
    contracts.push('users: hand marks with their last date apart from marks from a calendar; weekends neither');

    // T-425: dates bound every section from both ends, on timestamptz and on
    // 016's date column; the test cohort is own + none. 9 to 2 days ago, UTC.
    await q(`INSERT INTO native_notifications (user_id, type, title, created_at) VALUES (2, 'member_left', 'T', $1)`,
      [at(firstDate - D + H)]);
    for (const [day, opens] of [[date(firstDate - 5 * D), 3], [date(firstDate - D), 7]]) {
      await q('INSERT INTO native_invite_counts (project_id, day, page_opens, app_opens, joins) VALUES (1, $1, $2, 0, 0)', [day, opens]);
    }
    const dates = `from=${date(firstDate - 9 * D)}&to=${date(firstDate - 2 * D)}`;
    const dated = await get(`/admin/api/analytics?${dates}`);
    assert.equal(dated.period, 'dates');
    assert.deepEqual(dated.notifications.inbox.map((row) => [row.type, row.created]),
      [['member_joined', 1], ['rehearsal_created', 1]]);
    assert.deepEqual(dated.usage.invitations.map((row) => [row.project, row.pageOpens]), [['Hamlet', 3]]);
    const cohort = (await get(`/admin/api/analytics?${dates}&cohort=1`)).cohort;
    assert.equal(cohort.recorded, true);
    assert.deepEqual(cohort.test, { from: date(firstDate - 9 * D), to: date(firstDate - 2 * D), days: 8, registered: 2,
      perDay: 0.3, onboarding: { count: 1, of: 2, rate: 50 }, project: { count: 0, of: 1, rate: 0 },
      ...Object.fromEntries(['invite', 'member', 'threeMembers', 'firstRehearsal', 'secondRehearsal']
        .map((step) => [step, { count: 0, of: 0, rate: null }])),
      inProject: { count: 0, of: 1, rate: 0 }, calendar: { count: 0, of: 1, rate: 0 },
      manual: { count: 0, of: 1, rate: 0 }, day1: null, day7: null });
    assert.equal(cohort.before.registered, 0);
    const refused = await call('GET', '/admin/api/analytics?from=0001-01-01&to=9999-12-31&cohort=1', { token });
    assert.deepEqual([refused.status, refused.body.code], [400, 'DATES_TOO_LONG']);
    contracts.push('dates bound inbox and invitation counts from both ends; the test cohort counts own + none; a huge range is 400');
  } finally {
    delete process.env.ADMIN_SERVICE_EMAILS;
    await new Promise((resolve) => { server.close(() => resolve()); server.closeAllConnections(); });
    await database.closeDatabase();
  }
  return { outcome: 'PASS', contracts };
}
