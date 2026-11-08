// The e2e lock, with real processes: what a dead run left running is stopped,
// what is not its own is left alone, a live run is waited for.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { takeLock, startedAt } from '../lock.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-lock-'));
const children = [];
const strays = [];
after(() => {
  for (const child of children) { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ } }
  for (const pid of strays) { try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ } }
  fs.rmSync(dir, { recursive: true, force: true });
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

/** A process in a group of its own, like the server and Metro. */
function group() {
  const child = spawn('/bin/sleep', ['60'], { detached: true, stdio: 'ignore' });
  children.push(child);
  return child.pid;
}

/** A pid that has already exited: the holder of a lock left behind. */
async function deadPid() {
  const child = spawn('/usr/bin/true');
  await new Promise((resolve) => child.on('exit', resolve));
  return child.pid;
}

test('a free lock is taken, names its run, and is released', async () => {
  const file = path.join(dir, 'free.lock');
  const lock = await takeLock(file);
  const held = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(held.pid, process.pid);
  const pid = group();
  lock.record('server', pid);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')).groups, [{ name: 'server', pgid: pid, since: startedAt(pid) }]);
  lock.release();
  assert.equal(fs.existsSync(file), false);
});

test('what a dead run left running is stopped before the lock is taken', async () => {
  const file = path.join(dir, 'dead.lock');
  const server = group();
  const metro = group();
  fs.writeFileSync(file, JSON.stringify({ pid: await deadPid(), since: 'never', groups: [
    { name: 'server', pgid: server, since: startedAt(server) },
    { name: 'metro', pgid: metro, since: startedAt(metro) },
  ] }));
  const said = [];
  const lock = await takeLock(file, { log: (line) => said.push(line) });
  await sleep(100);
  assert.equal(alive(server), false, 'the dead run\'s server is still running');
  assert.equal(alive(metro), false, 'the dead run\'s Metro is still running');
  assert.equal(said.length, 2);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).pid, process.pid);
  lock.release();
});

test('a pid that now belongs to another process is left alone', async () => {
  const file = path.join(dir, 'reused.lock');
  const other = group();
  fs.writeFileSync(file, JSON.stringify({ pid: await deadPid(), since: 'never', groups: [
    { name: 'server', pgid: other, since: 'Mon Jan  1 00:00:00 2001' },
  ] }));
  const lock = await takeLock(file);
  assert.equal(alive(other), true);
  lock.release();
});

test('a lock in the old form, a bare pid, is taken over once its run is gone', async () => {
  const file = path.join(dir, 'old.lock');
  fs.writeFileSync(file, String(await deadPid()));
  const lock = await takeLock(file);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).pid, process.pid);
  lock.release();
});

// A heavy job beside an e2e run (T-231): hold-lock.mjs runs it under the lock.
const HOLD = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'hold-lock.mjs');
function hold(file, ...command) {
  const child = spawn(process.execPath, [HOLD, ...command], {
    env: { ...process.env, REHEARSLY_E2E_LOCK: file }, stdio: ['pipe', 'pipe', 'pipe'],
  });
  children.push(child);
  let said = '';
  let out = '';
  child.stderr.on('data', (chunk) => { said += chunk; });
  child.stdout.on('data', (chunk) => { out += chunk; });
  child.said = () => said;
  child.out = () => out;
  child.done = new Promise((resolve) => child.on('exit', (code) => resolve(code)));
  return child;
}
async function until(check, ms = 5000) {
  for (const end = Date.now() + ms; !check(); await sleep(50)) assert.ok(Date.now() < end, 'timed out');
}

test('a heavy job waits for a live e2e run, then runs under the lock and gives back its code', async () => {
  const file = path.join(dir, 'hold-wait.lock');
  const marker = path.join(dir, 'hold-wait.ran');
  const run = await takeLock(file);
  const job = hold(file, '/bin/sh', '-c', `echo ran > "${marker}"; exit 3`);
  await until(() => /another e2e run .* waiting for it/.test(job.said()));
  await sleep(300);
  assert.equal(fs.existsSync(marker), false, 'the job ran while the e2e run held the lock');
  run.release();
  assert.equal(await job.done, 3);
  assert.equal(fs.existsSync(marker), true);
  assert.equal(fs.existsSync(file), false, 'the job left the lock behind');
});

test('an e2e run waits for a heavy job under the lock, and names it', async () => {
  const file = path.join(dir, 'hold-held.lock');
  const job = hold(file, '/bin/sleep', '1');
  await until(() => fs.existsSync(file) && JSON.parse(fs.readFileSync(file, 'utf8')).groups.length === 1);
  const said = [];
  const run = await takeLock(file, { pollMs: 50, log: (line) => said.push(line) });
  assert.equal(await job.done, 0);
  assert.match(said[0], /a job under the e2e lock \(pid \d+: \/bin\/sleep 1\) is going; waiting for it/);
  run.release();
});

test('a heavy job whose holder was killed outright is stopped by the next e2e run', async () => {
  const file = path.join(dir, 'hold-dead.lock');
  const job = hold(file, '/bin/sleep', '60');
  await until(() => fs.existsSync(file) && JSON.parse(fs.readFileSync(file, 'utf8')).groups.length === 1);
  const { pgid } = JSON.parse(fs.readFileSync(file, 'utf8')).groups[0];
  job.kill('SIGKILL');
  await job.done;
  assert.equal(alive(pgid), true);
  const run = await takeLock(file);
  await sleep(100);
  assert.equal(alive(pgid), false, 'the dead holder\'s job is still running');
  run.release();
});

test('a heavy job\'s own children end before the next run takes the lock', { timeout: 60000 }, async () => {
  const file = path.join(dir, 'hold-chain.lock');
  // Node starting a child of its own, as a build starts its workers.
  const job = hold(file, process.execPath, '-e',
    "const c = require('node:child_process').spawn('/bin/sleep', ['60'], { stdio: 'ignore' }); console.log(c.pid); setInterval(() => {}, 1000);");
  await until(() => /^\d+\n/.test(job.out()));
  const worker = Number(job.out().trim());
  strays.push(worker);
  assert.equal(alive(worker), true);
  job.kill('SIGKILL');
  await job.done;
  const run = await takeLock(file);
  const left = alive(worker);
  run.release();
  assert.equal(left, false, 'the next run took the lock while the dead holder\'s job\'s child was running');
});

test('the lock is not taken while a dead run\'s group has a member, its leader gone', async () => {
  const file = path.join(dir, 'leftover.lock');
  // A group whose leader has exited and whose member runs on; nothing will stop it.
  const leader = spawn('/bin/sh', ['-c', '/bin/sleep 60 & echo $!'], { detached: true, stdio: ['ignore', 'pipe', 'ignore'] });
  const member = await new Promise((resolve) => leader.stdout.once('data', (chunk) => resolve(Number(String(chunk).trim()))));
  children.push({ pid: leader.pid });
  await new Promise((resolve) => leader.on('exit', resolve));
  assert.equal(alive(member), true);
  fs.writeFileSync(file, JSON.stringify({ pid: await deadPid(), since: 'never', groups: [
    { name: 'job', pgid: leader.pid, since: 'Mon Jan  1 00:00:00 2001' },
  ] }));
  await assert.rejects(takeLock(file, { leftoversMs: 1000 }), new RegExp(`process group ${leader.pid}\\) is still running`));
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).since, 'never', 'the lock was taken');
  fs.rmSync(file);
});

test('a heavy job reads the terminal: what is typed reaches it', async () => {
  const file = path.join(dir, 'hold-stdin.lock');
  // As expo's device prompt waits for a choice.
  const job = hold(file, '/bin/sh', '-c', 'read line; echo "got:$line"');
  job.stdin.end('device-2\n');
  assert.equal(await job.done, 0);
  assert.match(job.out(), /got:device-2/);
});

// Where ps cannot run (the developer's sandbox): no PATH, so startedAt() is ''.
const NO_PS = { PATH: '/nonexistent' };
const LOCK_URL = new URL('../lock.mjs', import.meta.url).href;

test('without ps, a dead holder\'s job ends before the next run takes the lock', async () => {
  const file = path.join(dir, 'hold-dead-nops.lock');
  // A job deaf to SIGTERM: only its watchdog's SIGKILL to the group ends it.
  const job = spawn(process.execPath, [HOLD, '/bin/sh', '-c', 'trap "" TERM; /bin/sleep 60'], {
    env: { ...NO_PS, REHEARSLY_E2E_LOCK: file }, stdio: ['ignore', 'ignore', 'ignore'],
  });
  children.push(job);
  await until(() => fs.existsSync(file) && JSON.parse(fs.readFileSync(file, 'utf8')).groups.length === 1);
  const { pgid } = JSON.parse(fs.readFileSync(file, 'utf8')).groups[0];
  await sleep(300);
  job.kill('SIGKILL');
  await new Promise((resolve) => job.on('exit', resolve));
  const next = spawn(process.execPath, ['--input-type=module', '-e', `
    import { takeLock } from ${JSON.stringify(LOCK_URL)};
    const lock = await takeLock(${JSON.stringify(file)});
    let left; try { process.kill(-${pgid}, 0); left = true; } catch { left = false; }
    lock.release();
    console.log(JSON.stringify({ left }));
  `], { env: NO_PS, stdio: ['ignore', 'pipe', 'inherit'] });
  let out = '';
  next.stdout.on('data', (chunk) => { out += chunk; });
  assert.equal(await new Promise((resolve) => next.on('exit', resolve)), 0);
  assert.deepEqual(JSON.parse(out), { left: false }, 'the next run took the lock while the dead holder\'s job was running');
});

const APP = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..');

test('npm run ios and android build under the lock', () => {
  const { scripts } = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8'));
  assert.equal(scripts.ios, 'node e2e/hold-lock.mjs expo run:ios');
  assert.equal(scripts.android, 'node e2e/hold-lock.mjs expo run:android');
});

test('npm run ios waits for a live e2e run, then runs expo', { timeout: 120000 }, async () => {
  const file = path.join(dir, 'npm-ios.lock');
  const run = await takeLock(file);
  const npm = spawn('npm', ['run', 'ios', '--', '--help'], {
    cwd: APP, env: { ...process.env, REHEARSLY_E2E_LOCK: file }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(npm);
  let out = '';
  let err = '';
  npm.stdout.on('data', (chunk) => { out += chunk; });
  npm.stderr.on('data', (chunk) => { err += chunk; });
  const done = new Promise((resolve) => npm.on('exit', resolve));
  await until(() => /another e2e run .* waiting for it/.test(err), 60000);
  await sleep(2000);
  assert.doesNotMatch(out + err, /Usage/i, 'expo ran while an e2e run held the lock');
  run.release();
  assert.equal(await done, 0);
  assert.match(out + err, /run:ios/);
  assert.equal(fs.existsSync(file), false, 'npm run ios left the lock behind');
});

test('a live run is waited for, not cleared', async () => {
  const file = path.join(dir, 'live.lock');
  const server = group();
  fs.writeFileSync(file, JSON.stringify({ pid: process.pid, since: startedAt(process.pid), groups: [
    { name: 'server', pgid: server, since: startedAt(server) },
  ] }));
  await assert.rejects(takeLock(file, { timeoutMs: 300, pollMs: 50 }), /Gave up waiting/);
  assert.equal(alive(server), true);
  fs.rmSync(file);
});
