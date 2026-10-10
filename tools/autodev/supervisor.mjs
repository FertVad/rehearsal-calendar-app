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
import { runClaude, runCodex, stopAgents } from './lib/agents.mjs';
import { runChecks } from './lib/checks.mjs';
import { parseDiff, pauseReasons } from './lib/guard.mjs';
import { waitFor } from './lib/limits.mjs';
import * as P from './lib/prompts.mjs';
import { appendReport, loadState, parseDecisions, parseTasks, saveState, writeAtomic } from './lib/store.mjs';
import { auditTasks, taskMarkdown } from './lib/audit.mjs';

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

// The developer answers once per run, in the foreground. A background job or
// a cron gave T-108's runs turns after the answer; auto-memory would carry one
// task's notes into the next.
const CLAUDE_ENV = {
  ...ENV,
  CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: '1',
  CLAUDE_CODE_DISABLE_CRON: '1',
  CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
};

/**
 * The model the owner chose for Claude (~/.claude/settings.json). The
 * developer runs without the owner's settings (agents.mjs), so the choice
 * would be lost with them: T-108 and T-109 ran on the CLI's default. Read on
 * every run, so a change there applies to the next one; only this key.
 */
function ownerModel() {
  try { return JSON.parse(fs.readFileSync(path.join(HOME, '.claude', 'settings.json'), 'utf8')).model || undefined; } catch { return undefined; }
}

/**
 * The newest Claude Code here: the VS Code extension's, which updates itself,
 * before the npm install, which stays at whatever version it was installed
 * (2.1.74, where "opus" still meant Opus 4.6). Looked up on every run — an
 * update removes the old folder. CLAUDE_BIN overrides.
 */
function claudeBin() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  const root = path.join(HOME, '.vscode', 'extensions');
  const version = (name) => (/^anthropic\.claude-code-(\d+)\.(\d+)\.(\d+)/.exec(name) ?? []).slice(1).map(Number);
  let names = [];
  try { names = fs.readdirSync(root).filter((name) => version(name).length === 3); } catch { /* no VS Code */ }
  names.sort((a, b) => {
    const [x, y] = [version(a), version(b)];
    return y[0] - x[0] || y[1] - x[1] || y[2] - x[2];
  });
  for (const name of names) {
    const bin = path.join(root, name, 'resources', 'native-binary', 'claude');
    if (fs.existsSync(bin)) return bin;
  }
  return `${HOME}/.nvm/versions/node/v20.19.2/bin/claude`;
}

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
  const deferred = Object.entries(state.tasks).filter(([, t]) => t.phase === 'deferred');
  if (deferred.length) lines.push('', '## Отложено (очередь шла дальше)', '', ...deferred.map(([id, t]) => `- ${id}: ${t.deferReason}. Начать заново — \`${id}: продолжить\`, на ревью с её коммитами — \`${id}: на ревью\` в DECISIONS.md.`));
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
  // Neither agent can push from its tree, whatever command it finds.
  git(REPO, 'config', 'extensions.worktreeConfig', 'true');
  git(WORKTREE, 'config', '--worktree', 'remote.origin.pushurl', 'disabled://the-developer-does-not-push');
  git(REVIEW_TREE, 'config', '--worktree', 'remote.origin.pushurl', 'disabled://the-reviewer-does-not-push');
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

/**
 * A task that could not be finished is set aside and the queue goes on
 * (owner, 2026-10-09): one stuck task must not stop the night's work. Its
 * commits leave auto/main — the next task is neither built on them nor checked
 * against their failures — and are kept on auto/deferred/<id>. Only what is
 * dangerous stops the whole queue (pause()).
 */
function defer(state, task, t, reason) {
  const kept = setAside(task, t, 'deferred');
  t.phase = 'deferred';
  t.deferReason = reason;
  state.current = null;
  note(task, `ОТЛОЖЕНО: ${reason}${kept}. Очередь идёт дальше. Вернуть — строкой «${task.id}: продолжить» в AUTODEV/DECISIONS.md.`);
}

/**
 * Takes a task's work off auto/main: its commits onto auto/<kind>/<id>, what
 * it left uncommitted into a stash, so the next task starts from a clean base.
 * A note for the report, or ''.
 */
function setAside(task, t, kind) {
  let kept = '';
  if (git(WORKTREE, 'status', '--porcelain')) {
    git(WORKTREE, 'stash', 'push', '--include-untracked', '--quiet', '-m', `autodev ${task.id}: незакоммиченное при «${kind}»`);
    kept += `; незакоммиченное — в git stash («autodev ${task.id}»)`;
  }
  const head = git(WORKTREE, 'rev-parse', 'HEAD');
  if (t.base && head !== t.base) {
    git(WORKTREE, 'branch', '-f', `auto/${kind}/${task.id}`, head);
    git(WORKTREE, 'reset', '--hard', '--quiet', t.base);
    kept += `; коммиты сохранены в auto/${kind}/${task.id}`;
  }
  return kept;
}

function waitOut(state, task, who, limit) {
  state.waitUntil = Date.now() + waitFor(limit);
  state.waitingFor = who;
  note(task, `лимит ${who}${limit.known ? `, сброс в ${limit.at.toLocaleString('ru-RU')}` : ', время сброса не прочитано — проверим через 20 минут'}; продолжим ту же сессию`);
}

const STEP_NOTE = {
  develop: 'начата',
  'fix-checks': 'исправление упавших проверок, новая сессия',
  'fix-review': 'исправление замечаний ревью, новая сессия',
};

/** A fresh session's statement: the task, its commits so far, this step's purpose. */
function stepPrompt(task, t) {
  const done = t.base ? git(WORKTREE, 'log', '--oneline', `${t.base}..HEAD`) : '';
  if (t.step?.kind === 'fix-checks') return P.fixChecks(task, t.step.steps, done);
  if (t.step?.kind === 'fix-review') return P.fixReview(task, t.step.review, done);
  return P.developTask(task, done);
}

/**
 * One step of development — the task, the red checks, the reviewer's notes —
 * is one session, started with the whole statement (prompts.mjs). It is
 * resumed only inside its step: after a limit, a crash, an answer missing its
 * marker; each time told the task again.
 */
async function develop(state, task, t) {
  const kind = t.step?.kind ?? 'develop';
  if (!t.claudeSession) {
    t.claudeSession = randomUUID();
    t.sessionStarted = false;
    t.followUp = null;
    note(task, `разработка: ${STEP_NOTE[kind]}`);
  }
  // The id is chosen here, so it is on disk before the session exists: a crash
  // or reboot mid-turn continues this session instead of starting another.
  const starting = t.sessionStarted === false;
  t.sessionStarted = true;
  saveState(STATE, state);
  const prompt = starting ? stepPrompt(task, t) : (t.followUp ?? P.continueStep(task, kind));
  const run = await runClaude({
    bin: claudeBin(), cwd: WORKTREE, prompt, env: CLAUDE_ENV, model: ownerModel(),
    sessionId: starting ? t.claudeSession : undefined,
    resume: starting ? undefined : t.claudeSession,
    settingsFile: path.join(HERE, 'claude-settings.json'),
    sandboxProfile: path.join(HERE, 'agent.sb'),
    log: path.join(LOGS, `${task.id}-claude.jsonl`),
    timeoutMs: 3 * 60 * 60 * 1000,
  });
  if (run.missingSession && !starting) {
    t.sessionStarted = false; // it never existed: start it next step
    note(task, 'разработка: сессии нет — начну её заново');
    return;
  }
  if (run.sessionId) t.claudeSession = run.sessionId;
  if (run.limit.limited) { t.followUp = P.continueStep(task, kind); return waitOut(state, task, 'Claude', run.limit); }
  const picked = P.pickResult(run.results);
  if (!picked.result) {
    t.failures = (t.failures ?? 0) + 1;
    // A run that ended normally without its marker is asked for it, not told
    // to "continue" — T-108 took that as leave to start the next fix.
    t.followUp = run.failed ? P.continueStep(task, kind) : P.missingMarker(task);
    note(task, `разработка: ${run.failed ? `сбой (код ${run.exit})` : 'ответ без строки RESULT'}, попытка ${t.failures}`);
    if (t.failures >= MAX_AGENT_FAILURES) defer(state, task, t, 'разработчик трижды не дал ответа');
    return;
  }
  const { result } = picked;
  // Stopped by a refused command is a tooling hitch, not the owner's decision:
  // sent back to carry on another way, and set aside after three.
  if (result.blocked && /don.?t.?ask|заблокирован|отклон|denied|permission|права/i.test(result.reason)) {
    t.failures = (t.failures ?? 0) + 1;
    t.followUp = P.refusedCommand(task, kind, result.reason);
    note(task, `разработка: остановился на отклонённой команде (${result.reason.slice(0, 120)}), попытка ${t.failures} — продолжать другим способом`);
    if (t.failures >= MAX_AGENT_FAILURES) defer(state, task, t, `разработчик трижды упирался в права: ${result.reason.slice(0, 120)}`);
    return;
  }
  if (result.blocked) {
    t.failures = 0;
    t.followUp = null;
    t.blockedReason = result.reason;
    return pause(state, task, t, `разработчик остановился: ${result.reason}`);
  }
  // Checked, reviewed and pushed is what is committed; nothing else may be in
  // the tree the checks run in.
  const leftovers = git(WORKTREE, 'status', '--porcelain');
  if (leftovers) {
    t.failures = (t.failures ?? 0) + 1;
    t.followUp = P.uncommitted(task, leftovers);
    note(task, `разработка: DONE, но остались незакоммиченные изменения, попытка ${t.failures}`);
    if (t.failures >= MAX_AGENT_FAILURES) defer(state, task, t, 'разработчик трижды оставлял незакоммиченные изменения');
    return;
  }
  t.failures = 0;
  t.followUp = null;
  t.devReport = picked.text;
  t.phase = 'check';
  note(task, 'разработка: готово');
}

/** The next development step: a session of its own, never the last one's. */
function nextStep(t, step) {
  t.step = step;
  t.claudeSession = null;
  t.sessionStarted = undefined;
  t.followUp = null;
  t.failures = 0;
  t.phase = 'develop';
}

async function check(state, task, t) {
  const head = git(WORKTREE, 'rev-parse', 'HEAD');
  if (head === t.base) return defer(state, task, t, 'разработчик ответил DONE, но коммитов нет');
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
  if (t.attempts >= MAX_CHECK_ATTEMPTS) {
    const red = checks.steps.filter((step) => !step.ok).map((step) => step.name).join(', ');
    return defer(state, task, t, `проверки красные после ${MAX_CHECK_ATTEMPTS} попыток (${red}), лог — .state/logs/${task.id}-checks.log`);
  }
  nextStep(t, { kind: 'fix-checks', steps: checks.steps.filter((step) => !step.ok) });
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
    if (t.failures >= MAX_AGENT_FAILURES) defer(state, task, t, 'ревьюер трижды не дал ответа');
    return;
  }
  t.failures = 0;
  t.reviewPending = false;
  const file = path.join(DIR, 'reviews', `${task.id}-r${round}.md`);
  writeAtomic(file, run.text);
  note(task, `ревью круг ${round}: ${verdict === 'accept' ? 'принято' : 'есть замечания'} — reviews/${path.basename(file)}`);
  if (verdict === 'accept') { t.phase = 'push'; return; }
  if (round >= 2) return defer(state, task, t, `нет согласия с ревьюером после двух кругов — reviews/${task.id}-r2.md`);
  t.round = 2;
  t.attempts = 0;
  nextStep(t, { kind: 'fix-review', review: run.text });
}

function push(state, task, t) {
  try {
    // The developer's tree has a dead push URL of its own (git config
    // --worktree), so a push by remote name goes nowhere; this one names the
    // real address outright.
    const url = git(REPO, 'remote', 'get-url', '--push', 'origin');
    git(WORKTREE, 'push', '--quiet', url, `${BRANCH}:${BRANCH}`);
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

/**
 * What lands on the interactive branch (claude/systematic-repair) — fixes to
 * tests, the audit, the docs — reaches auto/main at the start of each task.
 * Before the task's base is taken, so it is not part of the task's diff and
 * review. A conflict leaves the branch as it was and is reported.
 */
function syncFromInteractive() {
  try { git(WORKTREE, 'merge-base', '--is-ancestor', START_FROM, 'HEAD'); return; } catch { /* not yet in */ }
  try {
    git(WORKTREE, 'merge', '--no-edit', '--quiet', START_FROM);
    note(null, `в ${BRANCH} влиты новые коммиты из ${START_FROM}`);
  } catch (error) {
    try { git(WORKTREE, 'merge', '--abort'); } catch { /* nothing to abort */ }
    note(null, `не удалось влить ${START_FROM} (${String(error.message).split('\n')[0]}) — задача идёт без них`);
  }
}

/** Appends the audit's next open cause fix to TASKS.md; its id, or null. */
function fillFromAudit(queue, state) {
  const read = (rel) => fs.readFileSync(path.join(WORKTREE, rel), 'utf8');
  let candidates;
  try { candidates = auditTasks(read('audit/TRIAGE_R4_R9.md'), read('audit/REMEDIATION_STATUS.md')); } catch { return null; }
  const known = new Set([...queue.map((task) => task.id), ...Object.keys(state.tasks)]);
  const next = candidates.find((task) => !known.has(task.id));
  if (!next) return null;
  fs.appendFileSync(path.join(DIR, 'TASKS.md'), `\n${taskMarkdown(next)}`);
  return next.id;
}

function applyDecisions(state) {
  const file = path.join(DIR, 'DECISIONS.md');
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch { return; }
  const applied = [];
  for (const [id, decision] of Object.entries(parseDecisions(text))) {
    const t = state.tasks[id];
    if (!t || !['paused', 'deferred'].includes(t.phase)) continue;
    const task = tasksById[id] ?? { id, slug: 'task', title: id, body: '' };
    applied.push(id);
    if (decision.action === 'review') {
      if (t.phase === 'deferred') toReview(state, task, t, decision.commits);
      else note(task, '«на ревью» — только для отложенной задачи; решение не применено');
      continue;
    }
    if (t.phase === 'deferred') {
      if (decision.action === 'skip') { t.phase = 'skipped'; note(task, 'владелец: пропустить отложенную'); continue; }
      // Taken up again from the start, on top of what the branch has now.
      state.tasks[id] = { phase: 'develop', base: git(WORKTREE, 'rev-parse', 'HEAD'), startedAt: new Date().toISOString(), reopened: true };
      note(task, `владелец: продолжить — задача начата заново; прежняя работа в auto/deferred/${id}`);
      continue;
    }
    if (decision.action === 'skip') {
      // Skipped work leaves the branch — the next task is not built on it, nor
      // checked against its failing tests — but is kept on a branch of its own.
      const kept = setAside(task, t, 'skipped');
      note(task, `владелец: пропустить${kept}${kept ? `, ветка ${BRANCH} возвращена к ${t.base.slice(0, 7)}` : ''}`);
      t.phase = 'skipped';
      continue;
    }
    t.phase = t.pausedFrom === 'check' ? 'check' : t.pausedFrom;
    if (t.pausedFrom === 'check') t.approvedHead = git(WORKTREE, 'rev-parse', 'HEAD');
    t.attempts = 0;
    t.failures = 0;
    if (t.pausedFrom === 'review') t.round = 1; // two more rounds
    // Back to the session that stopped, told what the owner decided.
    if (t.pausedFrom === 'develop' && t.claudeSession) {
      t.followUp = P.ownerApproved(task, t.step?.kind ?? 'develop', t.blockedReason ?? t.pauseReason);
    }
    delete t.pauseReason;
    delete t.blockedReason;
    state.current = id;
    note(task, 'владелец: продолжить');
  }
  if (applied.length) consumeDecisions(file, text, applied);
}

/**
 * "T-108: на ревью [commits]": a deferred task goes back to the reviewer with
 * its own work instead of being started over. Only commits kept for it on
 * auto/deferred/<id> are taken — named ones in branch order, or all of them —
 * and they land on auto/main when the queue reaches the task (adopt()).
 */
function toReview(state, task, t, named) {
  const kept = `auto/deferred/${task.id}`;
  let commits;
  try {
    const all = git(WORKTREE, 'rev-list', '--reverse', `${t.base}..${kept}`).split('\n').filter(Boolean);
    const wanted = named.map((ref) => git(WORKTREE, 'rev-parse', '--verify', `${ref}^{commit}`));
    const foreign = wanted.filter((sha) => !all.includes(sha));
    if (foreign.length) throw new Error(`не из ${kept}: ${foreign.map((sha) => sha.slice(0, 7)).join(', ')}`);
    commits = wanted.length ? all.filter((sha) => wanted.includes(sha)) : all;
    if (!commits.length) throw new Error(`в ${kept} нет коммитов`);
  } catch (error) {
    note(task, `владелец: на ревью — не применено (${String(error.message).split('\n')[0]})`);
    return;
  }
  // Astra's thread and round are kept: she reviews the answer to her notes.
  state.tasks[task.id] = {
    phase: 'adopt', adopt: commits, adoptedFrom: kept, round: t.round ?? 1, codexThread: t.codexThread,
    devReport: t.devReport, startedAt: new Date().toISOString(),
  };
  note(task, `владелец: на ревью — ${commits.length} коммит(ов) из ${kept} (${commits.map((sha) => sha.slice(0, 7)).join(', ')}); возьму, когда очередь дойдёт`);
}

/** Puts a task's adopted commits on top of auto/main; then checks and review as usual. */
function adopt(state, task, t) {
  syncFromInteractive();
  t.base = git(WORKTREE, 'rev-parse', 'HEAD');
  try {
    for (const sha of t.adopt) git(WORKTREE, 'cherry-pick', '-x', sha);
  } catch (error) {
    try { git(WORKTREE, 'cherry-pick', '--abort'); } catch { /* nothing in progress */ }
    git(WORKTREE, 'reset', '--hard', '--quiet', t.base);
    t.phase = 'deferred';
    t.deferReason = `коммиты из ${t.adoptedFrom} не легли на ${BRANCH}: ${String(error.message).split('\n')[0]}`;
    state.current = null;
    return note(task, `ОТЛОЖЕНО: ${t.deferReason}`);
  }
  const log = git(WORKTREE, 'log', '--reverse', '--format=%h %s%n%n%b', `${t.base}..HEAD`);
  t.devReport = `Владелец вернул задачу на ревью с её коммитами из ${t.adoptedFrom}; остальное в той ветке в задачу не входит.

${log}${t.devReport ? `\n\nПрежний отчёт разработчика:\n\n${t.devReport}` : ''}`;
  t.phase = 'check';
  note(task, `перенесено в ${BRANCH}: ${t.adopt.length} коммит(ов); дальше проверки и ревью, круг ${t.round}`);
}

/** Applied lines move under "## Применено", so an old line never fires twice. */
function consumeDecisions(file, text, ids) {
  const [open, done = ''] = text.split(/^## Применено\s*$/m);
  const keep = [];
  const moved = [];
  for (const line of open.split('\n')) {
    const id = /^\s*[-*]?\s*(T-\d{3,})\s*:/.exec(line)?.[1];
    if (id && ids.includes(id)) moved.push(`- ${stamp()} — ${line.trim()}`);
    else keep.push(line);
  }
  writeAtomic(file, `${keep.join('\n').trimEnd()}\n\n## Применено\n${done.trimEnd() ? `${done.trimEnd()}\n` : '\n'}${moved.join('\n')}\n`);
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
    const pending = (q) => q.find((task) => !state.tasks[task.id] || !['done', 'skipped', 'deferred'].includes(state.tasks[task.id].phase));
    // The queue refills from the audit: the next cause fix not yet done, as
    // the developer's tree records it (owner, 2026-10-08).
    if (!pending(queue)) {
      const added = fillFromAudit(queue, state);
      if (added) {
        note(null, `очередь пополнена из аудита: ${added}`);
        queue = parseTasks(fs.readFileSync(path.join(DIR, 'TASKS.md'), 'utf8'));
        tasksById = Object.fromEntries(queue.map((task) => [task.id, task]));
      }
    }
    const next = pending(queue);
    if (!next) { saveState(STATE, state); writeStatus(state, 'Очередь пуста: в аудите не осталось несделанных правок, а в AUTODEV/TASKS.md — задач.'); return IDLE_MS; }
    state.current = next.id;
    if (!state.tasks[next.id]) {
      syncFromInteractive();
      state.tasks[next.id] = { phase: 'develop', base: git(WORKTREE, 'rev-parse', 'HEAD'), startedAt: new Date().toISOString() };
    }
  }
  const task = tasksById[state.current];
  const t = state.tasks[state.current];
  if (!task) { note(null, `задачи ${state.current} больше нет в TASKS.md — пропускаю`); t.phase = 'skipped'; state.current = null; saveState(STATE, state); return 0; }

  writeStatus(state);
  saveState(STATE, state); // what is about to run is on disk before it runs
  if (t.phase === 'adopt') adopt(state, task, t);
  else if (t.phase === 'develop') await develop(state, task, t);
  else if (t.phase === 'check') await check(state, task, t);
  else if (t.phase === 'review') await review(state, task, t);
  else if (t.phase === 'push') push(state, task, t);
  saveState(STATE, state);
  writeStatus(state);
  return 0;
}

async function main() {
  // Stopped (launchd, Ctrl-C) — the agents go too. State is on disk before
  // every run, so the restart resumes the same session; nothing else holds it.
  for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
    process.on(signal, () => { stopAgents(); process.exit(0); });
  }
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
