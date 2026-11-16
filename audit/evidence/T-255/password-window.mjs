// T-255: for each flow of a Maestro artifacts folder, the taps on "Sign In"
// and on the "+" (tab-create), and when iOS hosted its "Save Password"
// controller in the app (SFPasswordSavingRemoteViewController requested ->
// its SafariViewService scene invalidated), all on the device's clock.
//
//   node audit/evidence/T-255/password-window.mjs <artifacts folder>
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
const clock = (line) => line.match(/\d\d:\d\d:\d\d\.\d{3}/)?.[0];
const seconds = (t) => { const [h, m, s] = t.split(':'); return +h * 3600 + +m * 60 + +s; };

for (const flow of fs.readdirSync(root)) {
  const logs = path.join(root, flow, 'logs');
  if (!fs.existsSync(path.join(logs, 'device-simulator.log'))) continue;
  const device = fs.readFileSync(path.join(logs, 'device-simulator.log'), 'utf8').split('\n');
  const maestro = fs.readFileSync(path.join(logs, 'maestro.log'), 'utf8').split('\n');
  // The app's lines are on the simulator's clock (Honolulu); Maestro's on the
  // Mac's. The offset is read off the first line that has both: the app's own.
  const appLine = device.find((l) => /Rehearsly\[\d+\]/.test(l) && /[+-]\d{4}\s/.test(l));
  const zone = appLine?.match(/([+-])(\d\d)(\d\d)\s/);
  const appOffset = zone ? (zone[1] === '-' ? -1 : 1) * (+zone[2] * 3600 + +zone[3] * 60) : 0;
  const hostLine = device.find((l) => !/Rehearsly\[/.test(l) && /[+-]\d{4}\s/.test(l));
  const hz = hostLine?.match(/([+-])(\d\d)(\d\d)\s/);
  const hostOffset = hz ? (hz[1] === '-' ? -1 : 1) * (+hz[2] * 3600 + +hz[3] * 60) : 0;
  const toHost = (t) => { let s = seconds(t) - appOffset + hostOffset; s = ((s % 86400) + 86400) % 86400; return s; };

  const windows = [];
  let open = null;
  for (const line of device) {
    if (!/Rehearsly\[/.test(line)) continue;
    if (/Requesting remote view controller SFPasswordSavingServiceViewController/.test(line)) open = toHost(clock(line));
    if (open !== null && /Invalidating scene: UISceneHosting-com\.rehearsal\.app:UIHostedScene-com\.apple\.SafariViewService/.test(line)) {
      windows.push([open, toHost(clock(line))]);
      open = null;
    }
  }
  if (open !== null) windows.push([open, Infinity]);

  const taps = [];
  for (const line of maestro) {
    const id = line.match(/Tapping on element:.*resource-id=(login-submit|tab-create)/)?.[1];
    if (id) taps.push([seconds(clock(line)), id]);
  }
  const fmt = (s) => (s === Infinity ? 'never' : new Date(s * 1000).toISOString().slice(11, 23));
  console.log(`${flow}`);
  for (const [a, b] of windows) console.log(`  password controller hosted ${fmt(a)} - ${fmt(b)}`);
  for (const [t, id] of taps) {
    const inside = windows.some(([a, b]) => t >= a && t <= b);
    console.log(`  tap ${id.padEnd(12)} ${fmt(t)}${inside ? '  <- inside the password controller window' : ''}`);
  }
}
