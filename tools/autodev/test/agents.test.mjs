// How the agents are started is the security boundary, so it is tested with
// stand-ins that report the arguments they were given — and the sandbox
// profile with a real sandbox-exec.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runClaude, runCodex, stopAgents, REVIEW_PERMISSIONS } from '../lib/agents.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROFILE = path.join(HERE, '..', 'agent.sb');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'autodev-agents-'));
const env = { PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`, HOME: os.homedir() };

function stub(name, body) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, `#!${process.execPath}\n${body}\n`);
  fs.chmodSync(file, 0o755);
  return file;
}

const claude = stub('claude', `
const out = (e) => console.log(JSON.stringify(e));
out({ type: 'system', subtype: 'init', session_id: 's1' });
out({ type: 'result', is_error: false, session_id: 's1', result: JSON.stringify(process.argv.slice(2)) + '\\nRESULT: DONE' });`);

const codex = stub('codex', `
const args = process.argv.slice(2);
console.log(JSON.stringify({ type: 'thread.started', thread_id: 't1' }));
require('fs').writeFileSync(args[args.indexOf('--output-last-message') + 1], JSON.stringify(args));`);

test('the developer runs under the OS sandbox, with only our settings and no MCP', async () => {
  const run = await runClaude({ bin: claude, cwd: dir, prompt: 'p', sessionId: 's1', settingsFile: path.join(dir, 's.json'),
    sandboxProfile: PROFILE, log: path.join(dir, 'c.jsonl'), env });
  const args = JSON.parse(run.text.split('\n')[0]);
  assert.equal(run.failed, false);
  assert.deepEqual(args.slice(args.indexOf('--setting-sources'), args.indexOf('--setting-sources') + 2), ['--setting-sources', '']);
  assert.ok(args.includes('--strict-mcp-config'));
  assert.deepEqual(args.slice(args.indexOf('--permission-mode'), args.indexOf('--permission-mode') + 2), ['--permission-mode', 'dontAsk']);
  assert.ok(!args.some((a) => /skip-permissions|bypassPermissions/.test(a)));
  assert.ok(!args.includes('--model'));
});

test('the developer keeps the owner\'s model when their settings are left out', async () => {
  const run = await runClaude({ bin: claude, cwd: dir, prompt: 'p', sessionId: 's1', model: 'opus', settingsFile: path.join(dir, 's.json'),
    sandboxProfile: PROFILE, log: path.join(dir, 'c3.jsonl'), env });
  const args = JSON.parse(run.text.split('\n')[0]);
  assert.deepEqual(args.slice(args.indexOf('--model'), args.indexOf('--model') + 2), ['--model', 'opus']);
});

test('a run that ended several times keeps every answer, in order', async () => {
  const twice = stub('claude-twice', `
const out = (e) => console.log(JSON.stringify(e));
out({ type: 'system', subtype: 'init', session_id: 's2' });
out({ type: 'result', is_error: false, session_id: 's2', result: 'Отчёт\\nRESULT: DONE' });
out({ type: 'result', is_error: false, session_id: 's2', result: 'Уведомление уже обработано.' });`);
  const run = await runClaude({ bin: twice, cwd: dir, prompt: 'p', sessionId: 's2', settingsFile: path.join(dir, 's.json'),
    sandboxProfile: PROFILE, log: path.join(dir, 'c2.jsonl'), env });
  assert.deepEqual(run.results, ['Отчёт\nRESULT: DONE', 'Уведомление уже обработано.']);
  assert.equal(run.text, 'Уведомление уже обработано.');
});

test('the developer has no background jobs, agents or schedules to give it turns after its answer', () => {
  const { deny } = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'claude-settings.json'), 'utf8')).permissions;
  for (const tool of ['Agent', 'Task', 'TaskOutput', 'Monitor', 'CronCreate', 'ScheduleWakeup', 'SendMessage', 'RemoteTrigger', 'EnterWorktree']) {
    assert.ok(deny.includes(tool), tool);
  }
});

test('stopping the supervisor stops the agent it is running', async () => {
  const slow = stub('claude-slow', `
console.log(JSON.stringify({ type: 'system', subtype: 'init', session_id: 's4' }));
setTimeout(() => {}, 60000);`);
  const pending = runClaude({ bin: slow, cwd: dir, prompt: 'p', sessionId: 's4', settingsFile: path.join(dir, 's.json'),
    sandboxProfile: PROFILE, log: path.join(dir, 'c4.jsonl'), env });
  await new Promise((resolve) => setTimeout(resolve, 300));
  stopAgents();
  const run = await pending;
  assert.equal(run.signal, 'SIGTERM');
  assert.equal(run.failed, true);
});

test('the sandbox profile keeps a secret\'s contents from any command, and leaves other files alone', () => {
  const secret = path.join(dir, '.env');
  const plain = path.join(dir, 'notes.txt');
  const example = path.join(dir, '.env.example');
  for (const file of [secret, plain, example]) fs.writeFileSync(file, 'X=1\n');
  const cat = (file) => spawnSync('/usr/bin/sandbox-exec', ['-f', PROFILE, '-D', `HOME=${os.homedir()}`, '/bin/cat', file], { encoding: 'utf8' });
  const denied = cat(secret);
  assert.notEqual(denied.status, 0);
  assert.match(denied.stderr, /Operation not permitted/);
  assert.equal(cat(plain).stdout, 'X=1\n');
  assert.equal(cat(example).stdout, 'X=1\n');
  // Checking that it exists still works: tools that look for a missing .env go on.
  assert.equal(spawnSync('/usr/bin/sandbox-exec', ['-f', PROFILE, '-D', `HOME=${os.homedir()}`, '/bin/test', '-e', secret]).status, 0);
});

test('the reviewer gets the permission profile and nothing about its model', async () => {
  const run = await runCodex({ bin: codex, cwd: dir, prompt: 'p', lastMessageFile: path.join(dir, 'last.md'), log: path.join(dir, 'x.jsonl'), env });
  const args = JSON.parse(run.text);
  assert.equal(run.threadId, 't1');
  assert.ok(args.includes('default_permissions="autodev_review"'));
  const overrides = args.filter((_, i) => args[i - 1] === '-c' || args[i - 1] === '--config');
  assert.ok(overrides.every((v) => /^(default_permissions|permissions\.)/.test(v)), overrides.join(' | '));
  assert.ok(!args.some((a) => ['-m', '--model', '--oss', '-p', '--profile'].includes(a)));
  assert.ok(!args.some((a) => /dangerously|workspace-write|danger-full-access/.test(a)));
});

test('the reviewer\'s profile denies the secrets', () => {
  const profile = REVIEW_PERMISSIONS[REVIEW_PERMISSIONS.length - 1];
  for (const denied of ['"~/**/.env"="deny"', '"~/.ssh"="deny"', '"~/.aws"="deny"', '"~/.appstoreconnect"="deny"', '"~/.config/gh"="deny"']) {
    assert.ok(profile.includes(denied), denied);
  }
});
