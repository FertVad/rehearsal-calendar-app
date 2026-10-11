#!/usr/bin/env node
// T-203: stops the e2e server and Metro a cut-off run of this tree left on
// ports 3001/8081. Only processes whose command line is this tree's e2e
// server or Metro are touched; their whole process group is stopped, as the
// e2e teardown would have done.
import { execFileSync } from 'node:child_process';

const TREE = '/Users/vadimfertik/Desktop/reh_app-auto/rehearsal-calendar-native';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

const listening = (port) => {
  try { return execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' }).split('\n').filter(Boolean).map(Number); }
  catch { return []; }
};
// e2e/run.mjs starts each in a group of its own (detached), so the group is
// led by the process itself; Metro's listener may be a child of the leader.
const info = (pid) => {
  const fields = execFileSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fcn'], { encoding: 'utf8' }).split('\n');
  return { command: fields.find((l) => l.startsWith('c'))?.slice(1) ?? '', cwd: fields.find((l) => l.startsWith('n'))?.slice(1) ?? '' };
};
const LEADERS = { 3001: Number(process.argv[2]), 8081: Number(process.argv[3]) };

for (const port of [3001, 8081]) {
  for (const pid of listening(port)) {
    const { command, cwd } = info(pid);
    const pgid = LEADERS[port];
    const ours = Boolean(pgid) && (port === 3001 ? cwd === `${TREE}/server` : cwd === TREE) && alive(pgid);
    console.log(`port ${port}: pid ${pid} (${command}) cwd ${cwd}; group ${pgid} — ${ours ? 'stopping' : 'not ours, left alone'}`);
    if (!ours) continue;
    try { process.kill(-pgid, 'SIGTERM'); } catch { continue; }
    for (let i = 0; i < 40 && alive(pid); i++) await sleep(250);
    if (alive(pid)) { try { process.kill(-pgid, 'SIGKILL'); } catch { /* gone */ } }
    console.log(`  ${alive(pid) ? 'still running' : 'stopped'}`);
  }
}
