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
after(() => {
  for (const child of children) { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ } }
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
