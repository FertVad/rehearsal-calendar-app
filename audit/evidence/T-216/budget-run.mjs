// T-216: runs the stages of `npm test -- --silent` (server/scripts/test.mjs all)
// one after another under autodev's limit of 20 min for the "tests" check, and
// stops the stage that crosses it, as autodev does.
//
// A shell call here may not last 10 min, so the run goes on over several calls:
// the state (time used, next stage) is kept in /tmp/t216/<label>.json and each
// call starts stages only while it has used less than 4 min. Only the stages'
// own time counts against the limit. Jest runs as six --shard=i/6 processes
// with --maxWorkers=1, together the same 191 files as one process; each
// shard builds its first worker anew, as the single run does every time Jest
// replaces a worker past 512 MB.
//
//   node audit/evidence/T-216/budget-run.mjs <label> [--reset]
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIMIT_MS = 20 * 60 * 1000;
const CALL_START_BUDGET_MS = 4 * 60 * 1000;
const CALL_HARD_MS = 9 * 60 * 1000;
const SHARDS = 6;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const app = join(root, 'rehearsal-calendar-native');
const server = join(app, 'server');
const node = process.execPath;
const jest = join(app, 'node_modules/jest/bin/jest');

const stages = [
  { name: 'secret scanner', cwd: app, args: ['--test', 'scripts/__tests__/check-secrets.test.mjs'] },
  { name: 'e2e lock', cwd: app, args: ['--test', 'e2e/__tests__/lock.test.mjs', 'e2e/__tests__/watchdog.test.mjs',
    'e2e/__tests__/http.test.mjs', 'e2e/__tests__/metro-watch.test.mjs'] },
  { name: 'browser install', cwd: app, args: ['server/scripts/test.mjs', 'install'] },
  ...Array.from({ length: SHARDS }, (_, i) => ({
    name: `jest ${i + 1}/${SHARDS}`, cwd: app, env: { ADMIN_BROWSER_CHECK: '0' },
    args: ['--experimental-vm-modules', jest, '--maxWorkers=1', '--silent', `--shard=${i + 1}/${SHARDS}`],
  })),
  { name: 'admin DOM/CSP', cwd: server, args: ['--test', '__tests__/browser/ownedFixture.test.mjs',
    '__tests__/browser/adminDashboard.browser.test.mjs'] },
  { name: 'admin errors', cwd: server, args: ['--test', '__tests__/browser/adminFailures.browser.test.mjs'] },
  { name: 'invite', cwd: server, args: ['--test', '__tests__/browser/invitePage.browser.test.mjs'] },
  { name: 'stored content', cwd: server, env: { ADMIN_BROWSER_CHECK: '1' },
    args: ['--experimental-vm-modules', join(server, 'node_modules/jest/bin/jest'), '--runInBand',
      '--runTestsByPath', '__tests__/integration/adminStoredContent.test.js'] },
];

const [label, flag] = process.argv.slice(2);
if (!label) throw new Error('usage: budget-run.mjs <label> [--reset]');
mkdirSync('/tmp/t216', { recursive: true });
const statePath = `/tmp/t216/${label}.json`;
const logPath = `/tmp/t216/${label}.log`;
const state = flag === '--reset' || !existsSync(statePath)
  ? { label, limitMs: LIMIT_MS, usedMs: 0, next: 0, done: false, results: [] }
  : JSON.parse(readFileSync(statePath, 'utf8'));
const save = () => writeFileSync(statePath, JSON.stringify(state, null, 2));
const say = line => { console.log(line); appendFileSync(logPath, `${line}\n`); };
const secs = ms => (ms / 1000).toFixed(1);

function run(stage, timeoutMs) {
  return new Promise(done => {
    const started = Date.now();
    const child = spawn(node, stage.args, { cwd: stage.cwd, env: { ...process.env, ...stage.env }, detached: true });
    let tail = '';
    const keep = chunk => {
      appendFileSync(logPath, chunk);
      tail = (tail + chunk).slice(-20000);
    };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    let stopped = false;
    const timer = setTimeout(() => {
      stopped = true;
      try { process.kill(-child.pid, 'SIGTERM'); } catch {}
      setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }, 5000).unref();
    }, timeoutMs);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const summary = tail.split('\n').filter(l =>
        /^(Test Suites|Tests|Time):|^# (tests|pass|fail) |^FAIL /.test(l)).join('\n');
      done({ code, signal, stopped, ms: Date.now() - started, summary });
    });
  });
}

const callStart = Date.now();
if (state.done) say(`[budget] ${label}: already finished, used ${secs(state.usedMs)} s`);
while (!state.done && state.next < stages.length && Date.now() - callStart < CALL_START_BUDGET_MS) {
  const stage = stages[state.next];
  const leftMs = state.limitMs - state.usedMs;
  const callLeftMs = CALL_HARD_MS - (Date.now() - callStart);
  say(`[budget] ${label}: stage "${stage.name}" starts, used ${secs(state.usedMs)} s of ${secs(state.limitMs)} s`);
  const result = await run(stage, Math.min(leftMs, callLeftMs));
  if (result.stopped && leftMs > callLeftMs) {
    say(`[budget] ${label}: stage "${stage.name}" outlived this call (${secs(result.ms)} s); not counted, run again`);
    process.exitCode = 2;
    break;
  }
  state.usedMs += result.ms;
  state.results.push({ stage: stage.name, seconds: Number(secs(result.ms)), code: result.code, stoppedByLimit: result.stopped });
  if (result.summary) say(result.summary);
  if (result.stopped) {
    state.done = true;
    say(`[budget] ${label}: stage "${stage.name}" stopped after ${secs(result.ms)} s: the run passed the 20 min limit ` +
      `(${secs(state.usedMs)} s used, code null), as autodev's "не уложились в лимит 20 мин"`);
  } else {
    say(`[budget] ${label}: stage "${stage.name}" ended, code ${result.code}, ${secs(result.ms)} s; ` +
      `used ${secs(state.usedMs)} s of ${secs(state.limitMs)} s`);
    state.next += 1;
    if (state.next === stages.length) {
      state.done = true;
      say(`[budget] ${label}: every stage ran within the limit: ${secs(state.usedMs)} s of ${secs(state.limitMs)} s`);
    }
  }
  save();
}
save();
