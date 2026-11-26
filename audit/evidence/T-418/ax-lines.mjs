// T-418 (review 1): one process's accessibility lines in a device-simulator.log,
// timestamps dropped and repeats folded, to set an "app ax: 0" Safari beside an
// "app ax: 1" one. Lines from libAccessibility, AXSupportCommon, AXCommon,
// AXRuntime, and the XCTest handshake.
// node ax-lines.mjs <device-simulator.log> <process[pid]>
import fs from 'node:fs';

const [file, proc] = process.argv.slice(2);
const seen = new Set();
const pattern = /libAccessibility|com\.apple\.Accessibility|AXRuntime|AXSupport|AXCommon|XCTTargetBootstrap|AutomationMode/;
for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
  if (!line.includes(` ${proc}: `) || !pattern.test(line)) continue;
  const what = line.slice(line.indexOf(`${proc}: `) + proc.length + 2).replace(/0x[0-9a-f]+/g, '0x…').slice(0, 220);
  if (seen.has(what)) continue;
  seen.add(what);
  console.log(`${line.slice(11, 23)}  ${what}`);
}
