#!/usr/bin/env node
/**
 *   node e2e/watchdog.mjs <command> [args…]
 *
 * Runs the command in this process's group and takes the group down when its
 * stdin closes. run.mjs starts the server and Metro through it with a pipe as
 * stdin: when run.mjs dies, however it dies — SIGKILL included — the system
 * closes the pipe, and they go with it.
 *
 * The lock (lock.mjs) clears up after a dead run by identifying its groups
 * with `ps`, which the developer's sandbox does not let run: its runs, cut off
 * by a tool's time limit, left both on 3001 and 8081 (T-203, 2026-10-11).
 */
import { spawn } from 'node:child_process';

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('usage: watchdog.mjs <command> [args…]');
  process.exit(2);
}

const child = spawn(command, args, { stdio: ['ignore', 'inherit', 'inherit'] });
let ending = false;
function end(signal = 'SIGTERM') {
  if (ending) return;
  ending = true;
  try { child.kill(signal); } catch { /* gone */ }
  // Anything the command started is in this group too.
  setTimeout(() => { try { process.kill(-process.pid, 'SIGKILL'); } catch { /* gone */ } }, 5000).unref();
}

process.stdin.on('end', () => end());
process.stdin.on('close', () => end());
process.stdin.on('error', () => end());
process.stdin.resume();
for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(signal, () => end(signal));
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
