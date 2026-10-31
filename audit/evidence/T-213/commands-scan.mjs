// Prints a Maestro run's commands.json one command a line: status, the
// command, its error. node commands-scan.mjs <commands.json> [from] [to]
import { readFileSync } from 'node:fs';

const [file, from = '0', to = '100000'] = process.argv.slice(2);
const raw = JSON.parse(readFileSync(file, 'utf8'));
const list = Array.isArray(raw) ? raw : raw.commands || [];
list.slice(Number(from), Number(to)).forEach((entry, i) => {
  const cmd = entry.command || entry;
  const kind = Object.keys(cmd).find((k) => cmd[k]);
  const meta = entry.metadata || {};
  const at = meta.timestamp ? new Date(meta.timestamp).toISOString().slice(11, 23) : '';
  const err = meta.error ? ' ERR ' + JSON.stringify(meta.error).slice(0, 300) : '';
  console.log(Number(from) + i, at, meta.status, kind, JSON.stringify(cmd[kind]).slice(0, 200) + err);
});
