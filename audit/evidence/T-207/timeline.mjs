// T-207: one flow's run as a timeline - Maestro's commands, the app's scene
// changes, the digitizers registered twice and the touches dropped.
//
//   node audit/evidence/T-207/timeline.mjs <flow artifacts dir> [from HH:MM:SS]
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
const from = process.argv[3] ?? '';
const events = [];
const read = (f) => fs.readFileSync(path.join(dir, 'logs', f), 'utf8').split('\n');

for (const line of read('maestro.log')) {
  const m = line.match(/^(\d\d:\d\d:\d\d\.\d{3}) .*onCommandStart: (.*) RUNNING$/);
  if (m) events.push([m[1], `maestro  ${m[2].slice(0, 70)}`]);
  const t = line.match(/^(\d\d:\d\d:\d\d\.\d{3}) .*(Try tapping at \S+ \S+|Something have changed.*|Nothing changed.*|retry.*)$/i);
  if (t) events.push([t[1], `maestro    ${t[2].slice(0, 70)}`]);
}
let dropping = false;
for (const line of read('device-simulator.log')) {
  if (!line.includes('backboardd')) continue;
  const at = line.slice(11, 23);
  if (line.includes('new scene host settings') && line.includes('com.rehearsal.app')) {
    events.push([at, `device   app scene ${line.replace(/^.*-default> /, '')}`]);
  } else if (line.includes('we already have a service for senderID')) {
    events.push([at, 'device   tap digitizer registered twice']);
  } else if (line.includes("didn't see a previous touch down")) {
    if (!dropping) events.push([at, 'device   touch dropped (move/lift with no touch down)']);
    dropping = true;
  } else if (line.includes('digitizer detached')) dropping = false;
}
for (const [at, what] of events.sort((a, b) => a[0].localeCompare(b[0]))) {
  if (at >= from) console.log(`${at}  ${what}`);
}
