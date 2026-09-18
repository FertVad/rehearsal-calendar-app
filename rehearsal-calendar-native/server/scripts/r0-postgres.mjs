import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

// No user-supplied database URL is accepted. Only a newly created local Docker
// container with this run's ownership label/DB marker can be modified/removed.
const args = process.argv.slice(2);
const modes = {
  '--a02-only': ['controls', 'A02'],
  '--b03-only': ['controls', 'B03'],
  '--a02-b03-only': ['controls', 'A02', 'B03'],
  '--b04-only': ['controls', 'B04'],
  '--security-only': ['controls', 'A02', 'B03', 'B04'],
};
assert.ok(args.length === 0 || (args.length === 1 && Object.hasOwn(modes, args[0])),
  'Usage: node scripts/r0-postgres.mjs [--a02-only|--b03-only|--a02-b03-only|--b04-only|--security-only]');
const scenarios = modes[args[0]] || ['controls', 'F01', 'B02', 'D01', 'A02', 'B03', 'B04'];
const docker = process.env.R0_DOCKER_BIN || '/usr/local/bin/docker';
const context = process.env.R0_DOCKER_CONTEXT || 'desktop-linux';
const cli = (...args) => execFileSync(docker, ['--context', context, ...args], { encoding: 'utf8', timeout: 20000 }).trim();
const nonce = randomBytes(12).toString('hex');
const password = randomBytes(20).toString('hex');
const name = 'rehearsly-r0-' + nonce;
const cwd = mkdtempSync(path.join(tmpdir(), 'rehearsly-r0-'));
const probe = fileURLToPath(new URL('../__tests__/postgres/probe.mjs', import.meta.url));
let container;
try {
  const endpoint = cli('context', 'inspect', context, '--format', '{{.Endpoints.docker.Host}}');
  assert.ok(endpoint.startsWith('unix://'), 'A remote Docker context is not permitted');
  // Use an already installed official PostgreSQL image, never silently pull.
  const candidates = [...new Set(cli('image', 'ls', '--filter', 'reference=postgres:15', '--quiet', '--no-trunc').split('\n'))];
  assert.equal(candidates.length, 1, 'Exactly one locally installed postgres:15 image is required');
  assert.match(candidates[0], /^sha256:[a-f0-9]{64}$/);
  const image = cli('image', 'inspect', candidates[0], '--format', '{{.Id}}');
  assert.match(image, /^sha256:[a-f0-9]{64}$/);
  container = cli('run', '--pull=never', '--rm', '--detach', '--name', name,
    '--label', 'rehearsly.r0=' + nonce, '--memory', '512m', '--stop-timeout', '3',
    '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=256m',
    '--publish', '127.0.0.1::5432',
    '--env', 'POSTGRES_USER=r0_owner', '--env', 'POSTGRES_DB=r0_test',
    '--env', 'POSTGRES_PASSWORD=' + password, image);
  assert.match(container, /^[a-f0-9]{64}$/);
  const binding = cli('port', container, '5432/tcp');
  assert.match(binding, /^127\.0\.0\.1:\d+$/);
  const url = `postgresql://r0_owner:${password}@${binding}/r0_test`;
  let control;
  for (let attempt = 0; attempt < 30; attempt++) {
    const candidate = new pg.Client({ connectionString: url, connectionTimeoutMillis: 1000 });
    try { await candidate.connect(); control = candidate; break; }
    catch { await candidate.end().catch(() => {}); await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  assert.ok(control, 'Disposable PostgreSQL did not become ready');
  try {
    await control.query('CREATE TABLE public.r0_owned_database (nonce TEXT NOT NULL)');
    await control.query('INSERT INTO public.r0_owned_database VALUES ($1)', [nonce]);
    console.log(JSON.stringify({ harness: 'R0', node: process.version, postgres: (await control.query('SELECT version()')).rows[0].version,
      image, host: binding, database: 'r0_test', schema: 'diagnostic subset; production bootstrap is probed separately' }));
  } finally { await control.end(); }
  for (const scenario of scenarios) {
    const result = spawnSync(process.execPath, ['--unhandled-rejections=strict', probe, scenario], {
      cwd, encoding: 'utf8', timeout: ['B03', 'B04'].includes(scenario) ? 45000 : 15000, maxBuffer: 2 * 1024 * 1024,
      env: { PATH: '/usr/bin:/bin', TZ: 'UTC', NODE_ENV: 'production',
        JWT_SECRET: 'r0-local-signing-secret', ADMIN_PASSWORD: 'r0-local-password', CRON_SECRET: 'r0-local-cron',
        DATABASE_URL: url, R0_NONCE: nonce },
    });
    assert.ifError(result.error);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    assert.equal(result.status, 0, `${scenario} probe failed unexpectedly`);
  }
  console.log(args.length
    ? `${scenarios.slice(1).join('+')} REGRESSION PASS: controls and repaired contracts passed on real PostgreSQL.`
    : 'R0 HARNESS PASS: controls and repaired A02/B03/B04 contracts passed; B02/D01/F01 remain known failing application contracts, NOT fixes.');
} finally {
  if (container) {
    const label = cli('inspect', container, '--format', '{{index .Config.Labels "rehearsly.r0"}}');
    assert.equal(label, nonce, 'Refuse to delete a container not owned by this run');
    cli('rm', '--force', container);
    console.log('R0 cleanup: owned disposable container removed');
  }
  rmSync(cwd, { recursive: true, force: true });
}
