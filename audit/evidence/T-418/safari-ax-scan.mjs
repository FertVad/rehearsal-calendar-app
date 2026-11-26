// T-418: for each opening of Safari in a Maestro driver log (device-xctest.log),
// how the driver's reads of Safari went: read whole, or answered
// kAXErrorAPIDisabled. An opening is lost when Safari was asked and never
// read; one with no read asked (Safari launched by Maestro and left at once)
// is listed, not counted.
// node safari-ax-scan.mjs <device-xctest.log>   (exit 1 if any opening was lost)
import fs from 'node:fs';

const lines = fs.readFileSync(process.argv[2], 'utf8').split('\n');
const at = (line) => line.slice(11, 26);
const openings = [];
let current = null;
for (const line of lines) {
  const running = /Detected running apps: \[(.*)\]/.exec(line);
  if (running) {
    const safari = running[1].includes('com.apple.mobilesafari');
    if (safari && !current) {
      current = { from: at(line), disabled: 0, read: 0 };
      openings.push(current);
    }
    if (!safari) current = null;
    continue;
  }
  if (!current) continue;
  if (/Snapshot failure, cannot return view hierarchy.*kAXErrorAPIDisabled/.test(line)) current.disabled += 1;
  if (/\[Done\] View hierarchy snapshot for Application 'com.apple.mobilesafari'/.test(line)) {
    current.read += 1;
    current.firstRead ??= at(line);
  }
}
let lost = 0;
for (const o of openings) {
  const isLost = !o.read && o.disabled > 0;
  if (isLost) lost += 1;
  const note = isLost ? '   <- lost' : (!o.read ? '   (not asked)' : '');
  console.log(`  ${o.from}  Safari reads: ${o.read}${o.firstRead ? ` (first ${o.firstRead})` : ''}, kAXErrorAPIDisabled: ${o.disabled}${note}`);
}
console.log(`Safari opened ${openings.length} time(s); lost: ${lost}`);
process.exit(lost ? 1 : 0);
