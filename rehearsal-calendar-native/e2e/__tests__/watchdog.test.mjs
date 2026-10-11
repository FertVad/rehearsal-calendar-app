// The e2e watchdog with real processes: a run killed outright takes what it
// started through the watchdog with it.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WATCHDOG = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'watchdog.mjs');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const leftovers = [];
after(() => { for (const pid of leftovers) { try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ } } });

/**
 * A stand-in for run.mjs: starts `sleep 60` through the watchdog, as run.mjs
 * starts the server, prints the sleep's pid, then waits to be killed.
 */
function fakeRun() {
  const script = `
    const { spawn } = require('node:child_process');
    const dog = spawn(process.execPath, [${JSON.stringify(WATCHDOG)}, '/bin/sh', '-c', 'echo $$; exec sleep 60'],
      { detached: true, stdio: ['pipe', 'pipe', 'inherit'] });
    dog.stdout.on('data', (chunk) => process.stdout.write(chunk));
    setInterval(() => {}, 1000);`;
  return spawn(process.execPath, ['-e', script], { stdio: ['ignore', 'pipe', 'inherit'] });
}

async function startedPid(run) {
  return new Promise((resolve) => run.stdout.once('data', (chunk) => resolve(Number(String(chunk).trim()))));
}

test('what a run started through the watchdog dies with the run, even on SIGKILL', async () => {
  const run = fakeRun();
  const pid = await startedPid(run);
  leftovers.push(pid);
  assert.equal(alive(pid), true);
  run.kill('SIGKILL');
  for (let i = 0; i < 40 && alive(pid); i++) await sleep(100);
  assert.equal(alive(pid), false, 'the server stand-in outlived the run that started it');
});

test('while the run lives, the command keeps running', async () => {
  const run = fakeRun();
  const pid = await startedPid(run);
  leftovers.push(pid);
  await sleep(1000);
  assert.equal(alive(pid), true);
  run.kill('SIGKILL');
  for (let i = 0; i < 40 && alive(pid); i++) await sleep(100);
});
