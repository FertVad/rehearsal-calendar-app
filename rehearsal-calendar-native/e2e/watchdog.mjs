#!/usr/bin/env node
/**
 *   node e2e/watchdog.mjs <command> [args…]      (fd 3: a pipe from the holder)
 *
 * Runs the command in a process group of its own and takes that whole group
 * down when its holder dies. The holder — run.mjs for the server and Metro,
 * hold-lock.mjs for a heavy job — starts it with a pipe on fd 3: when the
 * holder dies, however it dies — SIGKILL included — the system closes the
 * pipe, and the group goes, the command's own children with it.
 *
 * The watchdog is not in the command's group, so it can see without `ps`
 * whether anyone is left in it, and it exits only once no one is — after the
 * command has exited, with its code, and after what it left running has been
 * stopped. Its own group (the one the lock names) therefore lives until the
 * job's group is empty, and the next run waits for it (lock.mjs:
 * clearLeftovers). T-231: the watchdog used to exit with the command, and a
 * build's children ran on beside the next run.
 *
 * The command gets the watchdog's stdin, stdout and stderr: under hold-lock.mjs
 * that is the terminal, so `npm run ios -- --device` can ask for a device.
 *
 * The lock (lock.mjs) clears up after a dead run by identifying its groups
 * with `ps`, which the developer's sandbox does not let run: its runs, cut off
 * by a tool's time limit, left both on 3001 and 8081 (T-203, 2026-10-11).
 */
import { spawn } from 'node:child_process';
import net from 'node:net';

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('usage: watchdog.mjs <command> [args…]   (with a pipe from the holder on fd 3)');
  process.exit(2);
}

/** Whether a process group still has a member. */
const groupAlive = (pgid) => { try { process.kill(-pgid, 0); return true; } catch (error) { return error.code === 'EPERM'; } };

// detached: a new session, so a group of the command's own that the watchdog is not in.
const child = spawn(command, args, { stdio: 'inherit', detached: true });
const group = child.pid;
let code = null;

let ending = false;
function end(signal = 'SIGTERM') {
  if (ending || !group) return;
  ending = true;
  try { process.kill(-group, signal); } catch { /* gone */ }
  setTimeout(() => { try { process.kill(-group, 'SIGKILL'); } catch { /* gone */ } }, 5000).unref();
}

try {
  const holder = new net.Socket({ fd: 3, readable: true, writable: false });
  holder.on('end', () => end());
  holder.on('close', () => end());
  holder.on('error', () => end());
  holder.resume();
} catch (error) {
  // No pipe on fd 3: no holder to outlive.
  console.error(`watchdog.mjs: fd 3: ${error.message}`);
  end();
}
for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(signal, () => end(signal));

child.on('error', (error) => { console.error(`watchdog.mjs: ${command}: ${error.message}`); process.exit(127); });
child.on('exit', (exitCode, signal) => {
  code = exitCode ?? (signal ? 1 : 0);
  // The job is over: what it started and left running goes too.
  end();
});
setInterval(() => { if (code !== null && !groupAlive(group)) process.exit(code); }, 100);
