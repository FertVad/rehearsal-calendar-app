// Largest silences in a simulator log, and which processes logged per window.
// Usage: node audit/evidence/T-231/log-gaps.mjs <device-simulator.log> [top]
import fs from 'node:fs';

const [file, topArg] = process.argv.slice(2);
const top = Number(topArg ?? 10);
const lines = fs.readFileSync(file, 'utf8').split('\n');
const re = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}):(\d{2})\.(\d+)([+-]\d{4})\s+\S+\s+([^\[:(]+)/;
const events = [];
for (let i = 0; i < lines.length; i += 1) {
  const m = re.exec(lines[i]);
  if (!m) continue;
  const iso = `${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5].slice(0, 3)}${m[6].slice(0, 3)}:${m[6].slice(3)}`;
  events.push({ t: Date.parse(iso), line: i + 1, proc: m[7].trim() });
}
events.sort((a, b) => a.t - b.t);
const gaps = [];
for (let i = 1; i < events.length; i += 1) {
  gaps.push({ ms: events[i].t - events[i - 1].t, from: events[i - 1], to: events[i] });
}
gaps.sort((a, b) => b.ms - a.ms);
console.log(`${events.length} timed lines, ${new Date(events[0].t).toISOString()} .. ${new Date(events.at(-1).t).toISOString()}`);
for (const g of gaps.slice(0, top)) {
  console.log(`${g.ms} ms silent: ${new Date(g.from.t).toISOString()} (line ${g.from.line}, ${g.from.proc}) -> ${new Date(g.to.t).toISOString()} (line ${g.to.line}, ${g.to.proc})`);
}
// Lines per 10 s window from the app (Rehearsly) and from everyone.
const buckets = new Map();
for (const e of events) {
  const k = Math.floor(e.t / 10000) * 10000;
  const b = buckets.get(k) ?? { all: 0, app: 0 };
  b.all += 1;
  if (e.proc.startsWith('Rehearsly')) b.app += 1;
  buckets.set(k, b);
}
console.log('window (10 s)            all   app');
for (const [k, b] of [...buckets].sort((a, b2) => a[0] - b2[0])) {
  console.log(`${new Date(k).toISOString()}  ${String(b.all).padStart(6)} ${String(b.app).padStart(5)}`);
}
