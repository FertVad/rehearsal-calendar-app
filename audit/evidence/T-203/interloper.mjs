#!/usr/bin/env node
// T-203: runs one e2e flow while, mid-flow, another process takes port 3001
// on the loopback addresses — the way a second copy of the server or any dev
// server started with HOST=localhost would on this machine.
//
//   node audit/evidence/T-203/interloper.mjs [flow.yaml] [hold seconds]
//
// It waits for the planner to load availability (the server logs it three
// times in flow 06, after sign-in and before the create), then binds ::1:3001
// and 127.0.0.1:3001 wherever the kernel lets it. Whatever it accepts it holds
// unanswered, as a server stuck on its database would. After `hold` seconds it
// goes away again, so the requests that follow reach the e2e server — the
// failure on T-130 recovered the same way. e2e/run.mjs checks the port is
// free only before the run, so nothing notices the newcomer.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../rehearsal-calendar-native');
const flow = process.argv[2] || 'e2e/flows/06-planner-to-rehearsal.yaml';
const holdMs = Number(process.argv[3] || 15) * 1000;
const SERVER_LOG = path.join(ROOT, 'e2e', 'out', 'server.log');
const say = (text) => console.log(`[T-203 interloper ${new Date().toISOString().slice(11, 23)}] ${text}`);

const started = Date.now();
const e2e = spawn('npm', ['run', 'e2e', '--', flow], { cwd: ROOT, stdio: 'inherit' });

const listeners = [];
let armed = true;
const trigger = setInterval(() => {
  if (!armed) return;
  let text = '';
  try {
    if (fs.statSync(SERVER_LOG).mtimeMs < started) return;
    text = fs.readFileSync(SERVER_LOG, 'utf8');
  } catch { return; }
  if ((text.match(/\[Availability API\]/g) || []).length < 3) return;
  armed = false;
  clearInterval(trigger);
  for (const host of ['::1', '127.0.0.1']) {
    const server = net.createServer((socket) => {
      say(`accepted a connection on [${host}]:3001 from port ${socket.remotePort}; not answering`);
      socket.on('data', (chunk) => say(`  got ${JSON.stringify(chunk.toString().split('\r\n')[0])}`));
      socket.on('error', () => {});
    });
    server.once('error', (error) => say(`could not bind [${host}]:3001: ${error.code}`));
    server.listen(3001, host, () => { say(`bound [${host}]:3001 while the e2e server runs`); listeners.push(server); });
  }
  setTimeout(() => {
    for (const server of listeners) server.close();
    say(`gone after ${holdMs / 1000}s`);
  }, holdMs);
}, 100);

e2e.on('exit', (code) => {
  clearInterval(trigger);
  for (const server of listeners) server.close();
  say(`e2e exit ${code} after ${Math.round((Date.now() - started) / 1000)}s`);
  process.exit(code ?? 1);
});
