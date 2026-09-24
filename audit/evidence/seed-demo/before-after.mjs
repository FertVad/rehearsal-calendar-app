// Demo seed before/after on a disposable loopback PostgreSQL 15 with the
// canonical schema, seeding machine in Asia/Jerusalem as in August 2026.
//
//   node audit/evidence/seed-demo/before-after.mjs
//
// The old script (git BEFORE) runs from a temporary copy of the server with no
// .env anywhere; the new one from the checkout. Both get an explicit
// DATABASE_URL naming a database of this run, and nothing else.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BEFORE = '90b6105';
const repo = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const server = path.join(repo, 'rehearsal-calendar-native/server');
const require = createRequire(path.join(server, 'package.json'));
const pg = require('pg');
const bcrypt = require('bcrypt');
const zone = 'Asia/Jerusalem';
process.env.TZ = zone;

const results = [];
function report(phase, check, expected, actual) {
  const ok = JSON.stringify(expected) === JSON.stringify(actual);
  results.push(ok);
  console.log(JSON.stringify({ phase, check, expected, actual, result: ok ? 'PASS' : 'FAIL' }));
}
const localDate = offset => { const d = new Date(); d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const scratch = mkdtempSync(path.join(process.env.TMPDIR || tmpdir(), 'seed-demo-ba-'));
const oldSource = execFileSync('git', ['-C', repo, 'show', `${BEFORE}:rehearsal-calendar-native/server/scripts/seed-demo.mjs`], { encoding: 'utf8' });
const oldLiteral = /DEMO_PASSWORD = '([^']+)'/.exec(oldSource)?.[1];
assert.ok(oldLiteral, 'the old script is expected to carry its password literal');
const oldRoot = path.join(scratch, 'old', 'server');
cpSync(server, oldRoot, { recursive: true, filter: source => !source.includes(`${path.sep}node_modules`) && path.basename(source) !== '.env' });
symlinkSync(path.join(server, 'node_modules'), path.join(oldRoot, 'node_modules'));
symlinkSync(path.join(server, '..', 'shared'), path.join(scratch, 'old', 'shared'));
writeFileSync(path.join(oldRoot, 'scripts/seed-demo.mjs'), oldSource);
const cwd = path.join(scratch, 'cwd');
mkdirSync(cwd);
assert.equal(existsSync(path.join(cwd, '.env')), false);

function seed(script, databaseUrl, extra = {}) {
  const child = spawnSync(process.execPath, [script], { cwd, encoding: 'utf8', timeout: 60000,
    env: { PATH: process.env.PATH, HOME: cwd, TZ: zone, DATABASE_URL: databaseUrl, ...extra } });
  assert.ifError(child.error);
  return { status: child.status, output: child.stdout + child.stderr };
}

const docker = '/usr/local/bin/docker';
const cli = (...args) => execFileSync(docker, ['--context', 'desktop-linux', ...args], { encoding: 'utf8', timeout: 20000,
  env: { ...process.env, POSTGRES_PASSWORD: secret } }).trim();
const nonce = randomBytes(12).toString('hex');
const secret = randomBytes(20).toString('hex');
let container;
const clients = [];
try {
  assert.ok(cli('context', 'inspect', 'desktop-linux', '--format', '{{.Endpoints.docker.Host}}').startsWith('unix://'));
  const images = [...new Set(cli('image', 'ls', '--filter', 'reference=postgres:15', '--quiet', '--no-trunc').split('\n'))];
  assert.equal(images.length, 1);
  container = cli('run', '--pull=never', '--rm', '--detach', '--name', `rehearsly-seed-ba-${nonce}`, '--label', `rehearsly.seedba=${nonce}`,
    '--memory', '512m', '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=256m', '--publish', '127.0.0.1::5432',
    '--env', 'POSTGRES_USER=seed_owner', '--env', 'POSTGRES_DB=seed_admin', '--env', 'POSTGRES_PASSWORD', images[0]);
  const binding = cli('port', container, '5432/tcp');
  assert.match(binding, /^127\.0\.0\.1:\d+$/);
  const url = database => { const u = new URL(`postgresql://seed_owner@${binding}/${database}`); u.password = secret; return u.href; };
  let admin;
  for (let attempt = 0; attempt < 40 && !admin; attempt++) {
    const candidate = new pg.Client({ connectionString: url('seed_admin'), connectionTimeoutMillis: 1000 });
    candidate.on('error', () => {});
    try { await candidate.connect(); admin = candidate; } catch { await candidate.end().catch(() => {}); await new Promise(r => setTimeout(r, 250)); }
  }
  assert.ok(admin, 'disposable PostgreSQL did not start');
  clients.push(admin);
  const schema = readFileSync(path.join(server, 'database/init-native-schema.sql'), 'utf8');
  const open = async database => {
    await admin.query(`CREATE DATABASE ${database}`);
    const client = new pg.Client({ connectionString: url(database) });
    await client.connect(); clients.push(client); await client.query(schema);
    return client;
  };
  const allDay = client => client.query(`SELECT to_char(starts_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS') AS s,
    to_char(ends_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS') AS e FROM native_user_availability WHERE is_all_day ORDER BY 1`).then(r => r.rows);
  const timed = client => client.query(`SELECT u.email, a.starts_at, a.ends_at, a.source FROM native_user_availability a
    JOIN native_users u ON u.id=a.user_id WHERE NOT a.is_all_day ORDER BY 1,2`).then(r => JSON.stringify(r.rows));
  console.log(JSON.stringify({ harness: 'seed-demo before/after', before: BEFORE, node: process.version, zone,
    postgres: (await admin.query('SELECT version()')).rows[0].version }));

  // Before: the committed script, run the way it was in August.
  const before = await open('seed_before');
  const old = seed(path.join(oldRoot, 'scripts/seed-demo.mjs'), url('seed_before'));
  report('before', 'old seed exit', 0, old.status);
  const expectedLocalMidnight = [localDate(4), localDate(6)].map(d => {
    const at = new Date(`${d}T00:00:00`); return at.toISOString().slice(0, 19); });
  report('before', 'whole days written as local midnight instants (UTC+3 -> previous day 21:00)',
    expectedLocalMidnight, (await allDay(before)).map(row => row.s.slice(0, 19)));
  report('before', 'password printed on every run', true, old.output.includes(oldLiteral));

  // After: refuses to create the account without a password, before writing.
  const empty = await open('seed_refuse');
  const refused = seed(path.join(server, 'scripts/seed-demo.mjs'), url('seed_refuse'));
  report('after', 'no DEMO_PASSWORD for a new account exits non-zero', 1, refused.status);
  report('after', 'nothing written on refusal', 0, Number((await empty.query('SELECT count(*) FROM native_users')).rows[0].count));

  const demoPassword = randomBytes(18).toString('base64url');
  const after = await open('seed_after');
  const fresh = seed(path.join(server, 'scripts/seed-demo.mjs'), url('seed_after'), { DEMO_PASSWORD: demoPassword });
  report('after', 'new seed exit', 0, fresh.status);
  report('after', 'whole days at UTC midnight of the local date', [
    { s: `${localDate(4)}T00:00:00.000`, e: `${localDate(4)}T23:59:59.999` },
    { s: `${localDate(6)}T00:00:00.000`, e: `${localDate(6)}T23:59:59.999` }], await allDay(after));
  report('after', 'timed slots identical to the old seed', await timed(before), await timed(after));
  report('after', 'password not printed', false, fresh.output.includes(demoPassword));
  const account = (await after.query(`SELECT id, password_hash FROM native_users WHERE email='demo@rehearsly.me'`)).rows[0];
  report('after', 'demo account signs in with DEMO_PASSWORD', true, await bcrypt.compare(demoPassword, account.password_hash));
  const rerun = seed(path.join(server, 'scripts/seed-demo.mjs'), url('seed_after'));
  report('after', 're-run without DEMO_PASSWORD on an existing account', 0, rerun.status);
  const kept = (await after.query(`SELECT id, password_hash FROM native_users WHERE email='demo@rehearsly.me'`)).rows[0];
  report('after', 're-run keeps the account and its password', true,
    kept.id === account.id && kept.password_hash === account.password_hash);
} finally {
  for (const client of clients.reverse()) await client.end().catch(() => {});
  if (container && cli('inspect', container, '--format', '{{index .Config.Labels "rehearsly.seedba"}}') === nonce) cli('stop', container);
  rmSync(scratch, { recursive: true, force: true });
}
const failures = results.filter(ok => !ok).length;
console.log(JSON.stringify({ summary: failures ? 'FAIL' : 'PASS', checks: results.length, failures }));
process.exitCode = failures ? 1 : 0;
