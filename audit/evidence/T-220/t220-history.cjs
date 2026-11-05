// T-220 scratch: in every kept run of flow 30, how the held import ended on the
// device — iOS gave up (-1001 / timed out) or the task got the hold's 200.
const fs = require('fs');
const path = require('path');
const roots = [path.join(__dirname, 'artifacts'), path.join(__dirname, 'failed')];
const FLOW = 'A sync whose import fails still exports';
const found = [];
const walk = (dir, depth) => {
  if (depth > 4 || !fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (!fs.statSync(full).isDirectory()) continue;
    if (name.startsWith(FLOW)) found.push(full);
    else walk(full, depth + 1);
  }
};
roots.forEach((root) => walk(root, 0));
for (const dir of found.sort()) {
  const log = path.join(dir, 'logs', 'device-simulator.log');
  const commands = path.join(dir, 'commands.json');
  let failed = '?';
  if (fs.existsSync(commands)) {
    const c = JSON.parse(fs.readFileSync(commands, 'utf8'));
    const syncError = c.find((x) => JSON.stringify(x.command).includes('Sync error'));
    failed = !syncError ? 'no Sync-error step' : syncError.metadata.status === 'COMPLETED' ? '"Sync error" seen' : `"Sync error" ${syncError.metadata.status}`;
  }
  if (!fs.existsSync(log)) { console.log(path.relative(__dirname, dir), failed, 'no device log'); continue; }
  const lines = fs.readFileSync(log, 'utf8').split('\n');
  const start = lines.findIndex((l) => /url: http:\/\/127\.0\.0\.1:3001\/api\/native\/availability\/imported\/sync/.test(l));
  if (start < 0) { console.log(path.relative(__dirname, dir), failed, 'no import request'); continue; }
  // The task that opened that connection.
  let task = null;
  for (let i = start; i >= Math.max(0, start - 20); i--) {
    const m = lines[i].match(/Task <([0-9A-F-]+)>\.<\d+> resuming, timeouts\(([^,]+),/);
    if (m) { task = m[1]; break; }
  }
  const own = task ? lines.filter((l) => l.includes(task)) : [];
  const end = own.find((l) => /summary for task|finished with error|timed out|-1001/.test(l)) || '';
  const t = (l) => (l.match(/\d\d:\d\d:\d\d\.\d+/) || [''])[0];
  const ms = (end.match(/transaction_duration_ms=(\d+)/) || [])[1];
  const outcome = /response_status=200/.test(end) ? `got the 200 after ${ms} ms (iOS did not give up)`
    : /response_status=-1/.test(end) ? `failed after ${ms} ms` : end.slice(0, 160);
  const hold = fs.existsSync(commands) ? (JSON.stringify(JSON.parse(fs.readFileSync(commands, 'utf8'))).match(/"(MS|OPEN|DROP)":"(\d+)"/) || []).slice(1).join(' ') : '?';
  console.log(`${path.relative(__dirname, dir)}  hold ${hold}  ${failed}  import ${outcome}`);
}
