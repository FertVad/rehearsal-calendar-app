/**
 * The mechanical checks, run by the supervisor itself — not asked of an
 * agent, so a green result means the commands ran and passed:
 *
 * - always: secrets scan, type check, every Jest suite;
 * - the app or its flows changed: the task's e2e flows (local only, see
 *   e2e/run.mjs) — the whole set runs at night (supervisor, fullE2e);
 * - the server changed: the PostgreSQL harness on a throwaway database.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { isFailureLine } from './flakes.mjs';

const TAIL_LINES = 80;
// e2e/run.mjs: the machine was not ready — not the change (docs/e2e.md).
const E2E_NOT_READY = 75;

// A fixed e2e limit was outgrown: on 26.10.2026 "34/34 Flows Passed in 45m
// 55s" was killed at 45 minutes and called red, and T-120 and T-121 were sent
// to fix flows that passed. The limit is the setup plus an allowance per flow,
// so it grows with the suite.
const E2E_SETUP_MS = 10 * 60 * 1000;
const E2E_PER_FLOW_MS = 150 * 1000;

/** How long an e2e run of `flowCount` flows may take. */
export function e2eLimitMs(flowCount) {
  return E2E_SETUP_MS + flowCount * E2E_PER_FLOW_MS;
}

const FLOWS = 'e2e/flows';
const APP = 'rehearsal-calendar-native/';
/** Run when a change touches the app and none of the flows: it starts, and somebody signs in. */
export const SMOKE_FLOW = `${FLOWS}/01-login.yaml`;

function listFlows(app) {
  try { return fs.readdirSync(path.join(app, FLOWS)).filter((f) => f.endsWith('.yaml')).sort().map((f) => `${FLOWS}/${f}`); } catch { return []; }
}

const readText = (file) => { try { return fs.readFileSync(file, 'utf8'); } catch { return ''; } };
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The flows that check a task (owner, 27.10.2026: the task's flows on each
 * task, the whole set at night — 37 flows took 46 minutes a run): those it
 * changed, those running a subflow or script it changed — directly or
 * through another subflow — and those its text names as e2e/flows/<file>.
 * None of them, the sign-in flow. Paths relative to the app; empty when the
 * tree has no flows, and e2e/run.mjs then runs whatever it finds.
 */
export function e2eFlowsFor({ app, changedFiles, taskText = '' }) {
  const all = listFlows(app);
  if (!all.length) return [];
  const changed = changedFiles.filter((f) => f.startsWith(APP)).map((f) => f.slice(APP.length));
  const picked = new Set(changed.filter((f) => all.includes(f)));
  const helpers = new Set(changed.filter((f) => /^e2e\/(subflows\/[^/]+\.yaml|scripts\/[^/]+\.js)$/.test(f)).map((f) => path.basename(f)));
  // Flows say `file: ../subflows/sign-in.yaml`, subflows `file: sign-in-form.yaml`.
  const uses = (text) => [...helpers].some((name) => new RegExp(`file:\\s*(\\S*/)?${escape(name)}\\s*$`, 'm').test(text));
  let subflows = [];
  try { subflows = fs.readdirSync(path.join(app, 'e2e', 'subflows')).filter((f) => f.endsWith('.yaml')); } catch { /* none */ }
  for (let grew = helpers.size > 0; grew;) {
    grew = false;
    for (const name of subflows) {
      if (!helpers.has(name) && uses(readText(path.join(app, 'e2e', 'subflows', name)))) { helpers.add(name); grew = true; }
    }
  }
  if (helpers.size) for (const flow of all) if (uses(readText(path.join(app, flow)))) picked.add(flow);
  for (const [name] of taskText.matchAll(/e2e\/flows\/[\w.-]+\.yaml/g)) if (all.includes(name)) picked.add(name);
  if (!picked.size && all.includes(SMOKE_FLOW)) picked.add(SMOKE_FLOW);
  return all.filter((flow) => picked.has(flow));
}

/** The flows a Maestro JUnit report says failed: `{ file, name }`, file relative to the app. */
export function failedFlows(junitXml) {
  const failed = [];
  for (const [attrs] of String(junitXml).matchAll(/<testcase\b[^>]*>/g)) {
    const attr = (key) => new RegExp(`\\b${key}="([^"]*)"`).exec(attrs)?.[1];
    if (attr('status') && attr('status') !== 'SUCCESS') failed.push({ file: attr('file'), name: attr('name') });
  }
  return failed;
}

// Maestro keeps every run's screenshots under e2e/out/artifacts, about 0.9 GB
// for the whole set; by 27.10.2026 the developer's tree held 207 runs, 34 GB,
// with 8 GB left on the disk. The newest are kept, and those a kept red run
// (supervisor, keepFailedRun) still points at while it is recent. Kept red
// runs go after two weeks: what a task proved is in audit/evidence.
const KEEP_RUNS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
const KEEP_POINTED_MS = 3 * DAY_MS;
const KEEP_FAILED_MS = 14 * DAY_MS;

/** Removes old Maestro artifacts and kept red runs under `out` (an app's e2e/out); the paths removed, relative to it. */
export function pruneArtifacts(out, now = Date.now()) {
  const removed = [];
  const keep = new Set();
  let kept = [];
  try { kept = fs.readdirSync(path.join(out, 'failed')); } catch { /* none kept */ }
  for (const name of kept) {
    const dir = path.join(out, 'failed', name);
    let age;
    try { age = now - fs.statSync(dir).mtimeMs; } catch { continue; }
    if (age > KEEP_FAILED_MS) {
      fs.rmSync(dir, { recursive: true, force: true });
      removed.push(path.join('failed', name));
    } else if (age <= KEEP_POINTED_MS) {
      try { keep.add(path.basename(fs.readFileSync(path.join(dir, 'maestro-artifacts.txt'), 'utf8').trim())); } catch { /* none named */ }
    }
  }
  let runs = [];
  try { runs = fs.readdirSync(path.join(out, 'artifacts')).sort(); } catch { return removed; }
  for (const run of runs.slice(-KEEP_RUNS)) keep.add(run);
  for (const run of runs.filter((name) => !keep.has(name))) {
    fs.rmSync(path.join(out, 'artifacts', run), { recursive: true, force: true });
    removed.push(path.join('artifacts', run));
  }
  return removed;
}

// Checks still running, stopped with the supervisor (stopChecks): the e2e
// run tears its environment down on SIGTERM.
const running = new Set();

export function stopChecks(signal = 'SIGTERM') {
  for (const child of running) child.kill(signal);
}

function run(name, command, args, { cwd, env, log, timeoutMs }) {
  return new Promise((resolve) => {
    const out = fs.createWriteStream(log, { flags: 'a' });
    out.write(`\n### ${new Date().toISOString()} ${name}: ${command} ${args.join(' ')}\n`);
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    running.add(child);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    const lines = [];
    // What failed, over the whole run: a Jest summary of three failures is
    // longer than the tail (T-202 was named after a fragment).
    const failures = [];
    // Output arrives in chunks that cut lines in two; a line is whole only at
    // its newline.
    let partial = '';
    const add = (line) => {
      lines.push(line);
      if (isFailureLine(line) && failures.length < 200) failures.push(line);
    };
    const keep = (chunk) => {
      out.write(chunk);
      const parts = (partial + String(chunk)).split('\n');
      partial = parts.pop();
      parts.forEach(add);
      if (lines.length > TAIL_LINES * 4) lines.splice(0, lines.length - TAIL_LINES * 2);
    };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    // Stopped by its limit is neither passed — e2e/run.mjs tears down and may
    // exit 0 — nor a failure of the change, and the tail says which it was.
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, timeoutMs);
    child.on('close', (code, signal) => {
      running.delete(child);
      clearTimeout(timer);
      if (partial) add(partial);
      if (timedOut) {
        const note = `[autodev] ${name}: не уложились в лимит ${Math.round(timeoutMs / 60000)} мин — остановлено по времени, это не результат проверки`;
        add(note);
        out.write(`${note}\n`);
      }
      out.end();
      resolve({ name, ok: code === 0 && !timedOut, code, signal, timedOut, tail: lines.slice(-TAIL_LINES).join('\n'), failures });
    });
  });
}

/** Which checks a change calls for, from the files it touched. */
export function checksFor(changedFiles) {
  const app = changedFiles.some((f) => /^rehearsal-calendar-native\/(src\/|e2e\/|index\.ts$|App\.tsx$|metro\.config\.js$|package\.json$)/.test(f));
  const server = changedFiles.some((f) => f.startsWith('rehearsal-calendar-native/server/'));
  return { full: true, e2e: app, postgres: server };
}

/**
 * One e2e run of `flows` (relative to the app; none — the whole set) in the
 * tree `root`, after old artifacts are cleared.
 */
export async function runE2e({ root, node, log, env, flows = [], limitMs }) {
  const app = path.join(root, 'rehearsal-calendar-native');
  pruneArtifacts(path.join(app, 'e2e', 'out'));
  const count = flows.length || listFlows(app).length;
  const step = await run('e2e', node, ['e2e/run.mjs', ...flows], { cwd: app, env, log, timeoutMs: limitMs ?? e2eLimitMs(count) });
  step.environment = step.code === E2E_NOT_READY;
  step.flows = flows.length ? flows : listFlows(app);
  return step;
}

/**
 * @param root the worktree
 * @param taskText the task's statement, for the flows it names
 * @returns {{ok: boolean, steps: {name, ok, code, tail, environment?, flows?}[]}}
 */
export async function runChecks({ root, changedFiles, taskText, node, log, env, e2eLimit }) {
  const app = path.join(root, 'rehearsal-calendar-native');
  const want = checksFor(changedFiles);
  const steps = [];
  const opts = (timeoutMs) => ({ cwd: app, env, log, timeoutMs });
  const npm = path.join(path.dirname(node), 'npm');

  for (const [name, args] of [
    ['secrets', ['run', 'check:secrets']],
    ['type-check', ['run', 'type-check']],
    ['tests', ['test', '--', '--silent']],
  ]) {
    const step = await run(name, npm, args, opts(20 * 60 * 1000));
    steps.push(step);
    if (!step.ok) return { ok: false, steps };
  }
  if (want.e2e) {
    const flows = e2eFlowsFor({ app, changedFiles, taskText });
    const step = await runE2e({ root, node, log, env, flows, limitMs: e2eLimit });
    steps.push(step);
    if (!step.ok) return { ok: false, steps };
  }
  if (want.postgres) {
    const step = await run('postgres', npm, ['--prefix', 'server', 'run', 'test:r0-postgres', '--', '--security-only'], opts(45 * 60 * 1000));
    steps.push(step);
    if (!step.ok) return { ok: false, steps };
  }
  return { ok: true, steps };
}
