// T-213: taps on "Not Now" (iOS's "Save Password?" sheet) across the kept
// Maestro artifacts, and the ones the simulator dropped.
//
// For every flow's artifacts, lines up the flow's commands and the simulator's
// touch handling (audit/evidence/T-207/timeline.mjs) and counts the taps on
// "Not Now", and those followed by a dropped touch before the next command.
//
//   node audit/evidence/T-213/not-now-scan.mjs [artifacts dir]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(process.argv[2] ?? 'rehearsal-calendar-native/e2e/out/artifacts');
const timeline = path.resolve('audit/evidence/T-207/timeline.mjs');
let taps = 0, lost = 0, flows = 0;
for (const run of fs.readdirSync(root).sort()) {
  const runDir = path.join(root, run);
  if (!fs.statSync(runDir).isDirectory()) continue;
  for (const flow of fs.readdirSync(runDir).sort()) {
    const dir = path.join(runDir, flow);
    if (!fs.existsSync(path.join(dir, 'logs', 'device-simulator.log'))) continue;
    flows++;
    let lines;
    try {
      lines = execFileSync('node', [timeline, dir], { encoding: 'utf8', maxBuffer: 1 << 28 }).split('\n');
    } catch {
      continue;
    }
    for (let i = 0; i < lines.length; i++) {
      if (!/maestro {2}Tap on .*"Not Now"/.test(lines[i])) continue;
      taps++;
      for (let j = i + 1; j < lines.length && !/maestro {2}\S/.test(lines[j]); j++) {
        if (lines[j].includes('touch dropped')) {
          lost++;
          console.log(`lost: ${run} / ${flow}: ${lines[i].trim()}`);
          break;
        }
      }
    }
  }
}
console.log(`${flows} flow logs, ${taps} taps on "Not Now", ${lost} dropped`);
