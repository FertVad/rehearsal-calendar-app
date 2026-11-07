#!/usr/bin/env node
/**
 * The app end to end, on a simulator, against nothing real.
 *
 *   npm run e2e                  every flow in e2e/flows, then everything is taken down
 *   npm run e2e -- <flow.yaml>…  only those flows
 *   npm run e2e:up               stands it all up and keeps it up — for Maestro MCP
 *                                or Studio — until Ctrl-C
 *   --build                      rebuild the app even when a build is there
 *
 * What it stands up, and what it refuses:
 *
 * - PostgreSQL: a throwaway container from the locally installed postgres:15
 *   image, data on tmpfs, port on 127.0.0.1 — the rules of the R0 harness. The
 *   canonical schema goes in with `migrate --fresh`; seed.mjs fills it.
 * - The server: started with an environment built here from nothing — no
 *   SERVER_ENV_FILE, nothing inherited but PATH and HOME — so server/.env, which
 *   is production, cannot reach it; the database must be the container's. Its
 *   mail stays in its process (EMAIL_TRANSPORT=capture-for-tests), and
 *   server-with-mailbox.mjs hands the codes to the flows on 127.0.0.1:3002.
 * - Metro: its own. The checkout's .env points the app at rehearsly.me, and in
 *   development Expo bundles .env files over the environment — a variable given
 *   to Metro does not reach the app while the file names another address. So
 *   Metro runs with REHEARSLY_E2E=1, which keeps the files out of the bundle
 *   (metro.config.js); the bundle is then searched for every address the app
 *   could read, and the app is not opened unless each is the local server. After
 *   that the address the app reports on start is watched, and the run stops if
 *   it is ever another. Ports 3001, 3002 and 8081 must be free: a server or Metro
 *   already running there is not ours to reuse, and could be pointed anywhere.
 * - The app: a Debug build (Release talks to production) on a simulator of its
 *   own, "Rehearsly E2E", so no other simulator's data is touched.
 *
 * Everything it writes goes to e2e/out: logs, the seed, JUnit, screenshots.
 *
 * Exit codes: 0 the flows passed; 1 the change failed — a flow, the server,
 * the seed, the bundle; 2 the app reported another API address; 75 the machine
 * was not ready — Docker, a port held by something not ours, the simulator,
 * another run that never finished — so a scheduler waits and runs it again
 * rather than send the change back.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getText } from './http.mjs';
import { mergeJunit } from './junit.mjs';
import { LOCK, takeLock } from './lock.mjs';
import { exitCode, flattenBatches, limitMs, nextStep } from './midnight.mjs';
import { localDate, seed } from './seed.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = path.join(ROOT, 'server');
const E2E = path.join(ROOT, 'e2e');
const OUT = path.join(E2E, 'out');
const BUILD = path.join(E2E, '.build');
// A worktree without the iOS Pods (the autodev supervisor's) uses an app built
// elsewhere: E2E_APP names it. The JS comes from this tree's Metro either way.
const PREBUILT = process.env.E2E_APP || null;
const APP = PREBUILT || path.join(BUILD, 'Build', 'Products', 'Debug-iphonesimulator', 'Rehearsly.app');
// One run at a time on this machine: the simulator and ports 3001/8081 are
// shared. It also names what each run started (lock.mjs), and a heavy job
// held under it (hold-lock.mjs, T-231) is waited for as another run is.
let lock = null;
const pg = createRequire(path.join(SERVER, 'package.json'))('pg');

const API_PORT = 3001;
const METRO_PORT = 8081;
// One address, held by the server itself. On '::' with the app on localhost,
// any process that came up later on ::1:3001 or 127.0.0.1:3001 — the kernel
// lets a specific address share a port with the wildcard — got the app's new
// connections and left them unanswered: a create timed out (T-203). Bound to
// 127.0.0.1, the port is refused to anyone else there, and an IP address
// leaves the simulator nothing else to try.
const API_HOST = '127.0.0.1';
const API_URL = `http://${API_HOST}:${API_PORT}/api`;
// The codes the local server mailed, for the flows (server-with-mailbox.mjs).
const MAIL_PORT = 3002;
const MAIL_URL = `http://${API_HOST}:${MAIL_PORT}`;
const BUNDLE_ID = 'com.rehearsal.app';
const DEVICE = { name: 'Rehearsly E2E', type: 'com.apple.CoreSimulator.SimDeviceType.iPhone-16' };
const MAESTRO = process.env.MAESTRO_BIN || path.join(os.homedir(), '.maestro', 'bin', 'maestro');
const DOCKER = process.env.E2E_DOCKER_BIN || '/usr/local/bin/docker';
const DOCKER_CONTEXT = 'desktop-linux';
// Maestro reports usage to its makers unless told not to.
const MAESTRO_ENV = { ...process.env, MAESTRO_CLI_NO_ANALYTICS: '1', MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true' };

const argv = process.argv.slice(2);
const stayUp = argv.includes('--up');
const forceBuild = argv.includes('--build');
const flows = argv.filter((arg) => !arg.startsWith('--')).map((flow) => path.resolve(flow));

const step = (text) => console.log(`[e2e] ${text}`);
/** A batch of flows failed: the run ends 1 however it stops after (exitCode, e2e/midnight.mjs). */
let flowsFailed = false;

/** The machine is not ready: nothing the change under test did. Exit 75. */
class EnvironmentError extends Error {}
async function environment(work) {
  try { return await work(); } catch (error) { throw error instanceof EnvironmentError ? error : new EnvironmentError(error.message); }
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- taking it down -------------------------------------------------------

const teardown = [];
let tornDown = false;
async function tearDown() {
  if (tornDown) return;
  tornDown = true;
  for (const undo of teardown.reverse()) {
    try { await undo(); } catch (error) { console.error(`[e2e] teardown: ${error.message}`); }
  }
}
for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]]) {
  process.on(signal, () => { tearDown().then(() => process.exit(code)); });
}

/**
 * A long-running process in its own group, logged to e2e/out, stopped on
 * teardown — and through watchdog.mjs, which holds a pipe from this process
 * and takes the group down when it closes: a run killed outright takes its
 * server and Metro with it, in the developer's sandbox too.
 */
function background(name, command, args, options, { append = false } = {}) {
  const logFile = path.join(OUT, `${name}.log`);
  const log = fs.openSync(logFile, append ? 'a' : 'w');
  const child = spawn(process.execPath, [path.join(E2E, 'watchdog.mjs'), command, ...args],
    { ...options, detached: true, stdio: ['pipe', log, log] });
  // Its own group outlives a run killed outright; the lock names it for the next.
  lock.record(name, child.pid);
  teardown.push(() => { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ } });
  child.once('exit', (code) => { if (!tornDown && !child.stopping) console.error(`[e2e] ${name} exited (${code}) — see ${logFile}`); });
  return child;
}

/**
 * The server's and Metro's logs, copied next to the flows' artifacts of the
 * run that wrote them. e2e/out/server.log is rewritten by every run, so a
 * failure the supervisor reran was left with no server side at all: a POST
 * the server never answered could not be told from one it never got (T-203).
 * Runs on teardown, after the server is stopped, so the copy is whole.
 */
function keepLogs(startedAt) {
  return () => {
    const artifacts = path.join(OUT, 'artifacts');
    if (!fs.existsSync(artifacts)) return;
    for (const run of fs.readdirSync(artifacts)) {
      const dir = path.join(artifacts, run);
      if (!fs.statSync(dir).isDirectory() || fs.statSync(dir).birthtimeMs < startedAt) continue;
      for (const name of ['server.log', 'metro.log']) {
        const log = path.join(OUT, name);
        if (fs.existsSync(log)) fs.copyFileSync(log, path.join(dir, name));
      }
    }
  };
}

async function waitFor(what, check, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try { if (await check()) return; } catch { /* not yet */ }
    assert.ok(Date.now() < deadline, `${what} did not come up within ${timeoutMs / 1000}s`);
    await sleep(500);
  }
}

const inUse = (port, host) => new Promise((resolve) => {
  const socket = net.connect({ port, host });
  socket.setTimeout(1000, () => { socket.destroy(); resolve(false); });
  socket.once('connect', () => { socket.destroy(); resolve(true); });
  socket.once('error', () => resolve(false));
});

async function requireFree(port, what) {
  for (const host of ['127.0.0.1', '::1']) {
    assert.ok(!(await inUse(port, host)),
      `Port ${port} is taken on ${host}. Stop the ${what} running there: e2e starts its own and will not reuse one.`);
  }
}

// ---- PostgreSQL -----------------------------------------------------------

const docker = (...args) =>
  execFileSync(DOCKER, ['--context', DOCKER_CONTEXT, ...args], { encoding: 'utf8', timeout: 30000 }).trim();

/** Docker Desktop idles its VM; the first command after that can take a minute. */
function wakeDocker() {
  execFileSync(DOCKER, ['--context', DOCKER_CONTEXT, 'version', '--format', '{{.Server.Version}}'],
    { encoding: 'utf8', timeout: 180000 });
}

async function startDatabase() {
  wakeDocker();
  const endpoint = docker('context', 'inspect', DOCKER_CONTEXT, '--format', '{{.Endpoints.docker.Host}}');
  assert.ok(endpoint.startsWith('unix://'), 'A remote Docker context is not permitted');
  // An image already on this machine, never a silent pull.
  const images = [...new Set(docker('image', 'ls', '--filter', 'reference=postgres:15', '--quiet', '--no-trunc')
    .split('\n').filter(Boolean))];
  assert.equal(images.length, 1, 'Exactly one locally installed postgres:15 image is required');
  // Under the lock every e2e container is one a dead run left: one run at a time.
  for (const left of docker('ps', '--quiet', '--filter', 'label=rehearsly.e2e').split('\n').filter(Boolean)) {
    step(`stopping the database a dead run left behind (${left})`);
    docker('stop', left);
  }

  const nonce = randomBytes(6).toString('hex');
  const password = randomBytes(20).toString('hex');
  const container = docker('run', '--pull=never', '--rm', '--detach', '--name', `rehearsly-e2e-${nonce}`,
    '--label', `rehearsly.e2e=${nonce}`, '--memory', '512m', '--stop-timeout', '3',
    '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=256m',
    '--publish', '127.0.0.1::5432',
    '--env', 'POSTGRES_USER=e2e', '--env', 'POSTGRES_DB=rehearsly_e2e', '--env', `POSTGRES_PASSWORD=${password}`,
    images[0]);
  teardown.push(() => docker('stop', container));

  let binding = '';
  await waitFor('the database port', () => (binding = docker('port', container, '5432/tcp').split('\n')[0].trim()), 10000);
  assert.match(binding, /^127\.0\.0\.1:\d+$/);
  const url = `postgresql://e2e:${password}@${binding}/rehearsly_e2e`;
  await waitFor('PostgreSQL', async () => {
    const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 1000 });
    try { await client.connect(); await client.query('SELECT 1'); return true; } finally { await client.end().catch(() => {}); }
  }, 30000);
  return url;
}

/** Nothing below is given a database that is not the container's. */
function assertLocalDatabase(url) {
  assert.equal(new URL(url).hostname, '127.0.0.1', 'Refusing a database other than the local e2e container');
}

// ---- the address the app uses ---------------------------------------------

/** Refuses a bundle that could give the app any API address but the local one. */
function checkBundle(bundle) {
  const envFiles = [...bundle.matchAll(/\},\d+,\[[^\]]*\],"([^"]*\.env[^"/]*)"\);/g)].map((match) => match[1]);
  assert.deepEqual(envFiles, [], `The bundle carries env files ${JSON.stringify(envFiles)}; they would override the address`);
  const values = [...bundle.matchAll(/["']?EXPO_PUBLIC_API_URL["']?\s*:\s*(?:\{[^}]*?value:\s*)?("(?:[^"\\]|\\.)*"|'[^']*')/g)]
    .map((match) => match[1].slice(1, -1));
  assert.ok(values.length > 0, 'The bundle gives the app no API address at all');
  const foreign = values.filter((value) => value !== API_URL);
  assert.deepEqual(foreign, [], `The bundle gives the app ${JSON.stringify(foreign)} as its API address`);
  const read = [...bundle.matchAll(/envApiUrl\s*=\s*([^;,\n]+)/g)].map((match) => match[1].trim());
  assert.ok(read.length === 1 && read[0].endsWith('.EXPO_PUBLIC_API_URL'),
    `The app takes its API address from ${JSON.stringify(read)}, not from EXPO_PUBLIC_API_URL`);
}

/**
 * The app logs the address it settled on when it starts, and the log reaches
 * Metro. Any other address stops everything at once: the app is closed and
 * the environment taken down.
 */
function watchReportedAddress(udid) {
  const logFile = path.join(OUT, 'metro.log');
  let offset = 0;
  const timer = setInterval(() => {
    const text = fs.readFileSync(logFile, 'utf8');
    const fresh = text.slice(offset);
    offset = text.length;
    for (const match of fresh.matchAll(/Using EXPO_PUBLIC_API_URL: (\S+)/g)) {
      if (match[1] === API_URL) continue;
      clearInterval(timer);
      try { simctl('terminate', udid, BUNDLE_ID); } catch { /* not running */ }
      console.error(`[e2e] STOPPED: the app reported ${match[1]} as its API address`);
      tearDown().then(() => process.exit(2));
      return;
    }
  }, 250);
  teardown.push(() => clearInterval(timer));
}

// ---- the simulator --------------------------------------------------------

const simctl = (...args) => execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8', timeout: 300000 }).trim();

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}

/**
 * English, with only the US keyboard. A new simulator takes the Mac's
 * languages and keyboards, and Maestro typing Latin text through a Russian
 * layout loses characters — a password arrived three letters long, an email
 * not at all. The flows also read English labels. Applied while booted; takes
 * effect on reboot.
 */
function pinLocale(udid) {
  const read = (key) => { try { return simctl('spawn', udid, 'defaults', 'read', '.GlobalPreferences', key).replace(/\s+/g, ''); } catch { return ''; } };
  if (read('AppleLocale') === 'en_US' && read('AppleKeyboards') === '("en_US@sw=QWERTY;hw=Automatic")') return false;
  simctl('spawn', udid, 'defaults', 'write', '.GlobalPreferences', 'AppleLanguages', '-array', 'en-US');
  simctl('spawn', udid, 'defaults', 'write', '.GlobalPreferences', 'AppleLocale', '-string', 'en_US');
  simctl('spawn', udid, 'defaults', 'write', '.GlobalPreferences', 'AppleKeyboards', '-array', 'en_US@sw=QWERTY;hw=Automatic');
  return true;
}

/**
 * Maestro types through the on-screen keyboard, which appears only while
 * Simulator.app shows the device. Simulator.app also switches a device's
 * keyboard to the Mac's input language as you type on the Mac — Latin text
 * through a Russian layout lost characters — unless I/O → Keyboard → "Use the
 * Same Keyboard Language as macOS" is off (EnableKeyboardSync; the owner turned
 * it off on 2026-10-07). With it on, a flow's typing would depend on what was
 * last typed on the Mac, so e2e refuses to run.
 */
function showSimulator(udid) {
  let sync = '';
  try {
    sync = execFileSync('defaults', ['read', 'com.apple.iphonesimulator', 'EnableKeyboardSync'], { encoding: 'utf8' }).trim();
  } catch { /* unset means on */ }
  assert.equal(sync, '0',
    'Simulator switches the keyboard to the Mac\'s language: turn off I/O → Keyboard → "Use the Same Keyboard Language as macOS"');
  execFileSync('open', ['-a', 'Simulator', '--args', '-CurrentDeviceUDID', udid]);
}

/**
 * The keyboard's first-use tip ("Speed up your typing by sliding your finger")
 * covers the lower half of the screen the first time a field is focused.
 */
function quietKeyboard(udid) {
  simctl('spawn', udid, 'defaults', 'write', 'com.apple.keyboard.preferences',
    'DidShowContinuousPathIntroduction', '-bool', 'true');
}

/**
 * The simulator's own zone, away from the machine's and so from everyone's
 * profile (seed.mjs). The app shows the zone the person chose, never the
 * device's (cause fix 14); with both the same, nothing on screen could tell
 * them apart. Honolulu: no summer time, and absent from the profile's list, so
 * the picker names it as the device's at the top. Set for the simulator's
 * launchd, so the app inherits it at every launch; a reboot clears it.
 */
const SIMULATOR_ZONE = 'Pacific/Honolulu';

function pinZone(udid) {
  simctl('spawn', udid, 'launchctl', 'setenv', 'TZ', SIMULATOR_ZONE);
}

/** The e2e simulator, created on the newest iOS runtime the first time. */
function simulator() {
  const { devices } = JSON.parse(simctl('list', 'devices', '--json'));
  for (const list of Object.values(devices)) {
    const found = list.find((device) => device.name === DEVICE.name && device.isAvailable);
    if (found) return found.udid;
  }
  const runtimes = JSON.parse(simctl('list', 'runtimes', '--json')).runtimes
    .filter((runtime) => runtime.platform === 'iOS' && runtime.isAvailable)
    .sort((a, b) => compareVersions(a.version, b.version));
  assert.ok(runtimes.length, 'No iOS simulator runtime is installed');
  step(`creating the "${DEVICE.name}" simulator on iOS ${runtimes.at(-1).version}`);
  return simctl('create', DEVICE.name, DEVICE.type, runtimes.at(-1).identifier);
}

// ---- the run --------------------------------------------------------------

// ---- a day's database, server and seed ------------------------------------

/**
 * What the flows are given is seeded for one day — the machine's today, the
 * zone of everyone's profile (seed.mjs): TODAY_DAY, the rehearsals of today
 * and tomorrow, the labels. A run that went on past midnight showed flows the
 * app's new today against yesterday's seed, and every flow about today failed
 * after 00:00 (T-226: the whole set started at 23:09). So the flows go to
 * Maestro in batches that end before midnight, and before each batch a day
 * that turned gets a day of its own: a new database in the same container, the
 * server restarted on it, the seed made again. The flows find the world they
 * were written for, as on a run started that morning.
 *
 * A batch is as many flows as fit before midnight at FLOW_BOUND_MS each
 * (e2e/midnight.mjs). When not one fits, the run waits for midnight rather
 * than start a flow the day would turn under — unless the wait would outlast
 * the supervisor's limit; then it stops as not ready. Not one Maestro a flow
 * all the time: each costs some 50 s to start, an hour on the whole set.
 */

const serverEnv = (databaseUrl) => ({
  PATH: process.env.PATH,
  HOME: os.homedir(),
  NODE_ENV: 'development',
  PORT: String(API_PORT),
  HOST: API_HOST,
  DATABASE_URL: databaseUrl,
  JWT_SECRET: randomBytes(32).toString('base64'),
  CRON_SECRET: randomBytes(32).toString('base64'),
  BASE_URL: `http://${API_HOST}:${API_PORT}`,
  EMAIL_TRANSPORT: 'capture-for-tests',
  // A flow that plays a phone puts a push token on this server
  // (e2e/device); a send to it must not reach Expo. Nothing listens here.
  EXPO_BASE_URL: 'http://127.0.0.1:9',
  MAIL_HOST: API_HOST,
  MAIL_PORT: String(MAIL_PORT),
});

function migrate(databaseUrl, { append = false } = {}) {
  const migrateLog = fs.openSync(path.join(OUT, 'migrate.log'), append ? 'a' : 'w');
  execFileSync(process.execPath, ['scripts/migrate.js', '--fresh'], {
    cwd: SERVER,
    env: { PATH: process.env.PATH, HOME: os.homedir(), DATABASE_URL: databaseUrl },
    stdio: ['ignore', migrateLog, migrateLog],
    timeout: 120000,
  });
}

/** server.js through server-with-mailbox.mjs: the codes it mails stay in that process, and the flows read them from MAIL_URL. */
async function startServer(databaseUrl, { append = false } = {}) {
  const server = background('server', process.execPath, [path.join(E2E, 'server-with-mailbox.mjs')],
    { cwd: SERVER, env: serverEnv(databaseUrl) }, { append });
  await waitFor('the local server', async () => (await fetch(`${API_URL}/ready`)).ok, 30000);
  await waitFor('the mailbox', async () => (await fetch(`${MAIL_URL}/code?to=`)).status === 404, 10000);
  return server;
}

async function stopServer(server) {
  if (server.exitCode === null && server.signalCode === null) {
    server.stopping = true;
    const exited = new Promise((resolve) => server.once('exit', resolve));
    try { process.kill(-server.pid, 'SIGTERM'); } catch { /* already gone */ }
    await exited;
  }
  await waitFor('the server\'s ports to close', async () =>
    !(await inUse(API_PORT, API_HOST)) && !(await inUse(MAIL_PORT, API_HOST)), 10000);
}

/** The seed, made for the machine's today: `{ date, seeded }`, the date taken before it began. */
async function seedDay(databaseUrl) {
  const date = localDate(0);
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  let seeded;
  try {
    seeded = await seed({ client, apiUrl: API_URL, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  } finally {
    await client.end();
  }
  fs.writeFileSync(path.join(OUT, 'seed.json'), JSON.stringify(seeded, null, 2));
  return { date, seeded };
}

/** A database of its own for `date`, next to the first in the same container. */
async function databaseFor(firstUrl, date) {
  const name = `rehearsly_e2e_${date.replace(/-/g, '')}`;
  const client = new pg.Client({ connectionString: firstUrl });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS ${name}`);
    await client.query(`CREATE DATABASE ${name}`);
  } finally {
    await client.end();
  }
  const url = new URL(firstUrl);
  url.pathname = `/${name}`;
  assertLocalDatabase(url.href);
  return url.href;
}

/** What a day's seed gives the flows, as Maestro's -e variables. */
function variablesFor(seeded, udid) {
  const variables = ['-e', `PASSWORD=${seeded.password}`, '-e', `APP_ID=${BUNDLE_ID}`,
    '-e', `API_URL=${API_URL}`, '-e', `MAIL_URL=${MAIL_URL}`, '-e', `SIMULATOR=${udid}`,
    ...Object.entries(seeded.people).flatMap(([key, person]) => ['-e', `${key.toUpperCase()}_EMAIL=${person.email}`]),
    ...Object.entries(seeded.invites).flatMap(([key, code]) => ['-e', `${key.toUpperCase()}_INVITE=${code}`]),
    ...Object.entries(seeded.days).flatMap(([key, date]) => ['-e', `${key.toUpperCase()}_DAY=${date}`]),
    ...Object.entries(seeded.times).flatMap(([key, time]) => ['-e', `${key.toUpperCase()}_TIME=${time}`]),
    ...Object.entries(seeded.labels).flatMap(([key, label]) => ['-e', `${key.toUpperCase()}_LABEL=${label}`]),
    ...Object.entries(seeded.rehearsals).flatMap(([key, id]) => ['-e', `${key.toUpperCase()}_REHEARSAL=${id}`])];
  return variables;
}

/** The flows to run, one file each, in the order Maestro ran the folder: by name. */
function flowFiles(given) {
  return (given.length ? given : [path.join(E2E, 'flows')]).flatMap((entry) => (fs.statSync(entry).isDirectory()
    ? fs.readdirSync(entry).filter((name) => /\.ya?ml$/.test(name) && name !== 'config.yaml').sort().map((name) => path.join(entry, name))
    : [entry]));
}

/** Maestro's name for a run's folder, which the supervisor's pruning looks for (YYYY-MM-DD_HHMMSS). */
function runStamp(at = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}_${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  await environment(async () => {
    assert.ok(fs.existsSync(MAESTRO), `Maestro is not installed at ${MAESTRO}`);
    if (PREBUILT) assert.ok(fs.existsSync(PREBUILT), `E2E_APP ${PREBUILT} does not exist`);
    lock = await takeLock(LOCK, { log: step });
    teardown.push(() => lock.release());
    teardown.push(keepLogs(Date.now()));
    await requireFree(API_PORT, 'server');
    await requireFree(MAIL_PORT, 'mailbox');
    await requireFree(METRO_PORT, 'Metro');
  });

  step('starting a disposable PostgreSQL');
  const databaseUrl = await environment(startDatabase);
  assertLocalDatabase(databaseUrl);

  step('provisioning the canonical schema');
  migrate(databaseUrl);

  step('starting the local server');
  let server = await startServer(databaseUrl);

  step('seeding');
  let day = await seedDay(databaseUrl);

  step('starting Metro, pointed at the local server');
  // Not CI mode: it turns the file watcher off, and an edit would never reach
  // the app. With no terminal attached Expo does not prompt anyway.
  const { CI: _ci, ...inherited } = process.env;
  background('metro', path.join(ROOT, 'node_modules', '.bin', 'expo'),
    ['start', '--port', String(METRO_PORT), '--clear', '--offline'], {
      cwd: ROOT,
      env: { ...inherited, EXPO_PUBLIC_API_URL: API_URL, EXPO_PUBLIC_E2E: '1', REHEARSLY_E2E: '1', EXPO_NO_TELEMETRY: '1' },
    });
  await waitFor('Metro', async () =>
    (await (await fetch(`http://localhost:${METRO_PORT}/status`)).text()).includes('packager-status:running'), 120000);

  // The app reads its API address from the bundle; it must be the local one
  // before the app is allowed to start. A dev bundle does not inline
  // EXPO_PUBLIC_ variables: the code reads them off a virtual env module, which
  // merges the .env files bundled with it over process.env, filled in the
  // prelude. Every value the bundle carries is checked, and no .env file may be
  // in it at all.
  step('checking the bundle talks to the local server');
  // A cold bundle (Metro starts with --clear) takes minutes under load; an
  // error in the app's code answers at once, so running out of time is the
  // machine's (75), not the change's.
  let bundle;
  try {
    bundle = await getText(`http://localhost:${METRO_PORT}/.expo/.virtual-metro-entry.bundle?platform=ios&dev=true&minify=false`,
      { deadlineMs: 30 * 60 * 1000 });
  } catch (error) {
    throw error.code === 'DEADLINE' ? new EnvironmentError(error.message) : error;
  }
  checkBundle(bundle);
  const udid = await environment(simulator);
  await environment(() => {
    step(`booting ${DEVICE.name} (${udid})`);
    simctl('bootstatus', udid, '-b');
    teardown.push(() => simctl('shutdown', udid));
    if (pinLocale(udid)) {
      step('switching it to English and rebooting');
      simctl('shutdown', udid);
      simctl('bootstatus', udid, '-b');
    }
    quietKeyboard(udid);
    pinZone(udid);
    showSimulator(udid);
  });

  if (!PREBUILT && (forceBuild || !fs.existsSync(APP))) {
    step('building the Debug app — the first build takes a while');
    const buildLog = fs.openSync(path.join(OUT, 'build.log'), 'w');
    execFileSync('xcodebuild', ['-workspace', 'ios/Rehearsly.xcworkspace', '-scheme', 'Rehearsly',
      '-configuration', 'Debug', '-sdk', 'iphonesimulator', '-destination', `id=${udid}`,
      '-derivedDataPath', BUILD, 'build'], {
      cwd: ROOT,
      env: { ...process.env, RCT_NO_LAUNCH_PACKAGER: '1' },
      stdio: ['ignore', buildLog, buildLog],
      timeout: 60 * 60 * 1000,
    });
  }
  simctl('install', udid, APP);
  watchReportedAddress(udid);

  if (stayUp) {
    step(`up. Simulator ${udid}; server ${API_URL}; seed in ${path.join(OUT, 'seed.json')}`);
    step(`password for every account: ${day.seeded.password}. Ctrl-C takes it all down.`);
    setInterval(() => {}, 1 << 30);
    await new Promise(() => {});
  }

  step('running the flows');
  // One folder for the run's artifacts, a flow's folder in it, as one Maestro
  // made it: the supervisor keeps the newest folder of a red run
  // (maestro-artifacts.txt) and from the reviewer's tree its failed flows'.
  const artifacts = path.join(OUT, 'artifacts', runStamp());
  const parts = path.join(OUT, 'junit-parts');
  fs.rmSync(parts, { recursive: true, force: true });
  fs.mkdirSync(parts, { recursive: true });
  const reports = [];
  const earlierTaps = [];
  const queue = flowFiles(flows);
  // The supervisor's clock started with this process (e2e/midnight.mjs).
  const deadline = performance.timeOrigin + limitMs(queue.length);
  for (let index = 0; index < queue.length;) {
    if (localDate(0) !== day.date) {
      step(`the day turned (${day.date} → ${localDate(0)}): a new database, server and seed for it`);
      await stopServer(server);
      earlierTaps.push(...tapsAgain());
      const url = await databaseFor(databaseUrl, localDate(0));
      migrate(url, { append: true });
      server = await startServer(url, { append: true });
      day = await seedDay(url);
    }
    const next = nextStep({ left: queue.length - index, deadline });
    if (next.stop) {
      throw new EnvironmentError(`midnight in ${Math.ceil(next.stop / 1000)} s, before a flow could end, and a wait for it `
        + `would outlast the supervisor's limit (${Math.round(limitMs(queue.length) / 1000)} s for ${queue.length} flows) — run it again after 00:00`);
    }
    if (next.wait) {
      step(`midnight in ${Math.ceil(next.wait / 1000)} s, before a flow could end: waiting for it`);
      await sleep(next.wait);
      continue;
    }
    const batch = queue.slice(index, index + next.take);
    index += batch.length;
    const report = path.join(parts, `${String(reports.length).padStart(3, '0')}.xml`);
    let code = 0;
    try {
      execFileSync(MAESTRO, ['--device', udid, 'test', ...batch, '--format', 'junit', '--output', report,
        '--test-output-dir', artifacts, ...variablesFor(day.seeded, udid)], { stdio: 'inherit', env: MAESTRO_ENV });
    } catch (error) {
      code = error.status ?? 1;
      flowsFailed = true;
      process.exitCode = 1;
    }
    flattenBatches(artifacts);
    reports.push({ files: batch.map((flow) => path.relative(ROOT, flow)), xml: fs.existsSync(report) ? fs.readFileSync(report, 'utf8') : null, code });
    // After every flow, so a run cut short still says what it ran.
    fs.writeFileSync(path.join(OUT, 'junit.xml'), mergeJunit(reports));
  }
  reportTapsAgain(earlierTaps);
}

/** The taps the server running now was told of; it starts its log afresh (server-with-mailbox.mjs). */
function tapsAgain() {
  const log = path.join(OUT, 'taps-again.log');
  return fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean) : [];
}

/**
 * The taps e2e/subflows/tap-and-see.yaml took a second time, its result not
 * on screen after the first: the simulator loses about one tap in 250 and
 * Maestro reports it done (docs/e2e.md, T-207). Printed every run, so how often
 * it happens stays in sight.
 */
function reportTapsAgain(earlier = []) {
  const lines = [...earlier, ...tapsAgain()];
  step(`taps taken again (tap-and-see.yaml): ${lines.length}`);
  for (const line of lines) step(`  ${line}`);
}

main()
  .catch((error) => {
    const machine = error instanceof EnvironmentError;
    const why = !machine ? '' : flowsFailed ? 'stopped, a flow had already failed (junit.xml): ' : 'not ready, not the change: ';
    console.error(`[e2e] ${why}${error.message}`);
    process.exitCode = exitCode({ failed: flowsFailed, error: machine ? 'machine' : 'error' });
  })
  .finally(tearDown);
