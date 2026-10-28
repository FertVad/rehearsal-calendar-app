import assert from 'node:assert/strict';

const endpoint = '/api/native/projects/1/members/availability';
const rateTable = 'native_member_availability_rate_limits';

// This module receives the real application, adapter and owned PostgreSQL
// fixture from probe.mjs. No SQL dialect translation or limiter mocks apply.
export async function probeB03({ control, db, http, listenApp, allowedPorts }) {
  const calls = [];
  const originals = new Map();
  for (const method of ['get', 'all']) {
    const original = db[method];
    originals.set(method, original);
    db[method] = async function (sql, params = []) {
      const call = { method, sql, params: [...params] };
      calls.push(call);
      const rows = await original.call(this, sql, params);
      call.rows = Array.isArray(rows) ? rows.length : Number(Boolean(rows));
      return rows;
    };
  }
  const request = (query = 'date=2030-09-17', options) => http(`${endpoint}?${query}`, options);
  const resetRate = () => control.query(`DELETE FROM ${rateTable}`);
  const rateRows = async () => (await control.query(`SELECT * FROM ${rateTable} ORDER BY user_id`)).rows;
  const snapshot = async () => {
    const data = {};
    for (const table of ['native_users', 'native_projects', 'native_project_members', 'native_rehearsals',
      'native_rehearsal_responses', 'native_user_availability', 'native_push_tokens',
      'native_notifications', 'r0_transaction_probe']) {
      data[table] = (await control.query(`SELECT * FROM ${table} ORDER BY id`)).rows;
    }
    return data;
  };
  const noBusinessRead = (since, message) => assert.equal(calls.slice(since).some(call =>
    /FROM\s+native_user_availability\b/i.test(call.sql) ||
    /SELECT\s+(?:DISTINCT\s+)?user_id\s+FROM\s+native_project_members/i.test(call.sql)), false, message);
  const assertBudget = response => {
    assert.equal(response.status, 422, JSON.stringify(response.data));
    assert.equal(response.data.code, 'AVAILABILITY_BUDGET_EXCEEDED');
    assert.equal(typeof response.data.error, 'string');
    assert.equal(Object.hasOwn(response.data, 'availability'), false, 'Never return partial availability as success');
    assert.deepEqual(Object.keys(response.data).sort(), ['code', 'error']);
  };
  const assertSentinel = (since, table, sentinel) => {
    const query = calls.slice(since).find(call =>
      new RegExp(`FROM\\s+${table}\\b`, 'i').test(call.sql) && call.rows === sentinel);
    assert.ok(query, `Real ${table} query must return exactly the ${sentinel}-row sentinel`);
    const limit = /\bLIMIT\s+(?:\$(\d+)|(\d+))/i.exec(query.sql);
    assert.ok(limit, `SQL must bound ${table} rows before materialization`);
    assert.equal(Number(limit[1] ? query.params[Number(limit[1]) - 1] : limit[2]), sentinel);
  };
  const insertBusy = (startsAt, endsAt, { allDay = false, source = 'manual', externalId = null, user = 2 } = {}) =>
    control.query(`INSERT INTO native_user_availability
      (user_id, starts_at, ends_at, type, source, external_event_id, is_all_day)
      VALUES ($1, $2, $3, 'busy', $4, $5, $6)`, [user, startsAt, endsAt, source, externalId, allDay]);
  let secondServer;
  try {
    // Authentication precedes all parsing, and malformed input cannot charge
    // the shared rate table or issue a business-data query.
    const beforeInvalid = await snapshot();
    let since = calls.length;
    assert.equal((await request('date=not-a-date', { token: 'invalid' })).status, 401);
    noBusinessRead(since, 'Unauthenticated input cannot reach business data');
    const malformed = [
      '', 'date=', 'date=2030-02-30', 'date=1900-02-29', 'date=2030-13-01', 'date=2030-1-01',
      'date=0000-01-01', 'date=10000-01-01', 'date=2030-09-17T00%3A00%3A00Z',
      'date=2030-09-17&date=2030-09-18', 'date[x]=2030-09-17',
      'startDate=2030-09-17', 'endDate=2030-09-17',
      'startDate=2030-09-18&endDate=2030-09-17',
      'startDate=0001-01-01&endDate=9999-12-31',
      'startDate=2030-01-01&endDate=2030-04-01',
      'startDate=2030-02-30&endDate=2030-03-03',
      'startDate[x]=2030-09-17&endDate=2030-09-18',
      'startDate=2030-09-17&endDate=2030-09-18&endDate=2030-09-19',
      'date=2030-09-17&startDate=2030-09-17&endDate=2030-09-18',
      ...['', '0', '-1', '1.5', '2x', '2147483648', '9007199254740993', '2,,3', '2,', '2&userIds=3']
        .map(ids => `date=2030-09-17&userIds=${ids}`),
      `date=2030-09-17&userIds=${Array.from({ length: 101 }, (_, i) => i + 1).join(',')}`,
      'date=2030-09-17&userIds[x]=2',
      'date=2030-09-17&excludeRehearsalId=0',
      'date=2030-09-17&excludeRehearsalId=1x',
      'date=2030-09-17&excludeRehearsalId=2147483648',
      'date=2030-09-17&excludeRehearsalId=1&excludeRehearsalId=2',
    ];
    for (const query of malformed) {
      since = calls.length;
      const response = await request(query);
      assert.equal(response.status, 400, `Invalid query must finish as 400: ${query}`);
      assert.equal(Object.hasOwn(response.data, 'availability'), false);
      noBusinessRead(since, `Malformed query must not reach business reads: ${query}`);
      assert.equal((await http('/api/health')).status, 200, 'Health must respond after each malformed/huge range');
    }
    for (const projectId of ['0', '-1', '1x', '2147483648', '9007199254740993']) {
      assert.equal((await http(`/api/native/projects/${projectId}/members/availability?date=2030-09-17`)).status, 400);
    }
    assert.deepEqual(await rateRows(), [], 'Rejected syntax must not consume a rate budget');
    assert.deepEqual(await snapshot(), beforeInvalid, 'Malformed and unauthenticated reads must not change application rows');

    since = calls.length;
    const outsider = await request('startDate=2030-01-01&endDate=2030-03-31', { user: 3 });
    assert.equal(outsider.status, 403);
    noBusinessRead(since, 'A project outsider must be rejected before business reads');
    await control.query("UPDATE native_project_members SET status = 'inactive' WHERE user_id = 2");
    try { assert.equal((await request(undefined, { user: 2 })).status, 403); }
    finally { await control.query("UPDATE native_project_members SET status = 'active' WHERE user_id = 2"); }
    assert.deepEqual(await rateRows(), [], 'Unauthorized membership must not consume a rate budget');
    assert.deepEqual(await snapshot(), beforeInvalid);

    for (const query of ['date=0001-01-01', 'date=0099-12-31', 'date=2000-02-29',
      'date=9999-12-31', 'startDate=9999-12-30&endDate=9999-12-31',
      'startDate=2030-01-01&endDate=2030-03-31']) {
      assert.equal((await request(query)).status, 200, `Valid bounded date must work: ${query}`);
    }
    const subset = await request('date=2030-09-17&userIds=2,2,3');
    assert.equal(subset.status, 200);
    assert.deepEqual(subset.data.availability.map(row => row.userId), ['2']);
    assert.equal(Object.hasOwn(subset.data.availability[0], 'email'), false);
    assert.deepEqual((await request('date=2030-09-17&userIds=3')).data, { availability: [] });

    // PostgreSQL timestamps can extend past the API's calendar-year boundary.
    // A projected endpoint in year 10000 must still cover requested year 9999.
    const lastSupportedDay = [{ date: '9999-12-31', timeRanges: [
      { start: '00:00', end: '23:59', type: 'busy', isAllDay: false },
    ] }];
    await control.query("UPDATE native_users SET timezone = 'Pacific/Kiritimati' WHERE id = 1");
    await insertBusy('9999-12-30T09:00:00Z', '9999-12-31T11:00:00Z');
    const crossesYear = await request('date=9999-12-31&userIds=2');
    assert.equal(crossesYear.status, 200);
    assert.deepEqual(crossesYear.data.availability[0].dates, lastSupportedDay);
    await control.query('DELETE FROM native_user_availability');
    await control.query("UPDATE native_users SET timezone = 'UTC' WHERE id = 1");
    // PostgreSQL's wire value becomes +010000-01-01T00:00:00.000Z in pg's Date.
    await insertBusy('9999-12-30T00:00:00Z', '10000-01-01 00:00:00+00', { allDay: true });
    const allDayCrossesYear = await request('date=9999-12-31&userIds=2');
    assert.equal(allDayCrossesYear.status, 200);
    assert.deepEqual(allDayCrossesYear.data.availability[0].dates, [{
      date: '9999-12-31', timeRanges: [{ start: '00:00', end: '23:59', type: 'busy', isAllDay: true }],
    }]);
    await control.query('DELETE FROM native_user_availability');

    // Real TIMESTAMPTZ rows must keep the requester's clock, all-day calendar
    // dates, historical hasData and cross-midnight clipping unchanged.
    await control.query("UPDATE native_users SET timezone = 'Asia/Tokyo' WHERE id = 1");
    await insertBusy('2030-09-17T13:00:00Z', '2030-09-17T16:00:00Z', { source: 'rehearsal', externalId: '777' });
    await insertBusy('2030-09-18T00:00:00Z', '2030-09-18T23:59:59Z', { allDay: true });
    const normal = await request('startDate=2030-09-17&endDate=2030-09-19');
    assert.equal(normal.status, 200);
    assert.deepEqual(normal.data.availability.find(row => row.userId === '2'), {
      userId: '2', firstName: 'Member', lastName: null, hasData: true,
      dates: [
        { date: '2030-09-17', timeRanges: [{ start: '22:00', end: '23:59', type: 'busy', isAllDay: false }] },
        { date: '2030-09-18', timeRanges: [
          { start: '00:00', end: '01:00', type: 'busy', isAllDay: false },
          { start: '00:00', end: '23:59', type: 'busy', isAllDay: true },
        ] },
      ],
    });
    const excluded = await request('startDate=2030-09-17&endDate=2030-09-19&excludeRehearsalId=777');
    assert.equal(excluded.status, 200);
    assert.deepEqual(excluded.data.availability.find(row => row.userId === '2').dates, [
      { date: '2030-09-18', timeRanges: [{ start: '00:00', end: '23:59', type: 'busy', isAllDay: true }] },
    ]);
    const outsideWindow = await request('date=2030-10-01&userIds=2');
    assert.equal(outsideWindow.status, 200);
    assert.equal(outsideWindow.data.availability[0].hasData, true);
    assert.deepEqual(outsideWindow.data.availability[0].dates, []);
    await control.query('DELETE FROM native_user_availability');
    await control.query("UPDATE native_users SET timezone = 'UTC' WHERE id = 1");

    // Populate more members than the cap: the roster query must use LIMIT 101
    // itself, not fetch the entire project and only then reject it in JS.
    await control.query(`INSERT INTO native_users(id, email, first_name)
      SELECT id, 'b03-' || id || '@r0.invalid', 'B03 member' FROM generate_series(4, 103) AS id`);
    await control.query(`INSERT INTO native_project_members(project_id, user_id)
      SELECT 1, id FROM native_users WHERE id >= 4`);
    since = calls.length;
    assertBudget(await request());
    assertSentinel(since, 'native_project_members', 101);
    const smallSubset = await request('date=2030-09-17&userIds=2');
    assert.equal(smallSubset.status, 200, 'An explicit bounded subset can be read from a large project');
    assert.deepEqual(smallSubset.data.availability.map(row => row.userId), ['2']);
    await control.query('DELETE FROM native_users WHERE id >= 102');
    const atMemberDays = await request('startDate=2030-01-01&endDate=2030-01-31');
    assert.equal(atMemberDays.status, 200, '100 members times 31 days is within the member-day budget');
    assert.equal(atMemberDays.data.availability.length, 100);
    assertBudget(await request('startDate=2030-01-01&endDate=2030-02-01'));
    // Each field stays inside its character guard; together their actual UTF8
    // representation exceeds 1MiB even though the JS string length does not.
    await control.query("UPDATE native_users SET first_name = repeat('界', 4000) WHERE id >= 4");
    assertBudget(await request());
    await control.query('DELETE FROM native_users WHERE id >= 4');

    await control.query(`INSERT INTO native_user_availability(user_id, starts_at, ends_at, type, source)
      SELECT 2, '2030-09-17T12:00:00Z'::timestamptz, '2030-09-17T13:00:00Z'::timestamptz,
      'busy', 'manual' FROM generate_series(1, 6000)`);
    since = calls.length;
    assertBudget(await request());
    assertSentinel(since, 'native_user_availability', 5001);
    await control.query(`DELETE FROM native_user_availability
      WHERE id IN (SELECT id FROM native_user_availability ORDER BY id DESC LIMIT 1000)`);
    const atRecords = await request('date=2030-09-17&userIds=2');
    assert.equal(atRecords.status, 200, 'Exactly 5000 in-window records remain supported');
    assert.equal(atRecords.data.availability[0].dates[0].timeRanges.length, 5000);
    await control.query('DELETE FROM native_user_availability');

    await control.query(`INSERT INTO native_user_availability(user_id, starts_at, ends_at, type, source, is_all_day)
      SELECT 2, '2030-01-01T00:00:00Z'::timestamptz, '2030-03-31T23:59:59Z'::timestamptz,
      'busy', 'manual', TRUE FROM generate_series(1, 225)`);
    assertBudget(await request('startDate=2030-01-01&endDate=2030-03-31&userIds=2'));
    await control.query('DELETE FROM native_user_availability');
    await control.query("UPDATE native_users SET first_name = repeat('界', 400000) WHERE id = 2");
    try { assertBudget(await request('date=2030-09-17&userIds=2')); }
    finally { await control.query("UPDATE native_users SET first_name = 'Member' WHERE id = 2"); }

    // Sharing a DB across two real HTTP app instances must also share the
    // budget. If this short burst happens to cross a DB minute boundary, retry
    // from an empty fixture counter, without waiting or changing the clock.
    await resetRate();
    secondServer = await listenApp();
    const secondBase = `http://127.0.0.1:${secondServer.address().port}`;
    let burst;
    let afterBurst;
    let exhaustedCalls;
    let otherUser;
    let otherUserCount;
    let expired;
    let expiredCount;
    let stableWindow = false;
    for (let attempt = 0; attempt < 3 && !stableWindow; attempt++) {
      await resetRate();
      const minuteBefore = (await control.query("SELECT FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) / 60) AS minute")).rows[0].minute;
      burst = await Promise.all(Array.from({ length: 70 }, (_, index) =>
        request(undefined, index % 2 ? { baseUrl: secondBase } : undefined)));
      since = calls.length;
      afterBurst = await request(undefined, { baseUrl: secondBase });
      exhaustedCalls = calls.slice(since);
      otherUser = await request(undefined, { user: 2, baseUrl: secondBase });
      otherUserCount = (await control.query(`SELECT request_count FROM ${rateTable} WHERE user_id = 2`)).rows[0].request_count;
      await control.query(`UPDATE ${rateTable} SET window_start = window_start - 60 WHERE user_id = 1`);
      expired = await request();
      expiredCount = (await control.query(`SELECT request_count FROM ${rateTable} WHERE user_id = 1`)).rows[0].request_count;
      const minuteAfter = (await control.query("SELECT FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) / 60) AS minute")).rows[0].minute;
      stableWindow = minuteBefore === minuteAfter;
    }
    assert.ok(stableWindow, 'A concurrent burst must finish within one database minute');
    assert.equal(burst.filter(response => response.status === 200).length, 60, 'Exactly 60 calls shared by both instances may pass');
    assert.equal(burst.filter(response => response.status === 429).length, 10);
    for (const response of burst.filter(response => response.status === 429)) {
      assert.match(response.headers.get('retry-after') || '', /^\d+$/);
      assert.ok(Number(response.headers.get('retry-after')) >= 1 && Number(response.headers.get('retry-after')) <= 60);
      assert.equal(Object.hasOwn(response.data, 'availability'), false);
    }
    assert.equal(afterBurst.status, 429);
    assert.equal(exhaustedCalls.some(call => /FROM\s+native_user_availability\b|SELECT\s+DISTINCT\s+user_id\s+FROM\s+native_project_members/i.test(call.sql)), false,
      'Exhausted shared rate budget must stop before business queries');
    assert.equal(otherUser.status, 200, 'Another user has an independent budget');
    assert.equal(otherUserCount, 1);
    assert.equal(expired.status, 200, 'An expired fixture window recovers immediately, without sleeping');
    assert.equal(expiredCount, 1);

    const beforeStorageFault = await snapshot();
    await control.query(`ALTER TABLE ${rateTable} RENAME TO b03_rate_storage_unavailable`);
    try {
      since = calls.length;
      const unavailable = await request();
      assert.equal(unavailable.status, 503, 'Missing shared rate storage must fail closed');
      assert.equal(typeof unavailable.data.error, 'string');
      assert.equal(Object.hasOwn(unavailable.data, 'availability'), false);
      assert.ok(!JSON.stringify(unavailable.data).includes(rateTable), 'Do not leak SQL storage details');
      noBusinessRead(since, 'Unavailable limiter must stop before business queries');
      assert.equal((await http('/api/health')).status, 200);
    } finally {
      await control.query(`ALTER TABLE b03_rate_storage_unavailable RENAME TO ${rateTable}`);
    }
    assert.deepEqual(await snapshot(), beforeStorageFault, 'Rate-storage outage must not alter business rows');
    assert.equal((await request()).status, 200, 'Traffic recovers when shared storage is restored');
    assert.deepEqual(await snapshot(), beforeStorageFault);

    return { outcome: 'PASS', contracts: [
      'actual additive migration applied twice to an isolated owned fixture',
      'auth first; strict scalar/calendar/date-range400; huge range then health200',
      'active membership403 before business reads and shared-rate consumption',
      'real TIMESTAMPTZ timezone/midnight/all-day/exclusion/hasData200; outsider intersection',
      'timezone and all-day projections crossing into year10000 preserve busy time in requested year9999',
      '100-member and 3100-member-day boundaries; real SQL101-row roster sentinel',
      'real SQL5001-row record sentinel; 5000-record200; expanded-range and UTF8-byte422 without partial data',
      'two HTTP app instances share exactly60 admissions;429+Retry-After; another user independent',
      'expired shared window reset without wait; missing limiter storage503, health200 and recovery',
      'no business row changes during invalid input, denied access or limiter storage failures',
    ] };
  } finally {
    for (const [method, original] of originals) db[method] = original;
    if (secondServer) {
      const port = secondServer.address().port;
      await new Promise(resolve => secondServer.close(resolve));
      allowedPorts.delete(port);
    }
  }
}
