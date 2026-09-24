import assert from 'node:assert/strict';
import http from 'node:http';

// The caller has verified the disposable DB marker. All HTTP and SQL below use
// actual application/adapter code; no authentication or business result mocks.
export async function checkSchemaHttp({ connectionString, control, allowedPorts, schema }) {
  assert.match(schema, /^r[02]_[a-z_]+$/);
  const target = new URL(connectionString);
  assert.equal(target.hostname, '127.0.0.1');
  assert.ok(allowedPorts.has(Number(target.port)));
  target.searchParams.set('options', `-c search_path=${schema} -c timezone=Asia/Jerusalem`);
  const database = await import('../../database/db.js');
  const { createApp } = await import('../../app.js');
  await database.initDatabase({ connectionString: target.href });
  let server;
  let port;
  try {
    server = await new Promise((resolve, reject) => {
      const listener = createApp().listen(0, '127.0.0.1', () => resolve(listener));
      listener.once('error', reject);
    });
    port = server.address().port;
    allowedPorts.add(port);
    const request = (route, { method = 'GET', body, token } = {}) => new Promise((resolve, reject) => {
      const bytes = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
      const req = http.request({ hostname: '127.0.0.1', port, path: route, method,
        headers: { Connection: 'close', 'Content-Type': 'application/json',
          'X-Forwarded-For': '198.51.100.171', ...(bytes ? { 'Content-Length': bytes.length } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}) } }, res => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.once('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }); }
          catch (error) { reject(error); }
        });
        res.once('error', reject);
      });
      req.once('error', reject);
      req.setTimeout(5000, () => req.destroy(new Error('Owned schema HTTP request timed out')));
      req.end(bytes);
    });
    const password = 'schema-fixture-' + 'p'.repeat(18);
    const owner = await request('/api/auth/register', { method: 'POST', body: {
      email: `${schema}-owner@fixture.invalid`, password, firstName: 'Schema owner', timezone: 'UTC',
    } });
    const member = await request('/api/auth/register', { method: 'POST', body: {
      email: `${schema}-member@fixture.invalid`, password, firstName: 'Schema member', timezone: 'UTC',
    } });
    assert.equal(owner.status, 200); assert.equal(member.status, 200);
    const login = await request('/api/auth/login', { method: 'POST', body: {
      email: `${schema}-owner@fixture.invalid`, password,
    } });
    assert.equal(login.status, 200);
    const token = login.body.accessToken;
    const ownerId = owner.body.user.id;
    const memberId = member.body.user.id;
    assert.equal((await request('/api/auth/me', { token })).body.user.id, ownerId);

    const project = await request('/api/native/projects', { method: 'POST', token, body: { name: 'Schema project' } });
    assert.equal(project.status, 201);
    const projectId = project.body.project.id;
    await control.query(`INSERT INTO ${schema}.native_project_members(user_id,project_id,role,status)
      VALUES($1,$2,'member','active')`, [memberId, projectId]);
    const members = await request(`/api/native/projects/${projectId}/members`, { token });
    assert.equal(members.status, 200);
    const rehearsal = await request(`/api/native/projects/${projectId}/rehearsals`, { method: 'POST', token, body: {
      title: 'Schema rehearsal', startsAt: '2031-03-28T10:00:00Z', endsAt: '2031-03-28T11:00:00Z',
      participant_ids: [ownerId, memberId],
    } });
    assert.equal(rehearsal.status, 201);
    const rehearsalRow = (await control.query(`SELECT id,starts_at,ends_at FROM ${schema}.native_rehearsals
      WHERE project_id=$1`, [projectId])).rows[0];
    assert.equal(rehearsalRow.starts_at.toISOString(), '2031-03-28T10:00:00.000Z');
    assert.equal(rehearsalRow.ends_at.toISOString(), '2031-03-28T11:00:00.000Z');
    assert.equal(Number((await control.query(`SELECT count(*) FROM ${schema}.native_rehearsal_responses
      WHERE rehearsal_id=$1`, [rehearsalRow.id])).rows[0].count), 2);

    const manual = await request('/api/native/availability/bulk', { method: 'POST', token, body: { entries: [
      { startsAt: '2031-03-29T10:00:00Z', endsAt: '2031-03-29T11:00:00Z', type: 'busy' },
      { startsAt: '2031-03-29T12:00:00Z', endsAt: '2031-03-29T13:00:00Z', type: 'busy' },
    ] } });
    assert.equal(manual.status, 200);
    const entry = { startsAt: '2031-03-30T10:00:00Z', endsAt: '2031-03-30T11:00:00Z', type: 'busy',
      source: 'apple_calendar', external_event_id: 'r2-owned-import' };
    for (let n = 0; n < 2; n++) assert.equal((await request('/api/native/availability/bulk', {
      method: 'POST', token, body: { entries: [entry, entry] },
    })).status, 200);
    const slots = await request('/api/native/availability', { token });
    assert.equal(slots.status, 200);
    assert.equal(slots.body.filter(slot => slot.externalEventId === entry.external_event_id).length, 1);
    assert.equal(Number((await control.query(`SELECT count(*) FROM ${schema}.native_user_availability
      WHERE user_id=$1 AND source='manual' AND external_event_id IS NULL`, [ownerId])).rows[0].count), 2);

    const inbox = await request('/api/native/notifications', { token: member.body.accessToken });
    assert.equal(inbox.status, 200);
    assert.ok(inbox.body.notifications.length > 0);
    assert.ok(inbox.body.unreadCount > 0);
    assert.equal((await request('/api/native/notifications/read', { method: 'POST', token: member.body.accessToken,
      body: {} })).body.unreadCount, 0);
    await control.query(`INSERT INTO ${schema}.native_push_reminders(rehearsal_id,user_id,reminder_type,sent_at)
      VALUES($1,$2,'24h',NOW()),($1,$3,'24h',NOW()) ON CONFLICT(rehearsal_id,user_id,reminder_type) DO NOTHING`,
    [rehearsalRow.id, ownerId, memberId]);
    assert.equal(Number((await control.query(`SELECT count(*) FROM ${schema}.native_push_reminders
      WHERE rehearsal_id=$1`, [rehearsalRow.id])).rows[0].count), 2);

    const connection = await request('/api/native/calendar-sync/connections', { method: 'POST', token, body: {
      provider: 'apple', deviceCalendarId: 'owned-calendar', deviceCalendarName: 'Owned',
    } });
    assert.equal(connection.status, 200);
    const mapping = await request('/api/native/calendar-sync/mappings', { method: 'POST', token, body: {
      connectionId: connection.body.connection.id, eventType: 'rehearsal', internalEventId: rehearsalRow.id,
      externalEventId: 'owned-mapping',
    } });
    assert.equal(mapping.status, 200);
    assert.equal((await request('/api/native/calendar-sync/mappings', { token })).body.mappings.length, 1);
    const bug = await request('/api/native/bug-reports', { method: 'POST', token, body: { message: 'Owned schema fixture', screen: 'test' } });
    assert.equal(bug.status, 200);
    const admin = await request('/admin/api/login', { method: 'POST', body: { password: process.env.ADMIN_PASSWORD } });
    assert.equal(admin.status, 200);
    const bugs = await request('/admin/api/bug-reports', { token: admin.body.token });
    assert.equal(bugs.status, 200);
    assert.ok(bugs.body.reports.some(report => report.id === bug.body.data.id));

    // Wider route coverage on the same canonical schema: every table and the
    // constraints the routes lean on (week-start CHECK, response CHECK, FK
    // cascades), with the rows read back rather than trusting status codes.
    const profile = await request('/api/auth/me', { method: 'PUT', token, body: { weekStartDay: 'sunday', lastName: '  Owner  ' } });
    assert.equal(profile.status, 200);
    assert.deepEqual((await control.query(`SELECT week_start_day,last_name FROM ${schema}.native_users WHERE id=$1`, [ownerId])).rows,
      [{ week_start_day: 'sunday', last_name: 'Owner' }]);
    const invite = await request(`/api/native/projects/${projectId}/invite`, { method: 'POST', token, body: {} });
    assert.equal(invite.status, 200);
    const joiner = await request('/api/auth/register', { method: 'POST', body: {
      email: `${schema}-joiner@fixture.invalid`, password, firstName: 'Schema joiner', timezone: 'UTC',
    } });
    assert.equal(joiner.status, 200);
    const joinerId = joiner.body.user.id;
    assert.equal((await request(`/api/native/invite/${invite.body.inviteCode}/join`, { method: 'POST',
      token: joiner.body.accessToken, body: {} })).status, 200);
    assert.equal(Number((await control.query(`SELECT count(*) FROM ${schema}.native_project_members
      WHERE project_id=$1 AND user_id=$2 AND status='active'`, [projectId, joinerId])).rows[0].count), 1);
    assert.equal((await request(`/api/native/rehearsals/${rehearsalRow.id}/respond`, { method: 'POST',
      token: member.body.accessToken, body: { response: 'yes' } })).status, 200);
    assert.equal((await control.query(`SELECT response FROM ${schema}.native_rehearsal_responses
      WHERE rehearsal_id=$1 AND user_id=$2`, [rehearsalRow.id, memberId])).rows[0].response, 'yes');
    const planner = await request(`/api/native/projects/${projectId}/members/availability?startDate=2031-03-28&endDate=2031-03-30`, { token });
    assert.equal(planner.status, 200);
    const answers = async () => (await control.query(`SELECT user_id,response FROM ${schema}.native_rehearsal_responses
      WHERE rehearsal_id=$1 ORDER BY user_id`, [rehearsalRow.id])).rows.map(row => [row.user_id, row.response]);
    const answered = await answers();
    const moved = await request(`/api/native/projects/${projectId}/rehearsals/${rehearsalRow.id}`, { method: 'PUT', token, body: {
      startsAt: '2031-03-28T12:00:00Z', endsAt: '2031-03-28T13:30:00Z', participant_ids: [ownerId, memberId, joinerId],
    } });
    assert.equal(moved.status, 200);
    // Existing answers survive the edit; the newcomer is invited-not-seen.
    assert.deepEqual(await answers(), [...answered, [joinerId, 'no']]);
    assert.equal((await control.query(`SELECT starts_at FROM ${schema}.native_rehearsals WHERE id=$1`,
      [rehearsalRow.id])).rows[0].starts_at.toISOString(), '2031-03-28T12:00:00.000Z');
    for (const route of ['/admin/api/stats', '/admin/api/users']) {
      assert.equal((await request(route, { token: admin.body.token })).status, 200, route);
    }
    assert.equal((await request(`/api/native/projects/${projectId}/members/${joinerId}`, { method: 'DELETE', token })).status, 200);
    assert.equal(Number((await control.query(`SELECT count(*) FROM ${schema}.native_rehearsal_responses
      WHERE user_id=$1`, [joinerId])).rows[0].count), 0);
    assert.equal((await request('/api/auth/me', { method: 'DELETE', token: joiner.body.accessToken })).status, 200);
    assert.equal(Number((await control.query(`SELECT count(*) FROM ${schema}.native_users WHERE id=$1`, [joinerId])).rows[0].count), 0);
    assert.equal((await request(`/api/native/projects/${projectId}/rehearsals/${rehearsalRow.id}`, { method: 'DELETE', token })).status, 200);
    assert.equal(Number((await control.query(`SELECT
      (SELECT count(*) FROM ${schema}.native_rehearsals WHERE id=$1) +
      (SELECT count(*) FROM ${schema}.native_rehearsal_responses WHERE rehearsal_id=$1) +
      (SELECT count(*) FROM ${schema}.native_push_reminders WHERE rehearsal_id=$1) AS count`, [rehearsalRow.id])).rows[0].count), 0);

    // Register only after all notification-producing actions. This exercises
    // the real upsert without enabling a push transport or reminder scheduler.
    const deviceToken = 'ExponentPushToken[' + 'r'.repeat(22) + ']';
    for (let n = 0; n < 2; n++) assert.equal((await request('/api/native/push-tokens', { method: 'POST', token,
      body: { deviceToken, deviceType: 'ios', deviceName: 'Owned fixture' } })).status, 200);
    assert.equal(Number((await control.query(`SELECT count(*) FROM ${schema}.native_push_tokens WHERE user_id=$1`, [ownerId])).rows[0].count), 1);
    return { schema, actualHttp: ['password register/login/profile', 'project/member/rehearsal',
      'manual and imported availability bulk', 'notification inbox/read', 'calendar connection/mapping',
      'bug report/admin read', 'profile week-start update', 'invite create/join', 'rehearsal respond',
      'member availability planner', 'rehearsal update keeps answers', 'admin stats/users', 'member removal',
      'account deletion', 'rehearsal deletion cascade', 'push token upsert'],
    actualSql: ['two distinct reminder recipients'], nonUtcInstants: true };
  } finally {
    if (server) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => server.closeAllConnections(), 2000);
        server.close(error => { clearTimeout(timer); error ? reject(error) : resolve(); });
        server.closeIdleConnections();
      });
    }
    if (port) allowedPorts.delete(port);
    await database.closeDatabase();
  }
}
