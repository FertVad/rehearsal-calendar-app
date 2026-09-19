import assert from 'node:assert/strict';

// Exercise the four existing consumers of adapter.changes through real HTTP;
// counts alone must agree with independently observed committed PostgreSQL rows.
export async function probeF05({ control, http }) {
  await control.query('ALTER TABLE native_users ADD COLUMN password_hash TEXT');
  await control.query(`CREATE TABLE native_auth_providers (
    id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES native_users(id),
    provider_type TEXT NOT NULL, UNIQUE(user_id, provider_type))`);
  await control.query(`INSERT INTO native_auth_providers(user_id,provider_type)
    VALUES(1,'email'),(1,'google'),(2,'apple')`);
  for (const [user, source, event] of [[1, 'apple_calendar', 'a'], [1, 'google_calendar', 'b'],
    [1, 'apple_calendar', 'c'], [1, 'manual', 'a'], [2, 'apple_calendar', 'a']]) {
    await control.query(`INSERT INTO native_user_availability
      (user_id,starts_at,ends_at,type,source,external_event_id,title)
      VALUES($1,'2030-09-19T10:00:00Z','2030-09-19T11:00:00Z','busy',$2,$3,'Original')`,
    [user, source, event]);
  }
  const rows = async () => (await control.query('SELECT * FROM native_user_availability ORDER BY id')).rows;
  const untouched = (await rows()).filter(row => row.user_id !== 1 || row.source === 'manual');
  const assertUntouched = async () => assert.deepEqual(
    (await rows()).filter(row => row.user_id !== 1 || row.source === 'manual'), untouched);
  const update = id => ({ externalEventId: id, startsAt: '2030-09-19T12:00:00Z',
    endsAt: '2030-09-19T13:00:00Z', title: 'Updated', isAllDay: false });
  for (const [ids, expected] of [[['missing'], 0], [['a'], 1], [['a', 'b'], 2]]) {
    const response = await http('/api/native/availability/imported/batch', {
      method: 'PUT', body: { updates: ids.map(update) },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(response.data, { success: true, updatedCount: expected });
    for (const id of ids.filter(id => id !== 'missing')) {
      const stored = (await rows()).find(row => row.user_id === 1 && row.source !== 'manual' && row.external_event_id === id);
      assert.equal(stored.title, 'Updated');
      assert.equal(stored.starts_at.toISOString(), '2030-09-19T12:00:00.000Z');
    }
    await assertUntouched();
  }
  for (const [ids, expected] of [[['missing'], 0], [['a', 'b'], 2], [['a', 'b'], 0]]) {
    const before = (await rows()).length;
    const response = await http('/api/availability/imported/batch', { method: 'DELETE', body: { eventIds: ids } });
    assert.equal(response.status, 200);
    assert.deepEqual(response.data, { success: true, deletedCount: expected });
    assert.equal(before - (await rows()).length, expected);
    await assertUntouched();
  }
  for (const expected of [1, 0]) {
    const before = (await rows()).length;
    const response = await http('/api/native/availability/imported/all', { method: 'DELETE' });
    assert.equal(response.status, 200);
    assert.deepEqual(response.data, { success: true, deletedCount: expected });
    assert.equal(before - (await rows()).length, expected);
    await assertUntouched();
  }
  const providers = async () => (await control.query('SELECT * FROM native_auth_providers ORDER BY id')).rows;
  const beforeMissing = await providers();
  const missing = await http('/api/auth/me/providers/apple', { method: 'DELETE' });
  assert.equal(missing.status, 404);
  assert.deepEqual(missing.data, { error: 'Auth provider not found' });
  assert.deepEqual(await providers(), beforeMissing);
  assert.equal((await http('/api/auth/me/providers/google', { method: 'DELETE' })).status, 200);
  assert.deepEqual(await providers(), beforeMissing.filter(row => row.user_id !== 1 || row.provider_type !== 'google'));
  const beforeLast = await providers();
  assert.equal((await http('/api/auth/me/providers/email', { method: 'DELETE' })).status, 400);
  assert.deepEqual(await providers(), beforeLast);
  return { outcome: 'PASS', contracts: ['real HTTP update/delete counts0/1/N match committed rows',
    'repeat deletes report0; manual and other-user rows unchanged',
    'missing provider404/no writes; existing provider200; last-method guard retained'] };
}
