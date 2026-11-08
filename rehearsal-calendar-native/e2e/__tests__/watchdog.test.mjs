// The e2e watchdog with real processes: a run killed outright takes what it
// started through the watchdog with it, the command's own children included.
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

const SLEEP = ['/bin/sh', '-c', 'echo $$; exec sleep 60'];
// A command that starts a child of its own and prints the child's pid: a build and its workers.
const CHAIN = [process.execPath, '-e',
  "const c = require('node:child_process').spawn('/bin/sleep', ['60'], { stdio: 'ignore' }); console.log(c.pid); setInterval(() => {}, 1000);"];

/**
 * A stand-in for run.mjs: starts the command through the watchdog, as run.mjs
 * starts the server, prints the line the command prints and the watchdog's
 * pid, then waits to be killed.
 */
function fakeRun(command = SLEEP) {
  const script = `
    const { spawn } = require('node:child_process');
    const dog = spawn(process.execPath, [${JSON.stringify(WATCHDOG)}, ...${JSON.stringify(command)}],
      { detached: true, stdio: ['ignore', 'pipe', 'inherit', 'pipe'] });
    dog.stdout.once('data', (chunk) => process.stdout.write(String(chunk).trim() + ' ' + dog.pid + '\\n'));
    setInterval(() => {}, 1000);`;
  return spawn(process.execPath, ['-e', script], { stdio: ['ignore', 'pipe', 'inherit'] });
}

/** [the pid the command printed, the watchdog's pid] */
async function started(run) {
  return new Promise((resolve) => run.stdout.once('data', (chunk) => resolve(String(chunk).trim().split(' ').map(Number))));
}

test('what a run started through the watchdog dies with the run, even on SIGKILL', async () => {
  const run = fakeRun();
  const [pid, dog] = await started(run);
  leftovers.push(pid, dog);
  assert.equal(alive(pid), true);
  run.kill('SIGKILL');
  for (let i = 0; i < 40 && alive(pid); i++) await sleep(100);
  assert.equal(alive(pid), false, 'the server stand-in outlived the run that started it');
});

test('while the run lives, the command keeps running', async () => {
  const run = fakeRun();
  const [pid, dog] = await started(run);
  leftovers.push(pid, dog);
  await sleep(1000);
  assert.equal(alive(pid), true);
  run.kill('SIGKILL');
  for (let i = 0; i < 40 && alive(pid); i++) await sleep(100);
});

test('the command\'s own children die with the run too, and the watchdog outlives them', async () => {
  const run = fakeRun(CHAIN);
  const [grandchild, dog] = await started(run);
  leftovers.push(grandchild, dog);
  assert.equal(alive(grandchild), true);
  run.kill('SIGKILL');
  for (let i = 0; i < 80 && alive(dog); i++) {
    // While anything of the command's is running, the watchdog is.
    if (alive(grandchild)) assert.equal(alive(dog), true, 'the watchdog exited while the command\'s child ran on');
    await sleep(100);
  }
  assert.equal(alive(grandchild), false, 'the command\'s child outlived the run that started it');
  assert.equal(alive(dog), false, 'the watchdog did not exit once the group was empty');
});
