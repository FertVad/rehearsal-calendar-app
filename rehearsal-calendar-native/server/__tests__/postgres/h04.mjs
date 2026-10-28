import assert from 'node:assert/strict';

// The caller owns a disposable PostgreSQL database, real createApp listener and
// production PG adapter. All observations use an independent SQL connection.
export async function probeH04({ control, db, http }) {
  // Deliberately synthetic diagnostic schema, not a production migration.
  await control.query(`CREATE TABLE native_bug_reports (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES native_users(id),
    message TEXT NOT NULL, screen TEXT,
    status TEXT NOT NULL CHECK (status IN ('new', 'in_progress', 'fixed')),
    created_at TIMESTAMPTZ NOT NULL
  );
  INSERT INTO native_bug_reports VALUES
    (1, 1, 'H04 first report', 'Calendar', 'new', '2030-09-17T12:00:00Z'),
    (2, 2, 'H04 unrelated report', NULL, 'in_progress', '2030-09-16T12:00:00Z'),
    (2147483647, 1, 'H04 int4 boundary', NULL, 'new', '2030-09-15T12:00:00Z')`);
  const snapshot = async () => {
    const data = {};
    for (const table of ['native_users', 'native_projects', 'native_project_members', 'native_rehearsals',
      'native_rehearsal_responses', 'native_user_availability', 'native_push_tokens',
      'native_notifications', 'r0_transaction_probe', 'native_bug_reports']) {
      data[table] = (await control.query(`SELECT * FROM ${table} ORDER BY id`)).rows;
    }
    return data;
  };
  const beforeLogin = await snapshot();
  const login = await http('/admin/api/login', {
    method: 'POST', token: null, body: { password: process.env.ADMIN_PASSWORD },
  });
  assert.equal(login.status, 200);
  assert.equal(typeof login.data.token, 'string');
  assert.ok(login.data.token.length > 0);
  assert.deepEqual(await snapshot(), beforeLogin);

  const calls = [];
  const originals = new Map();
  for (const method of ['get', 'all', 'run']) {
    const original = db[method];
    originals.set(method, original);
    db[method] = async function (sql, params) {
      calls.push({ method, sql });
      return original.call(this, sql, params);
    };
  }
  const patch = (id, body = { status: 'fixed' }, token = login.data.token) =>
    http(`/admin/api/bug-reports/${encodeURIComponent(id)}/status`, { method: 'PATCH', token, body });
  const assertFailure = response => {
    assert.equal(response.status, 500);
    assert.deepEqual(response.data, { error: 'Failed to update status' });
  };
  try {
    const beforeInvalid = await snapshot();
    for (const token of [null, 'invalid']) {
      assert.equal((await patch('1x', { status: 'wrong' }, token)).status, 401);
      assert.equal((await patch('1', { status: 'fixed' }, token)).status, 401);
    }
    // A real non-admin user JWT must not authorize this route either.
    assert.equal((await http('/admin/api/bug-reports/1/status', {
      method: 'PATCH', body: { status: 'fixed' },
    })).status, 401);
    for (const id of ['0', '-1', '1x', '1.5', '1e0', '01', '+1', ' 1', '1 ', '2147483648', '9007199254740993']) {
      assert.equal((await patch(id)).status, 400, `Malformed ID ${id} must return 400`);
    }
    for (const body of [null, [], {}, { status: null }, { status: false }, { status: 1 },
      { status: ['fixed'] }, { status: {} }, { status: '' }, { status: 'FIXED' }, { status: 'fixed ' }]) {
      assert.equal((await patch('1', body)).status, 400, 'Malformed status/body must return 400');
    }
    assert.deepEqual(calls, [], 'Authentication/input rejection must precede all database work');
    assert.deepEqual(await snapshot(), beforeInvalid, 'Rejected requests must preserve every business row');

    const missing = await patch('999');
    assert.equal(missing.status, 404);
    assert.deepEqual(missing.data, { error: 'Bug report not found' });
    assert.deepEqual(await snapshot(), beforeInvalid);

    for (const [id, status] of [[1, 'in_progress'], [1, 'fixed'], [1, 'fixed'], [1, 'new'], [2147483647, 'fixed']]) {
      const expected = await snapshot();
      expected.native_bug_reports.find(row => row.id === id).status = status;
      const response = await patch(String(id), { status });
      assert.equal(response.status, 200);
      assert.deepEqual(response.data, { success: true });
      assert.deepEqual(await snapshot(), expected, 'Only the selected report status may change');
    }

    const listed = await http('/admin/api/bug-reports', { token: login.data.token });
    assert.equal(listed.status, 200);
    assert.ok(listed.data.reports.some(row => row.id === 2));
    await control.query('DELETE FROM native_bug_reports WHERE id = 2');
    const beforeDeleted = await snapshot();
    assert.equal((await patch('2')).status, 404, 'A report deleted after listing must not claim success');
    assert.deepEqual(await snapshot(), beforeDeleted);

    // This real trigger makes a side write and then fails the UPDATE. PostgreSQL
    // must roll back the whole statement, including that trigger's side effect.
    await control.query(`CREATE FUNCTION h04_reject_status() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        INSERT INTO r0_transaction_probe(value) VALUES ('H04 must roll back');
        RAISE EXCEPTION 'H04_INTERNAL_STORAGE_DETAIL';
      END $$;
      CREATE TRIGGER h04_reject_status BEFORE UPDATE ON native_bug_reports
        FOR EACH ROW EXECUTE FUNCTION h04_reject_status()`);
    const beforeFault = await snapshot();
    try {
      assertFailure(await patch('1'));
      assert.equal((await http('/api/health')).status, 200);
      assert.deepEqual(await snapshot(), beforeFault, 'Failed UPDATE and trigger writes must roll back');
    } finally {
      await control.query('DROP TRIGGER h04_reject_status ON native_bug_reports; DROP FUNCTION h04_reject_status()');
    }
    await control.query('ALTER TABLE native_bug_reports RENAME TO h04_reports_unavailable');
    try {
      assertFailure(await patch('1'));
      assert.equal((await http('/api/health')).status, 200);
    } finally {
      await control.query('ALTER TABLE h04_reports_unavailable RENAME TO native_bug_reports');
    }
    assert.deepEqual(await snapshot(), beforeFault, 'Storage failure must preserve every business row');
    assert.deepEqual((await patch('1')).data, { success: true }, 'Traffic must recover after storage restoration');
    beforeFault.native_bug_reports.find(row => row.id === 1).status = 'fixed';
    assert.deepEqual(await snapshot(), beforeFault);
    return { outcome: 'PASS', contracts: [
      'real admin login and authentication before database work',
      'positive int4 IDs and enum statuses: malformed400 without SQL or writes',
      'missing/deleted reports404; real UPDATE RETURNING changes only selected status',
      'all statuses and repeated status200; largest positive int4 ID supported',
      'trigger side writes roll back; unavailable table500; generic errors and health survive',
      'independent all-business-row snapshots and successful storage recovery',
    ] };
  } finally {
    for (const [method, original] of originals) db[method] = original;
  }
}
