/**
 * One e2e run at a time on this machine — the simulator and ports 3001/8081
 * are shared — and nothing left behind by a run that died.
 *
 * The lock file names its run and what that run put in the background: each
 * process group, by leader pid and start time. A run killed outright gets no
 * teardown — a tool's ten-minute limit ended one that way on 2026-10-10 — and
 * its server and Metro, each in a group of its own, outlived it on the ports
 * the next run needs. The next run to find the holder dead stops them before
 * it takes the lock.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

/**
 * The machine's one lock: e2e runs take it, and so do heavy jobs beside them
 * through e2e/hold-lock.mjs (T-231, docs/e2e.md).
 */
export const LOCK = '/tmp/rehearsly-e2e.lock';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
// A lock just created is empty until its run writes it.
const FRESH_MS = 5000;

/**
 * When a process started, as ps prints it. With the pid it names one process
 * for good. In the C locale: runs started from different shells must agree.
 */
export function startedAt(pid) {
  try {
    return execFileSync('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' } }).trim();
  } catch { return ''; }
}

/** The run a lock names, or null while it is being written. Older locks hold a bare pid. */
function holderOf(file) {
  const text = fs.readFileSync(file, 'utf8');
  let data;
  try { data = JSON.parse(text); } catch { data = null; }
  if (typeof data === 'number') return { pid: data, since: null, groups: [] };
  if (data && Number(data.pid)) {
    return { pid: Number(data.pid), since: data.since ?? null, groups: Array.isArray(data.groups) ? data.groups : [], what: data.what ?? null };
  }
  return Date.now() - fs.statSync(file).mtimeMs > FRESH_MS ? { pid: 0, since: null, groups: [] } : null;
}

const running = ({ pid, since }) => Boolean(pid) && (since ? startedAt(pid) === since : alive(pid));

/** Whether a process group still has a member. */
const groupAlive = (pgid) => { try { process.kill(-pgid, 0); return true; } catch (error) { return error.code === 'EPERM'; } };
// watchdog.mjs takes its command's group down within 5 s of its holder's death.
const WATCHDOG_MS = 15000;

async function untilEnded(pgid, ms) {
  for (const end = Date.now() + ms; groupAlive(pgid) && Date.now() < end;) await sleep(250);
  return !groupAlive(pgid);
}

/**
 * Stops the groups a dead run recorded — those still led by the process it
 * started — and returns once each is empty: the lock is not taken while any
 * member of one runs, its leader gone or not (T-231: a build's children ran on
 * beside the next run). Where `ps` cannot run (the developer's sandbox), or the
 * leader is gone, a group cannot be identified and is not signalled; it was
 * started through watchdog.mjs, which ends it once the holder is dead. One
 * still running after `waitMs` is an error, naming it: the lock stays untaken.
 */
export async function clearLeftovers(groups, { log = () => {}, waitMs = WATCHDOG_MS } = {}) {
  for (const { name, pgid, since } of groups) {
    if (!pgid) continue;
    const now = startedAt(pgid);
    if (!now) {
      if (!groupAlive(pgid)) continue;
      log(`waiting for the ${name} a dead run left behind (group ${pgid}) to end`);
      if (!await untilEnded(pgid, waitMs)) {
        throw new Error(`the ${name} a dead run left behind (process group ${pgid}) is still running, so the lock is not taken; stop it (kill -KILL -${pgid}) and start again`);
      }
      continue;
    }
    // The pid belongs to something else by now.
    if (!since || now !== since) continue;
    log(`stopping the ${name} a dead run left behind (group ${pgid})`);
    try { process.kill(-pgid, 'SIGTERM'); } catch { continue; }
    if (await untilEnded(pgid, 10000)) continue;
    try { process.kill(-pgid, 'SIGKILL'); } catch { /* gone */ }
    if (!await untilEnded(pgid, 5000)) throw new Error(`the ${name} a dead run left behind (process group ${pgid}) outlived SIGKILL, so the lock is not taken`);
  }
}

function writeAtomic(file, data) {
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data));
  fs.renameSync(temp, file);
}

/**
 * Waits for a live run to finish, clears up after a dead one, then holds the
 * lock. Returns `record(name, pid)` for each background group and `release()`.
 * `what` names a holder that is not an e2e run (hold-lock.mjs's job).
 */
export async function takeLock(file, { timeoutMs = 60 * 60 * 1000, pollMs = 10000, log = () => {}, what = null, leftoversMs } = {}) {
  const held = { pid: process.pid, since: startedAt(process.pid), groups: [], ...(what ? { what } : {}) };
  const deadline = Date.now() + timeoutMs;
  for (let said = false; ;) {
    try {
      fs.writeFileSync(file, JSON.stringify(held), { flag: 'wx' });
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    let holder;
    try { holder = holderOf(file); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (!holder) { await sleep(200); continue; }
    if (!running(holder)) {
      try {
        await clearLeftovers(holder.groups, { log, ...(leftoversMs ? { waitMs: leftoversMs } : {}) });
      } catch (error) {
        // Without ps a group cannot be told from another that got its number.
        error.message += `; if that group is not the dead run's, remove ${file}`;
        throw error;
      }
      fs.rmSync(file, { force: true });
      continue;
    }
    if (!said) {
      log(holder.what ? `a job under the e2e lock (pid ${holder.pid}: ${holder.what}) is going; waiting for it`
        : `another e2e run (pid ${holder.pid}) is going; waiting for it`);
      said = true;
    }
    if (Date.now() >= deadline) throw new Error('Gave up waiting for the other e2e run');
    await sleep(pollMs);
  }
  return {
    record(name, pid) {
      held.groups.push({ name, pgid: pid, since: startedAt(pid) });
      writeAtomic(file, held);
    },
    release() { fs.rmSync(file, { force: true }); },
  };
}
