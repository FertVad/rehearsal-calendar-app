import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const mode = process.argv[2];
assert.ok(process.argv.length === 3 && ['--before', '--after'].includes(mode));
const cli = (...args) => execFileSync('/usr/local/bin/docker', ['--context', 'desktop-linux', ...args],
  { encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const nonce = randomBytes(12).toString('hex');
const password = randomBytes(20).toString('hex');
let container;
try {
  assert.ok(cli('context', 'inspect', 'desktop-linux', '--format', '{{.Endpoints.docker.Host}}').startsWith('unix://'));
  const images = [...new Set(cli('image', 'ls', '--filter', 'reference=postgres:15', '--quiet', '--no-trunc').split('\n'))];
  assert.equal(images.length, 1);
  assert.match(images[0], /^sha256:[a-f0-9]{64}$/);
  const image = cli('image', 'inspect', images[0], '--format', '{{.Id}}');
  container = cli('run', '--pull=never', '--rm', '--detach', '--name', `reh-r2-legacy-${nonce}`,
    '--label', `rehearsly.r2legacy=${nonce}`, '--memory', '512m', '--stop-timeout', '3',
    '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=256m', '--publish', '127.0.0.1::5432',
    '--env', 'POSTGRES_USER=legacy_owner', '--env', 'POSTGRES_DB=legacy_fixture', '--env', `POSTGRES_PASSWORD=${password}`, image);
  assert.match(container, /^[a-f0-9]{64}$/);
  const binding = cli('port', container, '5432/tcp');
  assert.match(binding, /^127\.0\.0\.1:\d+$/);
  const url = `postgresql://legacy_owner:${password}@${binding}/legacy_fixture`;
  let control;
  for (let i = 0; i < 30; i++) {
    const candidate = new pg.Client({ connectionString: url, connectionTimeoutMillis: 1000 });
    candidate.on('error', () => {});
    try { await candidate.connect(); control = candidate; break; }
    catch { await candidate.end().catch(() => {}); await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  assert.ok(control, 'OWNED_POSTGRES_START_FAILED');
  try {
    await control.query('CREATE TABLE public.r2_legacy_owned(nonce TEXT NOT NULL)');
    await control.query('INSERT INTO public.r2_legacy_owned VALUES($1)', [nonce]);
    const hashes = {};
    for (const dir of ['historical', 'forward', 'tests']) {
      for (const file of readdirSync(new URL(`./${dir}/`, import.meta.url)).sort()) {
        hashes[`${dir}/${file}`] = createHash('sha256').update(readFileSync(new URL(`./${dir}/${file}`, import.meta.url))).digest('hex');
      }
    }
    console.log(JSON.stringify({ harness: 'FM01/FM02 draft', mode, node: process.version,
      postgres: (await control.query('SELECT version()')).rows[0].version, image, ownedLoopback: true,
      historicalCaptureCommit: 'aa00ffd5874b3b5e4c402b42b120ceb876e637e2', hashes }));
  } finally { await control.end(); }
  const result = spawnSync(process.execPath,
    ['--unhandled-rejections=strict', fileURLToPath(new URL(`./tests/${mode.slice(2)}.mjs`, import.meta.url))], {
      cwd: fileURLToPath(new URL('./', import.meta.url)), timeout: 90000,
      maxBuffer: 4 * 1024 * 1024, encoding: 'utf8',
      env: { PATH: '/usr/bin:/bin', TZ: 'UTC', NODE_ENV: 'test', FM_DATABASE_URL: url, FM_NONCE: nonce },
    });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  assert.ifError(result.error);
  console.log(JSON.stringify({ mode, actualExit: result.status, signal: result.signal }));
  process.exitCode = result.status === 0 ? 0 : 1;
} finally {
  if (container) {
    assert.equal(cli('inspect', container, '--format', '{{index .Config.Labels "rehearsly.r2legacy"}}'), nonce);
    cli('rm', '--force', container);
    console.log('Cleanup: owned temporary PostgreSQL removed');
  }
}
