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

/** Runs a command whose stdout is JSON lines; every line is kept in `log`. */
function runJsonLines(command, args, { cwd, env, log, timeoutMs }) {
  return new Promise((resolve) => {
    fs.mkdirSync(path.dirname(log), { recursive: true });
    const out = fs.createWriteStream(log, { flags: 'a' });
    out.write(`\n### ${new Date().toISOString()} ${path.basename(command)} ${args.filter((a) => a.length < 80).join(' ')}\n`);
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
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
export async function runClaude({ bin, cwd, prompt, sessionId, resume, settingsFile, systemPrompt, log, timeoutMs, env }) {
  const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose',
    '--permission-mode', 'dontAsk', '--settings', settingsFile];
  if (resume) args.push('--resume', resume);
  else if (sessionId) args.push('--session-id', sessionId);
  if (systemPrompt) args.push('--append-system-prompt', systemPrompt);
  const run = await runJsonLines(bin, args, { cwd, env, log, timeoutMs });
  const result = [...run.events].reverse().find((event) => event.type === 'result');
  const init = run.events.find((event) => event.type === 'system' && event.session_id);
  const limit = limitFromClaudeEvents(run.events.length ? run.events : [{ type: 'result', is_error: true, result: run.stderr }]);
  return {
    sessionId: result?.session_id ?? init?.session_id ?? resume ?? sessionId,
    text: result?.result ?? '',
    failed: !result || Boolean(result.is_error) || run.code !== 0,
    limit,
    exit: run.code,
    signal: run.signal,
  };
}

/**
 * One reviewer turn in `cwd` (the review worktree). A new thread, or `resume`
 * to continue one. The last message is also written to `lastMessageFile`.
 */
export async function runCodex({ bin, cwd, prompt, resume, sandbox = 'workspace-write', addDirs = [], lastMessageFile, log, timeoutMs, env }) {
  const common = ['--json', '--output-last-message', lastMessageFile];
  const args = resume
    ? ['exec', 'resume', resume, prompt, ...common]
    : ['exec', '--sandbox', sandbox, ...addDirs.flatMap((dir) => ['--add-dir', dir]), ...common, prompt];
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
