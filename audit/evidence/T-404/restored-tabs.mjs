#!/usr/bin/env node
// T-404: how many tabs Safari restored at each launch, by flow, from a run's
// device logs: `node audit/evidence/T-404/restored-tabs.mjs <artifacts dir>…`.
// Safari says it once per launch: "Read <n> normal tabs from saved state".
// Exits 1 if any launch in any flow restored a tab.
import fs from 'node:fs';
import path from 'node:path';

const dirs = process.argv.slice(2);
if (!dirs.length) {
  console.error('usage: restored-tabs.mjs <artifacts dir>…');
  process.exit(2);
}

function logs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return logs(full);
    return entry.name === 'device-simulator.log' ? [full] : [];
  });
}

let restored = 0;
let launches = 0;
for (const dir of dirs) {
  for (const log of logs(dir)) {
    const flow = path.basename(path.dirname(path.dirname(log)));
    const reads = fs.readFileSync(log, 'utf8').split('\n')
      .map((line) => line.match(/^(\S+ \S+).*Read (\d+) normal tabs from saved state/))
      .filter(Boolean);
    const opened = fs.readFileSync(log, 'utf8').split('\n')
      .filter((line) => /policy = New Foreground Tab/.test(line) && /loading intent/.test(line)).length;
    console.log(`${flow}: ${reads.length} Safari launch(es); tabs restored: ${reads.map((m) => `${m[2]} at ${m[1]}`).join(', ') || 'none read'}; links opened as new tabs: ${opened}`);
    launches += reads.length;
    restored += reads.reduce((sum, m) => sum + Number(m[2]), 0);
  }
}
console.log(`total: ${launches} launch(es), ${restored} tab(s) restored`);
process.exit(restored > 0 ? 1 : 0);
