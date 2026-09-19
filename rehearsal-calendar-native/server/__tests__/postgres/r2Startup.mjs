import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createEntrypointFixture, fixtureJwtSecret } from '../startup/entrypointFixture.mjs';

const require = createRequire(new URL('../../package.json', import.meta.url));
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Invoked only after probe.mjs verifies its owned DB marker, creates r0_fixture
// and applies fixture.sql plus the actual operation-budget migration twice.
export async function probeR2Startup({ connectionString, control, allowedPorts }) {
  const applicationName = `r2-startup-fixture-${process.pid}`;
  const databaseUrl = new URL(connectionString);
  assert.equal(databaseUrl.hostname, '127.0.0.1');
  databaseUrl.searchParams.set('application_name', applicationName);
  const password = 'r2-startup-owned-user-password';
  const email = 'r2-startup-user@fixture.invalid';
  await control.query(`ALTER TABLE native_users
    ADD COLUMN password_hash TEXT, ADD COLUMN phone TEXT, ADD COLUMN avatar_url TEXT,
    ADD COLUMN timezone TEXT DEFAULT 'UTC', ADD COLUMN email_notifications BOOLEAN DEFAULT TRUE,
    ADD COLUMN week_start_day TEXT DEFAULT 'monday', ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE,
    ADD COLUMN last_login_at TIMESTAMPTZ`);
  const inserted = await control.query(
    'INSERT INTO native_users (email, first_name, password_hash) VALUES ($1, $2, $3) RETURNING id',
    [email, 'Startup', await bcrypt.hash(password, 4)],
  );
  const userId = inserted.rows[0].id;
  const fixture = createEntrypointFixture({ databaseUrl: databaseUrl.href,
    environment: { JWT_EXPIRES_IN: '15m', REFRESH_TOKEN_EXPIRES_IN: '7d' } });
  let httpPort;
  try {
    await fixture.start({ mode: 'framework', vercel: true });
    assert.ok(fixture.events.some(event => event.type === 'imported' && event.defaultHandler));
    assert.equal(fixture.entrypointListeners.length, 0);
    httpPort = fixture.events.find(event => event.type === 'framework-listener')?.address.port;
    assert.ok(httpPort);
    allowedPorts.add(httpPort);
    assert.equal(fixture.connectionAttempts, 0);
    for (const route of ['/', '/privacy', '/support', '/.well-known/apple-app-site-association', '/invite/ABCDEFGH', '/admin', '/api/health']) {
      assert.equal((await fixture.request(route)).status, 200);
    }
    assert.equal(fixture.connectionAttempts, 0, 'public traffic must not acquire a database connection');

    const ready = await fixture.request('/api/ready');
    assert.equal(ready.status, 200);
    assert.deepEqual(ready.body, { status: 'ready' });
    assert.equal(ready.headers['cache-control'], 'no-store');
    assert.equal(fixture.connectionAttempts, 1);
    const login = await fixture.request('/api/auth/login', { method: 'POST', body: { email, password },
      headers: { 'X-Forwarded-For': '198.51.100.140' } });
    assert.equal(login.status, 200, 'healthy copied entrypoint performs real password authentication');
    const access = jwt.verify(login.body.accessToken, fixtureJwtSecret);
    const refresh = jwt.verify(login.body.refreshToken, fixtureJwtSecret);
    assert.equal(access.userId, userId);
    assert.equal(access.type, 'access');
    assert.equal(access.exp - access.iat, 900);
    assert.equal(refresh.type, 'refresh');
    assert.equal(refresh.exp - refresh.iat, 604800);
    const profile = await fixture.request('/api/auth/me', { headers: {
      Authorization: `Bearer ${login.body.accessToken}`, 'X-Forwarded-For': '198.51.100.140',
    } });
    assert.equal(profile.status, 200);
    assert.equal(profile.body.user.id, userId);
    assert.equal(profile.body.user.email, email);
    const user = (await control.query('SELECT last_login_at FROM native_users WHERE id = $1', [userId])).rows[0];
    assert.ok(user.last_login_at instanceof Date);

    // Independent database observation distinguishes a genuine new probe from
    // returning a cached 'ready' flag. Account work left a users SELECT as the
    // last query; the next readiness request must actually execute SELECT 1.
    const beforeProbe = (await control.query('SELECT query FROM pg_stat_activity WHERE application_name = $1', [applicationName])).rows;
    assert.equal(beforeProbe.length, 1);
    assert.match(beforeProbe[0].query, /FROM native_users/i);
    assert.equal((await fixture.request('/api/ready')).status, 200);
    const afterProbe = (await control.query('SELECT query FROM pg_stat_activity WHERE application_name = $1', [applicationName])).rows;
    assert.equal(afterProbe.length, 1);
    assert.match(afterProbe[0].query.trim(), /^SELECT 1$/i);
    fixture.assertBoundaries();
    return { scenario: 'R2_STARTUP', outcome: 'PASS', checks: 7,
      sourceEntryCopied: true, publicRequestsBeforeDatabaseConnection: 7,
      explicitEnvironmentBeforeJwtCapture: true, actualPasswordLogin: true,
      actualAuthenticatedProfile: true, actualReadinessQueryObserved: true,
      externalConnections: 0 };
  } finally {
    if (httpPort) allowedPorts.delete(httpPort);
    await fixture.close();
  }
}
