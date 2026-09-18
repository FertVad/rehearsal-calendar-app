import assert from 'node:assert/strict';

const ipTable = 'native_invite_ip_rate_limits';
const accountTable = 'native_invite_account_rate_limits';
const gateTable = 'native_invite_ip_rate_limit_gate';
const shortCode = 'K7M3XQ2P';
const legacyCode = 'abcdef0123456789abcdef0123456789';
const missingCode = 'ZZZZZZZZ';
const previewPath = code => `/api/native/invite/${code}`;
const joinPath = (code, legacy = false) => `/api/native/${legacy ? 'projects' : 'invite'}/${code}/join`;

// Real PostgreSQL and the real application, including authentication and
// notification persistence. probe.mjs blocks every non-fixture connection.
export async function probeB04({ control, db, http, listenApp, allowedPorts }) {
  const calls = [];
  const originals = new Map();
  const observe = (target, method, original) => async function (sql, params = []) {
    calls.push({ method, sql, params: [...params] });
    return original.call(target, sql, params);
  };
  for (const method of ['get', 'all', 'run']) {
    originals.set(method, db[method]);
    db[method] = observe(db, method, db[method]);
  }
  originals.set('transaction', db.transaction);
  db.transaction = fn => originals.get('transaction').call(db, scoped => fn(Object.fromEntries(
    ['get', 'all', 'run'].map(method => [method, observe(scoped, method, scoped[method])]),
  )));

  const snapshot = async () => {
    const result = {};
    for (const table of ['native_users', 'native_projects', 'native_project_members', 'native_rehearsals',
      'native_rehearsal_responses', 'native_user_availability', 'native_push_tokens',
      'native_notifications', 'r0_transaction_probe']) {
      result[table] = (await control.query(`SELECT * FROM ${table} ORDER BY id`)).rows;
    }
    return result;
  };
  const resetRate = async () => {
    await control.query(`DELETE FROM ${ipTable}; DELETE FROM ${accountTable}; UPDATE ${gateTable} SET key_count = 0`);
  };
  const noBusinessRead = since => assert.equal(calls.slice(since).some(({ sql }) =>
    /\b(?:native_projects|native_project_members|native_notifications|native_push_tokens)\b/i.test(sql)), false,
  'Denied redemption must stop before invite lookup, membership reads/writes and notification work');
  const assertDenied = (response, status) => {
    assert.equal(response.status, status, JSON.stringify(response.data));
    assert.equal(typeof response.data.error, 'string');
    assert.equal(Object.hasOwn(response.data, 'projectName'), false);
    assert.ok(!JSON.stringify(response.data).includes('native_invite_'), 'No SQL storage details in error');
    if (status === 429) {
      assert.match(response.headers.get('retry-after') || '', /^\d+$/);
      const seconds = Number(response.headers.get('retry-after'));
      assert.ok(seconds >= 1 && seconds <= 60, 'Retry-After must describe the database window');
    }
  };
  const minute = async () => (await control.query(
    'SELECT FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) / 60) AS minute',
  )).rows[0].minute;
  const withinMinute = async exercise => {
    // This is a fixed DB-clock window. Retry a boundary-crossing burst using
    // only owned fixture counters, without waiting or substituting a clock.
    for (let attempt = 0; attempt < 3; attempt++) {
      await resetRate();
      const before = await minute();
      try {
        const outcome = await exercise();
        if (before === await minute()) return outcome;
      } catch (error) {
        if (before === await minute()) throw error;
      }
    }
    assert.fail('B04 burst must complete within one database minute');
  };
  const rowCount = async table => Number((await control.query(`SELECT COUNT(*) AS count FROM ${table}`)).rows[0].count);
  const assertGate = async () => {
    const count = await rowCount(ipTable);
    assert.ok(count <= 10000, 'Untrusted IP key storage must stay bounded');
    assert.equal((await control.query(`SELECT key_count FROM ${gateTable} WHERE id = 1`)).rows[0].key_count, count);
    return count;
  };
  const setCode = async (code, expired = false) => control.query(
    `UPDATE native_projects SET invite_code = $1,
      invite_expires_at = NOW() + ($2::integer * INTERVAL '1 day') WHERE id = 1`, [code, expired ? -1 : 1],
  );
  const miss = options => http(previewPath(missingCode), { token: null, ...options });
  const join = (code, options = {}) => {
    const { legacy = false, ...requestOptions } = options;
    return http(joinPath(code, legacy), { method: 'POST', user: 3, ...requestOptions });
  };
  let secondServer;
  try {
    secondServer = await listenApp();
    const secondBase = `http://127.0.0.1:${secondServer.address().port}`;

    // Authentication failure still spends the shared IP budget, but cannot
    // create an account-key row or reach project/member data.
    await resetRate();
    let before = await snapshot();
    for (const legacy of [false, true]) {
      for (const token of [null, 'invalid']) {
        const since = calls.length;
        assertDenied(await join(missingCode, { legacy, token, ip: '192.0.2.1' }), 401);
        noBusinessRead(since);
      }
    }
    assert.equal(await rowCount(accountTable), 0, 'Unauthenticated traffic cannot allocate account keys');
    assert.equal(await rowCount(ipTable), 1);
    assert.deepEqual(await snapshot(), before);

    // The strict code guard preserves a missing-invite 404, after both rate
    // stages. Arbitrary and oversized strings cannot trigger invite SQL.
    const malformed = ['abc', 'k7m3xq2p', 'ABCDEFG0', 'G'.repeat(32), 'A'.repeat(33), 'A'.repeat(512)];
    const malformedBurst = await withinMinute(async () => {
      const responses = [];
      for (const code of malformed) {
        for (const method of ['preview', 'join', 'legacy']) {
          const since = calls.length;
          responses.push(method === 'preview'
            ? await http(previewPath(code), { token: null, ip: '192.0.2.2' })
            : await join(code, { ip: '192.0.2.2', legacy: method === 'legacy' }));
          noBusinessRead(since);
        }
      }
      for (let index = 0; index < 2; index++) responses.push(await http(previewPath('invalid'), { ip: '192.0.2.2' }));
      const since = calls.length;
      const denied = await miss({ ip: '192.0.2.2' });
      noBusinessRead(since);
      return { responses, denied };
    });
    assert.deepEqual(malformedBurst.responses.map(response => response.status), Array(20).fill(404));
    assertDenied(malformedBurst.denied, 429);
    assert.deepEqual(await snapshot(), before, 'Malformed codes cannot change business data');

    // Old codes retain exact-match semantics; neither case nor length may be
    // silently normalized by the redemption route split.
    for (const code of [shortCode, legacyCode]) {
      await resetRate();
      await setCode(code);
      const preview = await http(previewPath(code), { token: null });
      assert.equal(preview.status, 200);
      assert.equal(preview.data.projectId, '1');
      assert.equal(preview.data.projectName, 'R0 seeded project');
      assert.equal((await http(previewPath(code === shortCode ? code.toLowerCase() : code.toUpperCase()), { token: null })).status, 404);
      await setCode(code, true);
      before = await snapshot();
      assert.equal((await http(previewPath(code), { token: null })).status, 410);
      assert.equal((await join(code)).status, 410);
      assert.equal((await join(code, { legacy: true })).status, 410);
      assert.deepEqual(await snapshot(), before, 'Expired invites cannot create membership or notifications');
    }
    await setCode(shortCode);
    await resetRate();
    assert.equal((await join(shortCode)).status, 200, 'Canonical join creates a real membership');
    const membership = (await control.query('SELECT * FROM native_project_members WHERE project_id = 1 AND user_id = 3')).rows[0];
    assert.equal(membership.role, 'member');
    assert.equal(membership.status, 'active');
    assert.equal(await rowCount('native_notifications'), 1, 'Joining records one owner inbox notification');
    before = await snapshot();
    assert.equal((await join(shortCode, { legacy: true })).status, 400, 'Legacy join preserves already-member result');
    assert.deepEqual(await snapshot(), before);
    await control.query("UPDATE native_project_members SET status = 'inactive' WHERE id = $1", [membership.id]);
    await setCode(legacyCode);
    assert.equal((await join(legacyCode, { legacy: true })).status, 200, 'Legacy URL and legacy code reactivate membership');
    const reactivated = (await control.query('SELECT * FROM native_project_members WHERE project_id = 1 AND user_id = 3')).rows[0];
    assert.equal(reactivated.id, membership.id);
    assert.equal(reactivated.status, 'active');
    assert.equal(await rowCount('native_notifications'), 2);
    assert.equal(await rowCount('native_push_tokens'), 0, 'Real notification transport has no external destinations');

    // Prefix rotation and code rotation cannot create a second IP budget.
    before = await snapshot();
    const mixed = await withinMinute(async () => {
      const responses = [];
      for (let index = 0; index < 21; index++) {
        const options = { ip: '192.0.2.10', ...(index % 2 ? { baseUrl: secondBase } : {}) };
        responses.push(index % 3 === 0 ? await miss(options)
          : await join(index % 2 ? missingCode : 'YYYYYYYY', { ...options, legacy: index % 3 === 2 }));
      }
      const since = calls.length;
      const denied = await join(shortCode, { ip: '192.0.2.10', legacy: true });
      noBusinessRead(since);
      return { responses, denied };
    });
    assert.deepEqual(mixed.responses.slice(0, 20).map(row => row.status), Array(20).fill(404));
    assertDenied(mixed.responses[20], 429);
    assertDenied(mixed.denied, 429);
    assert.deepEqual(await snapshot(), before, 'Exhausted IP requests cannot change any business row');

    const concurrentIp = await withinMinute(async () => Promise.all(Array.from({ length: 30 }, (_, index) =>
      index % 2 ? miss({ ip: '192.0.2.11', baseUrl: secondBase })
        : join(missingCode, { ip: '192.0.2.11', legacy: index % 4 === 0 }))));
    assert.equal(concurrentIp.filter(response => response.status === 404).length, 20);
    assert.equal(concurrentIp.filter(response => response.status === 429).length, 10);
    concurrentIp.filter(response => response.status === 429).forEach(response => assertDenied(response, 429));
    assert.deepEqual(await snapshot(), before);

    // The account budget survives IP changes and crosses both real app
    // instances; another authenticated account has an independent budget.
    const accountBurst = await withinMinute(async () => {
      const responses = await Promise.all(Array.from({ length: 25 }, (_, index) => join(missingCode, {
        ip: `198.51.100.${index + 1}`, legacy: index % 2 === 0,
        ...(index % 2 ? { baseUrl: secondBase } : {}),
      })));
      const since = calls.length;
      const denied = await join(legacyCode, { ip: '198.51.100.99', legacy: true, baseUrl: secondBase });
      noBusinessRead(since);
      const independent = await join(missingCode, { user: 2, ip: '198.51.100.100' });
      return { responses, denied, independent };
    });
    assert.equal(accountBurst.responses.filter(response => response.status === 404).length, 20);
    assert.equal(accountBurst.responses.filter(response => response.status === 429).length, 5);
    assertDenied(accountBurst.denied, 429);
    assert.equal(accountBurst.independent.status, 404);
    assert.equal((await control.query(`SELECT request_count FROM ${accountTable} WHERE user_id = 2`)).rows[0].request_count, 1);
    assert.deepEqual(await snapshot(), before, 'Account rejection cannot write membership or notification rows');

    const headBurst = await withinMinute(async () => {
      const responses = [];
      for (let index = 0; index < 20; index++) responses.push(await miss({ method: 'HEAD', ip: '203.0.113.10' }));
      const since = calls.length;
      const denied = await miss({ ip: '203.0.113.10', baseUrl: secondBase });
      noBusinessRead(since);
      return { responses, denied };
    });
    assert.deepEqual(headBurst.responses.map(response => response.status), Array(20).fill(404));
    assert.ok(headBurst.responses.every(response => response.data === ''), 'HEAD has no response body');
    assertDenied(headBurst.denied, 429);

    // Mapping an IPv4 address into IPv6 must not yield a fresh key.
    const mapped = await withinMinute(async () => {
      for (let index = 0; index < 20; index++) await miss({ ip: '192.0.2.25' });
      return miss({ ip: '::ffff:192.0.2.25', baseUrl: secondBase });
    });
    assertDenied(mapped, 429);

    const ipv6 = await withinMinute(async () => {
      for (let index = 0; index < 20; index++) await miss({ ip: '2001:db8:12ab:cd00::1' });
      return {
        sameSubnet: await miss({ ip: '2001:db8:12ab:cdff::2', baseUrl: secondBase }),
        otherSubnet: await miss({ ip: '2001:db8:12ab:ce00::1' }),
      };
    });
    assertDenied(ipv6.sameSubnet, 429);
    assert.equal(ipv6.otherSubnet.status, 404);

    // Owner management remains usable even when redemption is exhausted,
    // through the canonical route and the explicit old management alias.
    const exhaustedIp = '2001:db8:12ab:cd00::1';
    for (const prefix of ['/api/native/projects', '/api/native/invite']) {
      const path = `${prefix}/1/invite`;
      assert.equal((await http(path, { method: 'DELETE', ip: exhaustedIp })).status, 200);
      assert.deepEqual((await http(path, { ip: exhaustedIp })).data, { invite: null });
      const created = await http(path, { method: 'POST', ip: exhaustedIp, body: { expiresInDays: 7 } });
      assert.equal(created.status, 200);
      assert.match(created.data.inviteCode, /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$/);
      assert.equal((await http(path)).data.invite.inviteCode, created.data.inviteCode);
      assert.equal((await http(path, { user: 2, method: 'POST', body: {} })).status, 403);
      assert.equal((await http(path, { user: 2, method: 'DELETE' })).status, 403);
      assert.equal((await http(path, { user: 2 })).status, 403);
    }
    assert.equal((await http('/api/native/projects/1', { token: null })).status, 401);
    assert.equal((await http('/api/native/projects/1')).status, 200);
    let since = calls.length;
    const html = await http(`/invite/${shortCode}`, { token: null, ip: exhaustedIp });
    assert.equal(html.status, 200);
    assert.match(html.headers.get('content-type'), /text\/html/);
    assert.match(html.data, /rehearsalapp:\/\/invite\//);
    assert.equal(calls.length, since, 'Public deep-link HTML performs no database operations');

    // Expired rows are reusable immediately with the database clock.
    await resetRate();
    await join(missingCode, { ip: '192.0.2.40' });
    await control.query(`UPDATE ${ipTable} SET window_start = window_start - 60, request_count = 21;
      UPDATE ${accountTable} SET window_start = window_start - 60, request_count = 21`);
    assert.equal((await join(missingCode, { ip: '192.0.2.40', baseUrl: secondBase })).status, 404);
    assert.equal((await control.query(`SELECT request_count FROM ${ipTable}`)).rows[0].request_count, 1);
    assert.equal((await control.query(`SELECT request_count FROM ${accountTable}`)).rows[0].request_count, 1);

    // Force the precise PostgreSQL READ COMMITTED race: DELETE selects an
    // expired version, then waits behind an uncommitted refresh of that row.
    // pg_blocking_pids proves the pruning statement is waiting before commit;
    // timing alone is never treated as evidence that the race happened.
    before = await snapshot();
    await withinMinute(async () => {
      assert.equal((await miss({ ip: '198.51.100.150' })).status, 404);
      const candidate = (await control.query(`SELECT ip_key FROM ${ipTable}`)).rows[0].ip_key;
      await control.query(`UPDATE ${ipTable} SET window_start = window_start - 60 WHERE ip_key = $1`, [candidate]);
      const refreshPid = (await control.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      let transactionOpen = false;
      let allocation;
      try {
        await control.query('BEGIN');
        transactionOpen = true;
        await control.query("SET LOCAL statement_timeout = '2000ms'; SET LOCAL lock_timeout = '1500ms'");
        const refreshed = (await control.query(`UPDATE ${ipTable}
          SET window_start = FLOOR(EXTRACT(EPOCH FROM statement_timestamp()) / 60)::bigint * 60,
              request_count = 7
          WHERE ip_key = $1 RETURNING ip_key, window_start, request_count`, [candidate])).rows[0];
        // Catch immediately so strict unhandled-rejection mode remains safe
        // even if HTTP's independent timeout fires while the lock is held.
        allocation = miss({ ip: '198.51.100.151', baseUrl: secondBase })
          .then(response => ({ response }), error => ({ error }));
        const deadline = performance.now() + 1500;
        let blockedPruner;
        do {
          await control.query('SELECT pg_stat_clear_snapshot()');
          blockedPruner = (await control.query(`SELECT pid FROM pg_stat_activity
            WHERE datname = current_database() AND pid <> pg_backend_pid()
              AND $1::integer = ANY(pg_blocking_pids(pid))
              AND wait_event_type = 'Lock' AND query LIKE $2`,
          [refreshPid, `%DELETE FROM ${ipTable}%`])).rows[0];
          if (!blockedPruner) await new Promise(resolve => setTimeout(resolve, 10));
        } while (!blockedPruner && performance.now() < deadline);
        assert.ok(blockedPruner, 'Real pruning DELETE must wait on the independently refreshed expired row');
        assert.notEqual(blockedPruner.pid, refreshPid);
        await control.query('COMMIT');
        transactionOpen = false;
        const outcome = await allocation;
        if (outcome.error) throw outcome.error;
        assert.equal(outcome.response.status, 404);
        assert.deepEqual((await control.query(`SELECT ip_key, window_start, request_count
          FROM ${ipTable} WHERE ip_key = $1`, [candidate])).rows[0], refreshed,
        'Pruning must preserve a candidate refreshed while DELETE waited; removing the outer expiry predicate loses it');
        assert.equal(await assertGate(), 2, 'Refreshed key and new key must both be counted');
        assert.equal((await miss({ ip: '198.51.100.150' })).status, 404);
        assert.equal((await control.query(`SELECT request_count FROM ${ipTable} WHERE ip_key = $1`, [candidate])).rows[0].request_count, 8,
          'The original key must continue its preserved budget, not be allocated again');
        assert.equal(await assertGate(), 2);
      } finally {
        // Release the row lock on every assertion/HTTP failure and settle the
        // waiter before fixture resets or app shutdown can touch its rows.
        if (transactionOpen) await control.query('ROLLBACK');
        if (allocation) await allocation;
      }
    });
    assert.deepEqual(await snapshot(), before, 'Refresh/prune interleaving changes no business data');

    // Fill untrusted-key storage using real SQL. A saturated store fails
    // closed for new keys, never evicts active keys, and permits existing keys.
    before = await snapshot();
    const capacity = await withinMinute(async () => {
      assert.equal((await miss({ ip: '203.0.113.40' })).status, 404);
      await control.query(`INSERT INTO ${ipTable}(ip_key, window_start, request_count)
        SELECT LPAD(TO_HEX(id), 64, '0'), FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) / 60)::bigint * 60, 1
        FROM generate_series(1, 9999) AS id`);
      await control.query(`UPDATE ${gateTable} SET key_count = 10000 WHERE id = 1`);
      const retained = await miss({ ip: '203.0.113.40' });
      since = calls.length;
      const saturated = await miss({ ip: '203.0.113.41', baseUrl: secondBase });
      noBusinessRead(since);
      const fullCount = await assertGate();
      // Expire more rows than one prune batch. A single request may prune at
      // most 64, and recovery must be request driven, without a scheduled job.
      await control.query(`UPDATE ${ipTable} SET window_start = window_start - 60
        WHERE ip_key IN (SELECT ip_key FROM ${ipTable} ORDER BY ip_key LIMIT 128)`);
      const recovered = await miss({ ip: '203.0.113.41', baseUrl: secondBase });
      const afterPrune = await assertGate();
      return { retained, saturated, fullCount, recovered, afterPrune };
    });
    assert.equal(capacity.retained.status, 404);
    assertDenied(capacity.saturated, 503);
    assert.equal(capacity.fullCount, 10000);
    assert.equal(capacity.recovered.status, 404);
    assert.equal(capacity.afterPrune, 10000 - 64 + 1, 'One admission prunes exactly one bounded 64-row batch');
    assert.deepEqual(await snapshot(), before);

    // Concurrent admissions compete for the final slot under the real gate
    // lock; the stored count and actual cardinality must remain identical.
    const lastSlot = await withinMinute(async () => {
      await control.query(`INSERT INTO ${ipTable}(ip_key, window_start, request_count)
        SELECT LPAD(TO_HEX(id), 64, '0'), FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) / 60)::bigint * 60, 1
        FROM generate_series(1, 9999) AS id`);
      await control.query(`UPDATE ${gateTable} SET key_count = 9999 WHERE id = 1`);
      const responses = await Promise.all(Array.from({ length: 16 }, (_, index) => miss({
        ip: `203.0.113.${100 + index}`, ...(index % 2 ? { baseUrl: secondBase } : {}),
      })));
      return { responses, count: await assertGate() };
    });
    assert.equal(lastSlot.responses.filter(response => response.status === 404).length, 1);
    assert.equal(lastSlot.responses.filter(response => response.status === 503).length, 15);
    lastSlot.responses.filter(response => response.status === 503).forEach(response => assertDenied(response, 503));
    assert.equal(lastSlot.count, 10000);
    assert.deepEqual(await snapshot(), before);

    // Every piece of rate storage is required. Renaming owned fixture tables
    // exercises PostgreSQL rejection, real rollback and app recovery.
    for (const table of [ipTable, accountTable, gateTable]) {
      await resetRate();
      before = await snapshot();
      await control.query(`ALTER TABLE ${table} RENAME TO b04_storage_unavailable`);
      try {
        since = calls.length;
        assertDenied(await join(legacyCode, { ip: '192.0.2.60', legacy: true }), 503);
        noBusinessRead(since);
        assert.equal((await http('/api/health')).status, 200);
      } finally {
        await control.query(`ALTER TABLE b04_storage_unavailable RENAME TO ${table}`);
      }
      assert.deepEqual(await snapshot(), before, 'Rate-storage faults leave every business row unchanged');
      assert.equal((await join(missingCode, { ip: '192.0.2.60', legacy: true })).status, 404);
      await assertGate();
    }

    return { outcome: 'PASS', contracts: [
      'actual migration008 applied twice only to an owned isolated PostgreSQL fixture',
      'canonical preview and both join aliases share20/IP/min across two real app instances',
      'concurrent same-IP burst admits exactly20; mixed alias/code rotation cannot reset budget',
      'rotated-IP concurrent join burst admits exactly20/account/min; other account independent',
      'HEAD preview, IPv4-mapped aliases and IPv6 /56 rotation obey the same shared IP budget',
      'unauthenticated401 consumes IP only; denied requests stop before all invite/member/notification work',
      'invalid/oversized code404 before inviteSQL but after shared IP/account budgets',
      'short and legacy32hex exact matches; expired410; real join/reactivation and owner inbox persistence',
      'canonical and legacy management CRUD and admin guards; protected project detail; publicHTML noDB',
      'expired windows reset without wait;10000-key cap;bounded64-row pruning;concurrent final-slot gate consistency',
      'observed PostgreSQL lock wait: concurrent refresh survives pruning with original budget and exact gate count',
      'each missing rate-storage table503, generic error, health200, rollback and recovery',
      'complete business-row snapshots unchanged after denied requests, exhaustion and storage faults',
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
