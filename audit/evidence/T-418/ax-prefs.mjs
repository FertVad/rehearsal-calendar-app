// T-418: the e2e simulator's accessibility preferences, where iOS keeps the
// per-app accessibility switch ("Stored App AX setting" in the device log).
// node ax-prefs.mjs   - lists the preference files about accessibility and
// prints each as XML.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { devices } = JSON.parse(execFileSync('xcrun', ['simctl', 'list', 'devices', '--json'], { encoding: 'utf8' }));
const device = Object.values(devices).flat().find((d) => d.name === 'Rehearsly E2E');
const prefs = path.join(os.homedir(), 'Library/Developer/CoreSimulator/Devices', device.udid, 'data/Library/Preferences');
for (const name of fs.readdirSync(prefs).filter((n) => /ccessib|AXS|AX\b|mobilesafari\.plist/.test(n))) {
  const file = path.join(prefs, name);
  console.log(`== ${name} (${fs.statSync(file).mtime.toISOString()})`);
  console.log(execFileSync('plutil', ['-convert', 'xml1', '-o', '-', file], { encoding: 'utf8' }).slice(0, 4000));
}
