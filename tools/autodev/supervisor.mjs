#!/usr/bin/env node
/**
 * Continuous development: Claude Code develops, Codex ("Astra") reviews, and
 * this loop carries each task from the owner's queue through
 *
 *   develop → guard → checks → review (≤ 2 rounds) → push of auto/main
 *
 * and on through the next. What it does not do alone (owner, 2026-10-07/08):
 * migrations, data deletion, auth/security, production, keys — a task touching
 * them pauses, as do checks still red after three attempts and a reviewer not
 * satisfied after two rounds. A pause stops the whole queue: the next task
 * would be built on top of it.
 *
 * A subscription limit is waited out, not failed on: the reset time is read off
 * what the agent said (lib/limits.mjs), the loop sleeps until then and
 * continues the same session — `claude -p --resume`, `codex exec resume`.
 * State is on disk, so a crash, a reboot or launchd's restart carries on too.
 *
 * The owner's folder, AUTODEV/ (not in git):
 *   TASKS.md      the queue — "## T-001 Title" and what to do
 *   DECISIONS.md  for a paused task: "T-001: продолжить" or "T-001: пропустить"
 *   STATUS.md     what is happening now
 *   reports/      one file per task, T-001-<name>.md
 *   reviews/      Astra's answers, T-001-r1.md
 *   STOP          while this file exists, nothing starts
 *
 *   node tools/autodev/supervisor.mjs            run (launchd keeps it running)
 *   node tools/autodev/supervisor.mjs --once     one step, then exit
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runClaude, runCodex } from './lib/agents.mjs';
import { runChecks } from './lib/checks.mjs';
import { parseDiff, pauseReasons } from './lib/guard.mjs';
import { waitFor } from './lib/limits.mjs';
import * as P from './lib/prompts.mjs';
import { appendReport, loadState, parseDecisions, parseTasks, saveState, writeAtomic } from './lib/store.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const DIR = path.join(REPO, 'AUTODEV');
const STATE_DIR = path.join(DIR, '.state');
const STATE = path.join(STATE_DIR, 'state.json');
const LOGS = path.join(STATE_DIR, 'logs');
const WORKTREE = path.resolve(REPO, '..', 'reh_app-auto');
const REVIEW_TREE = path.resolve(REPO, '..', 'reh_app-auto-review');
const BRANCH = 'auto/main';
const START_FROM = process.env.AUTODEV_START_FROM || 'claude/systematic-repair';
const NODE = process.execPath;
const HOME = os.homedir();
const CLAUDE = process.env.CLAUDE_BIN || `${HOME}/.nvm/versions/node/v20.19.2/bin/claude`;
const CODEX = process.env.CODEX_BIN || `${HOME}/.nvm/versions/node/v20.19.2/bin/codex`;
const E2E_APP = path.join(REPO, 'rehearsal-calendar-native/e2e/.build/Build/Products/Debug-iphonesimulator/Rehearsly.app');
const MAX_CHECK_ATTEMPTS = 3;
const MAX_AGENT_FAILURES = 3;
const IDLE_MS = 5 * 60 * 1000;
const once = process.argv.includes('--once');

// The children get a plain environment: the tools they need on PATH, nothing
// else inherited — no stray credentials from whoever started this.
const ENV = {
  PATH: [path.dirname(NODE), `${HOME}/.nvm/versions/node/v20.19.2/bin`, `${HOME}/.maestro/bin`,
    '/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'].join(':'),
  HOME, USER: os.userInfo().username, LANG: 'en_US.UTF-8', TMPDIR: os.tmpdir(),
  E2E_APP,
  MAESTRO_CLI_NO_ANALYTICS: '1',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const stamp = () => new Date().toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', env: ENV, maxBuffer: 64 * 1024 * 1024 }).trim();

let tasksById = {};
const events = [];

// ---- what the owner reads ---------------------------------------------------

function reportFile(task) { return path.join(DIR, 'reports', `${task.id}-${task.slug}.md`); }

function note(task, text) {
  const line = `- ${stamp()} — ${text}`;
  events.push(`${task ? `${task.id}: ` : ''}${text}`);
  if (events.length > 15) events.shift();
  if (task) {
    const file = reportFile(task);
    if (!fs.existsSync(file)) appendReport(file, `# ${task.id} ${task.title}\n\n${task.body}\n\n## Ход\n`);
    appendReport(file, line);
  }
  console.log(`[autodev] ${task ? `${task.id} ` : ''}${text}`);
}

function writeStatus(state, now) {
  const task = state.current ? state.tasks[state.current] : null;
  const lines = [`# Автономная разработка — ${stamp()}`, ''];
  if (fs.existsSync(path.join(DIR, 'STOP'))) lines.push('**Остановлено:** есть файл AUTODEV/STOP.');
  const paused = Object.entries(state.tasks).find(([, t]) => t.phase === 'paused');
  if (paused) lines.push(`**ПАУЗА — ждёт решения владельца.** ${paused[0]}: ${paused[1].pauseReason}`, '',
    `Решение — строкой в AUTODEV/DECISIONS.md: \`${paused[0]}: продолжить\` или \`${paused[0]}: пропустить\`.`);
  if (state.waitUntil && Date.now() < state.waitUntil) {
    lines.push(`**Ждём сброса лимита ${state.waitingFor}** до ${new Date(state.waitUntil).toLocaleString('ru-RU')}; потом продолжим ту же сессию.`);
  }
  if (task) lines.push(`Сейчас: **${state.current}** ${tasksById[state.current]?.title ?? ''} — фаза ${task.phase}${task.round ? `, ревью круг ${task.round}` : ''}.`);
  else if (!paused) lines.push(now ?? 'Очередь пуста.');
  lines.push('', '## Последнее', '', ...events.map((e) => `- ${e}`));
  const done = Object.entries(state.tasks).filter(([, t]) => t.phase === 'done' || t.phase === 'skipped');
  if (done.length) lines.push('', '## Завершено', '', ...done.map(([id, t]) => `- ${id}: ${t.phase === 'done' ? 'готово' : 'пропущено'}`));
  writeAtomic(path.join(DIR, 'STATUS.md'), `${lines.join('\n')}\n`);
}

// ---- the trees it works in --------------------------------------------------

function ensureTrees() {
  if (!fs.existsSync(WORKTREE)) {
    const exists = (() => { try { git(REPO, 'rev-parse', '--verify', BRANCH); return true; } catch { return false; } })();
    if (exists) git(REPO, 'worktree', 'add', WORKTREE, BRANCH);
    else git(REPO, 'worktree', 'add', '-b', BRANCH, WORKTREE, START_FROM);
  }
  if (!fs.existsSync(REVIEW_TREE)) git(REPO, 'worktree', 'add', '--detach', REVIEW_TREE, BRANCH);
  // Dependencies are the main tree's: the same lockfile, no second install.
  for (const tree of [WORKTREE, REVIEW_TREE]) {
    for (const rel of ['rehearsal-calendar-native/node_modules', 'rehearsal-calendar-native/server/node_modules']) {
      const link = path.join(tree, rel);
      if (!fs.existsSync(link)) fs.symlinkSync(path.join(REPO, rel), link);
    }
  }
}

function singleInstance() {
  const pidFile = path.join(STATE_DIR, 'supervisor.pid');
  fs.mkdirSync(STATE_DIR, { recursive: true });
  try {
    const other = Number(fs.readFileSync(pidFile, 'utf8'));
    if (other && other !== process.pid) {
      try { process.kill(other, 0); console.error(`[autodev] already running (pid ${other})`); process.exit(0); } catch { /* stale */ }
    }
  } catch { /* none */ }
  fs.writeFileSync(pidFile, String(process.pid));
}

// ---- one task's steps --------------------------------------------------------

function pause(state, task, t, reason) {
  t.pausedFrom = t.phase;
  t.phase = 'paused';
  t.pauseReason = reason;
  state.current = null;
  note(task, `ПАУЗА: ${reason}. Решение — в AUTODEV/DECISIONS.md.`);
}

function waitOut(state, task, who, limit) {
  state.waitUntil = Date.now() + waitFor(limit);
  state.waitingFor = who;
  note(task, `лимит ${who}${limit.known ? `, сброс в ${limit.at.toLocaleString('ru-RU')}` : ', время сброса не прочитано — проверим через 20 минут'}; продолжим ту же сессию`);
}

async function develop(state, task, t) {
  const fresh = !t.claudeSession;
  if (fresh) { t.claudeSession = randomUUID(); note(task, 'разработка: начата'); }
  const prompt = fresh ? P.developTask(task) : (t.pending ?? P.CONTINUE);
  const run = await runClaude({
    bin: CLAUDE, cwd: WORKTREE, prompt, env: ENV,
    sessionId: fresh ? t.claudeSession : undefined,
    resume: fresh ? undefined : t.claudeSession,
    settingsFile: path.join(HERE, 'claude-settings.json'),
    log: path.join(LOGS, `${task.id}-claude.jsonl`),
    timeoutMs: 3 * 60 * 60 * 1000,
  });
  if (run.sessionId) t.claudeSession = run.sessionId;
  if (run.limit.limited) { t.pending = P.CONTINUE; return waitOut(state, task, 'Claude', run.limit); }
  const result = P.readResult(run.text);
  if (run.failed || !result) {
    t.failures = (t.failures ?? 0) + 1;
    t.pending = P.CONTINUE;
    note(task, `разработка: ${run.failed ? `сбой (код ${run.exit})` : 'ответ без строки RESULT'}, попытка ${t.failures}`);
    if (t.failures >= MAX_AGENT_FAILURES) pause(state, task, t, 'разработчик трижды не дал ответа');
    return;
  }
  t.failures = 0;
  t.pending = null;
  if (result.blocked) return pause(state, task, t, `разработчик остановился: ${result.reason}`);
  t.devReport = run.text;
  t.phase = 'check';
  note(task, 'разработка: готово');
}

async function check(state, task, t) {
  const head = git(WORKTREE, 'rev-parse', 'HEAD');
  if (head === t.base) return pause(state, task, t, 'разработчик ответил DONE, но коммитов нет');
  const { files, added } = parseDiff(git(WORKTREE, 'diff', '--unified=0', `${t.base}..${head}`));
  const reasons = pauseReasons(files, added);
  if (reasons.length && t.approvedHead !== head) {
    return pause(state, task, t, `изменение требует решения владельца — ${reasons.join('; ')}`);
  }
  note(task, `проверки: запущены (${files.length} файлов)`);
  const checks = await runChecks({ root: WORKTREE, changedFiles: files, node: NODE, log: path.join(LOGS, `${task.id}-checks.log`), env: ENV });
  t.checks = { head, ok: checks.ok, steps: checks.steps.map(({ name, ok, code }) => ({ name, ok, code })) };
  note(task, `проверки: ${checks.steps.map((s) => `${s.name} ${s.ok ? 'PASS' : 'FAIL'}`).join(', ')}`);
  if (checks.ok) { t.head = head; t.phase = 'review'; t.round = t.round || 1; return; }
  t.attempts = (t.attempts ?? 0) + 1;
  if (t.attempts >= MAX_CHECK_ATTEMPTS) return pause(state, task, t, `проверки красные после ${MAX_CHECK_ATTEMPTS} попыток`);
  t.pending = P.fixChecks(task, checks.steps);
  t.phase = 'develop';
}

async function review(state, task, t) {
  git(REVIEW_TREE, 'checkout', '--detach', '--quiet', t.head);
  const round = t.round;
  const continuing = Boolean(t.reviewPending && t.codexThread);
  const prompt = continuing ? P.REVIEW_CONTINUE
    : P.review(task, { base: t.base, head: t.head, devReport: t.devReport ?? '', checks: t.checks, round });
  if (!continuing) note(task, `ревью: круг ${round}`);
  const lastMessageFile = path.join(STATE_DIR, `${task.id}-codex-last.md`);
  const run = await runCodex({
    bin: CODEX, cwd: REVIEW_TREE, prompt, env: ENV, lastMessageFile,
    // Round two continues the reviewer's own thread, so it remembers round one.
    resume: continuing || round > 1 ? t.codexThread : undefined,
    sandbox: 'workspace-write', addDirs: ['/private/tmp'],
    log: path.join(LOGS, `${task.id}-codex.jsonl`),
    timeoutMs: 3 * 60 * 60 * 1000,
  });
  if (run.threadId) t.codexThread = run.threadId;
  if (run.limit.limited) { t.reviewPending = true; return waitOut(state, task, 'Codex', run.limit); }
  const verdict = P.readVerdict(run.text);
  if (run.failed || !verdict) {
    t.failures = (t.failures ?? 0) + 1;
    t.reviewPending = Boolean(t.codexThread);
    note(task, `ревью: ${run.failed ? `сбой (код ${run.exit})` : 'ответ без строки VERDICT'}, попытка ${t.failures}`);
    if (t.failures >= MAX_AGENT_FAILURES) pause(state, task, t, 'ревьюер трижды не дал ответа');
    return;
  }
  t.failures = 0;
  t.reviewPending = false;
  const file = path.join(DIR, 'reviews', `${task.id}-r${round}.md`);
  writeAtomic(file, run.text);
  note(task, `ревью круг ${round}: ${verdict === 'accept' ? 'принято' : 'есть замечания'} — reviews/${path.basename(file)}`);
  if (verdict === 'accept') { t.phase = 'push'; return; }
  if (round >= 2) return pause(state, task, t, 'нет согласия с ревьюером после двух кругов');
  t.round = 2;
  t.attempts = 0;
  t.pending = P.fixReview(task, run.text);
  t.phase = 'develop';
}

function push(state, task, t) {
  try {
    git(WORKTREE, 'push', '--quiet', '-u', 'origin', BRANCH);
    note(task, `готово: ${t.base.slice(0, 7)}..${t.head.slice(0, 7)} в ${BRANCH}, отправлено`);
  } catch (error) {
    // Nothing is lost: the commits are on the branch and the next push takes them.
    note(task, `готово, но push не прошёл: ${String(error.message).split('\n')[0]}`);
  }
  appendReport(reportFile(task), `\n## Итог\n\n${t.devReport ?? ''}\n\nРевью: reviews/${task.id}-r${t.round}.md — принято.\n`);
  t.phase = 'done';
  t.finishedAt = new Date().toISOString();
  state.current = null;
}

// ---- the loop ----------------------------------------------------------------

function applyDecisions(state) {
  let text = '';
  try { text = fs.readFileSync(path.join(DIR, 'DECISIONS.md'), 'utf8'); } catch { return; }
  for (const [id, decision] of Object.entries(parseDecisions(text))) {
    const t = state.tasks[id];
    if (!t || t.phase !== 'paused') continue;
    const task = tasksById[id] ?? { id, slug: 'task', title: id, body: '' };
    if (decision === 'skip') { t.phase = 'skipped'; note(task, 'владелец: пропустить'); continue; }
    t.phase = t.pausedFrom === 'check' ? 'check' : t.pausedFrom;
    if (t.pausedFrom === 'check') t.approvedHead = git(WORKTREE, 'rev-parse', 'HEAD');
    t.attempts = 0;
    t.failures = 0;
    if (t.pausedFrom === 'review') t.round = 1; // two more rounds
    delete t.pauseReason;
    state.current = id;
    note(task, 'владелец: продолжить');
  }
}

async function step() {
  const state = loadState(STATE);
  let queue = [];
  try { queue = parseTasks(fs.readFileSync(path.join(DIR, 'TASKS.md'), 'utf8')); } catch { /* no queue yet */ }
  tasksById = Object.fromEntries(queue.map((task) => [task.id, task]));
  applyDecisions(state);

  if (fs.existsSync(path.join(DIR, 'STOP'))) { saveState(STATE, state); writeStatus(state); return IDLE_MS; }
  if (state.waitUntil && Date.now() < state.waitUntil) { saveState(STATE, state); writeStatus(state); return Math.min(state.waitUntil - Date.now(), IDLE_MS); }
  state.waitUntil = null;
  if (Object.values(state.tasks).some((t) => t.phase === 'paused')) { saveState(STATE, state); writeStatus(state); return IDLE_MS; }

  if (!state.current) {
    const next = queue.find((task) => !state.tasks[task.id] || !['done', 'skipped'].includes(state.tasks[task.id].phase));
    if (!next) { saveState(STATE, state); writeStatus(state, 'Очередь пуста — добавь задачи в AUTODEV/TASKS.md.'); return IDLE_MS; }
    state.current = next.id;
    state.tasks[next.id] ??= { phase: 'develop', base: git(WORKTREE, 'rev-parse', 'HEAD'), startedAt: new Date().toISOString() };
  }
  const task = tasksById[state.current];
  const t = state.tasks[state.current];
  if (!task) { note(null, `задачи ${state.current} больше нет в TASKS.md — пропускаю`); t.phase = 'skipped'; state.current = null; saveState(STATE, state); return 0; }

  writeStatus(state);
  saveState(STATE, state); // what is about to run is on disk before it runs
  if (t.phase === 'develop') await develop(state, task, t);
  else if (t.phase === 'check') await check(state, task, t);
  else if (t.phase === 'review') await review(state, task, t);
  else if (t.phase === 'push') push(state, task, t);
  saveState(STATE, state);
  writeStatus(state);
  return 0;
}

async function main() {
  fs.mkdirSync(LOGS, { recursive: true });
  singleInstance();
  ensureTrees();
  for (;;) {
    let pauseMs;
    try {
      pauseMs = await step();
    } catch (error) {
      note(null, `ошибка супервизора: ${String(error.stack || error).split('\n').slice(0, 3).join(' | ')}`);
      pauseMs = 60 * 1000;
    }
    if (once) break;
    if (pauseMs) await sleep(pauseMs);
  }
}

main();
