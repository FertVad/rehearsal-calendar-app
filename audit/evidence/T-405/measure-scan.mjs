// T-405 review, point 1: the runner's Safari check, as of 760e769 (each log
// read whole, LAUNCH on every line) and now (e2e/safari.mjs: read in pieces,
// LAUNCH only on lines with its text), timed on the device logs of the runs
// in e2e/out/artifacts. Same launches found, or it exits 1.
//   cd rehearsal-calendar-native && node ../audit/evidence/T-405/measure-scan.mjs
import fs from 'node:fs';
import path from 'node:path';
import { safariLaunches } from '../../../rehearsal-calendar-native/e2e/safari.mjs';

// safariLaunches of 760e769, verbatim.
const LAUNCH = /^(\S+ \S+).*MobileSafari.*Read (\d+) normal tabs from saved state/;
function oldSafariLaunches(runDir) {
  const launches = new Map();
  if (!fs.existsSync(runDir)) return launches;
  for (const flow of fs.readdirSync(runDir)) {
    const log = path.join(runDir, flow, 'logs', 'device-simulator.log');
    if (!fs.existsSync(log)) continue;
    launches.set(flow, fs.readFileSync(log, 'utf8').split('\n')
      .map((line) => LAUNCH.exec(line)).filter(Boolean)
      .map((match) => ({ at: match[1], tabs: Number(match[2]) })));
  }
  return launches;
}

const root = path.resolve('e2e/out/artifacts');
let bytes = 0;
let logs = 0;
let largest = 0;
let oldMs = 0;
let newMs = 0;
let same = true;
for (const run of fs.readdirSync(root).sort()) {
  const dir = path.join(root, run);
  for (const flow of fs.readdirSync(dir)) {
    const log = path.join(dir, flow, 'logs', 'device-simulator.log');
    if (!fs.existsSync(log)) continue;
    const size = fs.statSync(log).size;
    bytes += size;
    logs += 1;
    largest = Math.max(largest, size);
  }
  let start = performance.now();
  const before = oldSafariLaunches(dir);
  oldMs += performance.now() - start;
  start = performance.now();
  const after = await safariLaunches(dir);
  newMs += performance.now() - start;
  const count = [...after.values()].reduce((sum, list) => sum + list.length, 0);
  const match = JSON.stringify([...before]) === JSON.stringify([...after]);
  same &&= match;
  console.log(`${run}: launches ${count}, same as 760e769: ${match}`);
}
const mb = (n) => (n / 2 ** 20).toFixed(1);
console.log(`${logs} device logs, ${mb(bytes)} MB, the largest ${mb(largest)} MB`);
console.log(`760e769 (whole, LAUNCH on every line): ${Math.round(oldMs)} ms`);
console.log(`now (in pieces, LAUNCH on its lines):  ${Math.round(newMs)} ms`);
if (!same) process.exit(1);
