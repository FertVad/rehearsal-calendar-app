/**
 * The two agents, run headless: Claude Code as the developer, Codex as the
 * reviewer ("Astra"). Each call streams JSON events to a log as they come,
 * and answers what the supervisor needs to go on: the session to resume, the
 * last message, whether it failed, and whether a subscription limit stopped it.
 *
 * Codex gets no model or reasoning flags: those are the owner's settings in
 * ~/.codex/config.toml and stay there. Claude gets a whitelist and dontAsk —
 * never a permission bypass.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { limitFromClaudeEvents, limitFromCodexEvents } from './limits.mjs';

// Agents still running. The supervisor stops them when it is stopped: one
// left behind keeps working the session the restarted supervisor resumes,
// two writers on one conversation (seen 2026-10-10 on a launchd restart).
const running = new Set();

/** Sends every running agent the signal; for the supervisor's own shutdown. */
export function stopAgents(signal = 'SIGTERM') {
  for (const child of running) child.kill(signal);
}

/** Runs a command whose stdout is JSON lines; every line is kept in `log`. */
function runJsonLines(command, args, { cwd, env, log, timeoutMs }) {
  return new Promise((resolve) => {
    fs.mkdirSync(path.dirname(log), { recursive: true });
    const out = fs.createWriteStream(log, { flags: 'a' });
    out.write(`\n### ${new Date().toISOString()} ${path.basename(command)} ${args.filter((a) => a.length < 80).join(' ')}\n`);
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    running.add(child);
    // Decoded as a stream: a Russian letter cut between two chunks came out
    // as two replacement characters ("нужн��", T-110's stop reason).
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    const events = [];
    let buffer = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      out.write(chunk);
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        try { events.push(JSON.parse(line)); } catch { /* a stray non-JSON line stays in the log only */ }
      }
    });
    child.stderr.on('data', (chunk) => { out.write(chunk); stderr += chunk; });
    const timer = timeoutMs ? setTimeout(() => child.kill('SIGTERM'), timeoutMs) : null;
    child.on('close', (code, signal) => {
      running.delete(child);
      if (timer) clearTimeout(timer);
      if (buffer.trim()) { try { events.push(JSON.parse(buffer.trim())); } catch { /* kept in the log */ } }
      out.end();
      resolve({ code, signal, events, stderr });
    });
  });
}

/**
 * One developer turn. A new session is started with `sessionId`, an existing
 * one continued with `resume`.
 */
export async function runClaude({ bin, cwd, prompt, sessionId, resume, model, settingsFile, sandboxProfile, systemPrompt, log, timeoutMs, env }) {
  // Only our settings: the repository's .claude/settings.json (102 allows and
  // the main tree as a working directory) and the user's own would otherwise
  // be merged in, and the whitelist would mean little. No MCP servers either —
  // the user's include mail and documents.
  const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose',
    '--permission-mode', 'dontAsk', '--setting-sources', '', '--strict-mcp-config', '--settings', settingsFile];
  if (resume) args.push('--resume', resume);
  else if (sessionId) args.push('--session-id', sessionId);
  if (systemPrompt) args.push('--append-system-prompt', systemPrompt);
  // The owner's model, which dropping their settings would drop with them.
  if (model) args.push('--model', model);
  // And under the OS sandbox (agent.sb), so no command it runs can read a
  // secret's contents, whatever Claude Code's rules allow.
  const run = sandboxProfile
    ? await runJsonLines('/usr/bin/sandbox-exec', ['-f', sandboxProfile, '-D', `HOME=${env.HOME}`, bin, ...args], { cwd, env, log, timeoutMs })
    : await runJsonLines(bin, args, { cwd, env, log, timeoutMs });
  const results = run.events.filter((event) => event.type === 'result');
  const result = results.at(-1);
  const init = run.events.find((event) => event.type === 'system' && event.session_id);
  const limit = limitFromClaudeEvents(run.events.length ? run.events : [{ type: 'result', is_error: true, result: run.stderr }]);
  return {
    sessionId: result?.session_id ?? init?.session_id ?? resume ?? sessionId,
    text: result?.result ?? '',
    // Every time the run ended, in order: background jobs and notifications
    // add turns after the real answer (prompts.pickResult).
    results: results.map((event) => String(event.result ?? '')),
    failed: !result || Boolean(result.is_error) || run.code !== 0,
    limit,
    exit: run.code,
    signal: run.signal,
    // Resuming a session that never got created (a crash between choosing
    // its id and starting it) is told apart from a real failure.
    missingSession: /No conversation found/i.test(`${result?.result ?? ''}\n${run.stderr}`),
  };
}

/**
 * What the reviewer's commands may touch: read anything, write the review tree
 * and /private/tmp, and never the contents of a secret. A permission profile,
 * not --sandbox workspace-write: that one reads everything, and a probe read a
 * dummy .env and listed ~/.ssh through it. The profile is enforced by the
 * sandbox itself (`codex sandbox` → "Operation not permitted"), not by the
 * model choosing to stay away. Sandbox only — no model or reasoning settings.
 */
export const REVIEW_PERMISSIONS = [
  '-c', 'default_permissions="autodev_review"',
  '-c', `permissions.autodev_review.filesystem={${[
    '"/"="read"', '":project_roots"="write"', '"/private/tmp"="write"',
    '"~/**/.env"="deny"', '"~/**/.env.local"="deny"', '"~/**/.env.production"="deny"',
    '"~/.ssh"="deny"', '"~/.aws"="deny"', '"~/.appstoreconnect"="deny"', '"~/.config/gh"="deny"',
    '"~/.netrc"="deny"', '"~/.npmrc"="deny"',
  ].join(', ')}}`,
];

/**
 * One reviewer turn in `cwd` (the review worktree). A new thread, or `resume`
 * to continue one. The last message is also written to `lastMessageFile`.
 */
export async function runCodex({ bin, cwd, prompt, resume, lastMessageFile, log, timeoutMs, env }) {
  const common = [...REVIEW_PERMISSIONS, '--json', '--output-last-message', lastMessageFile];
  const args = resume
    ? ['exec', 'resume', resume, prompt, ...common]
    : ['exec', ...common, prompt];
  const run = await runJsonLines(bin, args, { cwd, env, log, timeoutMs });
  const started = run.events.find((event) => event.type === 'thread.started');
  const failure = [...run.events].reverse().find((event) => event.type === 'turn.failed' || event.type === 'error');
  const limit = limitFromCodexEvents(run.events.length ? run.events : [{ type: 'error', message: run.stderr }]);
  let text = '';
  try { text = fs.readFileSync(lastMessageFile, 'utf8'); } catch { /* no last message: the turn failed */ }
  return {
    threadId: started?.thread_id ?? resume,
    text,
    failed: Boolean(failure) || run.code !== 0,
    limit,
    exit: run.code,
    signal: run.signal,
  };
}
