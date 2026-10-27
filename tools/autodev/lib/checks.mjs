/**
 * The mechanical checks, run by the supervisor itself — not asked of an
 * agent, so a green result means the commands ran and passed:
 *
 * - always: secrets scan, type check, every Jest suite;
 * - the app or its flows changed: the e2e flows (local only, see e2e/run.mjs);
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

function countFlows(app) {
  try { return fs.readdirSync(path.join(app, 'e2e', 'flows')).filter((f) => f.endsWith('.yaml')).length; } catch { return 0; }
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
 * @param root the worktree
 * @returns {{ok: boolean, steps: {name, ok, code, tail, environment?}[]}}
 */
export async function runChecks({ root, changedFiles, node, log, env, e2eLimit }) {
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
    const step = await run('e2e', node, ['e2e/run.mjs'], opts(e2eLimit ?? e2eLimitMs(countFlows(app))));
    step.environment = step.code === E2E_NOT_READY;
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
