// T-420: the order, in one run, of what a link from the app to apps.apple.com
// does in Safari and when Maestro read the screen.
//
//   node order.mjs <dir>...
//
// <dir> is a run's flow directory (e2e/out/artifacts/<run>/<flow>) or a copy
// of one; its files are found by name, .gz or not, the run's
// xctest_runner_*.log also one level up:
//   device-simulator*.log  SpringBoard's "Handling OpenURL from Rehearsly",
//                          Safari's main-frame load (didStartProvisionalLoad),
//                          apps.apple.com's hand-over to the App Store
//                          (Networking: Unable to convert "itms-appss" to
//                          port) and the load's end (didFailProvisionalLoad
//                          code=102 - no page was ever committed) or a commit;
//   xctest_runner_*.log    every read of the screen by Maestro's driver: which
//                          app's tree ("[Start] View hierarchy snapshot for
//                          Application '<id>'") and when it was done;
//   maestro.log            the flow's steps from the tap on the link on.
// Every time is the host's (+02:00). A read of Safari is "before the leap"
// when it was done before the hand-over line, "after" when it started after
// it.
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

function filesIn(dir) {
  const out = [];
  (function walk(p, depth) {
    for (const f of fs.readdirSync(p)) {
      const q = path.join(p, f);
      if (fs.statSync(q).isDirectory()) { if (depth < 2) walk(q, depth + 1); } else out.push(q);
    }
  })(dir, 0);
  // The runner keeps xctest_runner_*.log next to the flows' directories.
  const up = path.dirname(dir);
  for (const f of fs.readdirSync(up)) if (/^xctest_runner_.*\.log(\.gz)?$/.test(f)) out.push(path.join(up, f));
  return out;
}
const read = (file) => {
  const buf = fs.readFileSync(file);
  return (file.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8').split('\n');
};
const find = (files, re) => files.filter((f) => re.test(path.basename(f)));

// "2026-11-25 20:31:29.420773-1000" or "+0200" -> epoch ms
function stamp(line) {
  const m = /(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d)\.(\d{3})\d*([+-])(\d\d)(\d\d)/.exec(line);
  if (!m) return null;
  return Date.parse(`${m[1]}T${m[2]}.${m[3]}${m[4]}${m[5]}:${m[6]}`);
}
const HOST_OFFSET = 2 * 3600e3;
const host = (ms) => new Date(ms + HOST_OFFSET).toISOString().slice(11, 23);

for (const dir of process.argv.slice(2)) {
  const files = filesIn(dir);
  const device = find(files, /^device-simulator.*\.log(\.gz)?$/).flatMap(read);
  const runner = find(files, /^xctest_runner_.*\.log(\.gz)?$/).flatMap(read);
  const maestro = find(files, /^maestro\.log$/).flatMap(read);

  const openUrls = device.filter((l) => /Handling OpenURL from Rehearsly/.test(l));
  console.log(`\n${dir}`);
  if (!openUrls.length) console.log('  no link handed to iOS by Rehearsly in the device log');
  // Each link the app handed over, up to the next one (or 40 s).
  openUrls.forEach((open, i) => {
  const t0 = stamp(open);
  const tEnd = Math.min(t0 + 40000, openUrls[i + 1] ? stamp(openUrls[i + 1]) - 3000 : Infinity);
  if (openUrls.length > 1) console.log(`  -- link ${i + 1} of ${openUrls.length}`);
  const within = (l) => { const t = stamp(l); return t !== null && t >= t0 - 3000 && t <= tEnd; };
  const ev = (re) => device.filter((l) => re.test(l) && within(l)).map(stamp);

  const loadStart = ev(/MobileSafari.*WebPageProxy::didStartProvisionalLoadForFrame:.*isMainFrame=1/)[0];
  const leap = ev(/Unable to convert "itms-appss" to port/)[0];
  const failed = ev(/MobileSafari.*WebPageProxy::didFailProvisionalLoadForFrame:.*isMainFrame=1/)[0];
  const committed = ev(/MobileSafari.*WebPageProxy::didCommitLoadForFrame:.*isMainFrame=1/)[0];

  // Maestro's steps from the tap on, the date taken from the link's line.
  const day = new Date(t0 + HOST_OFFSET).toISOString().slice(0, 10);
  const steps = [];
  for (const l of maestro) {
    const m = /^(\d\d:\d\d:\d\d\.\d{3}) .*CliConsoleListener\.onCommand(Start|Finished): (.*) (RUNNING|COMPLETED|FAILED|SKIPPED)$/.exec(l);
    if (!m) continue;
    const t = Date.parse(`${day}T${m[1]}+02:00`);
    if (t >= t0 - 3000 && t <= tEnd) steps.push({ t, text: `${m[3]} ${m[4]}` });
  }

  // The driver's reads: start and done of each snapshot.
  const reads = [];
  for (const l of runner) {
    const s = /\[Start\] View hierarchy snapshot for Application '([^']+)'/.exec(l);
    const d = /\[Done\] View hierarchy snapshot for Application '([^']+)'/.exec(l);
    const t = stamp(l);
    if (t === null || t < t0 || t > tEnd) continue;
    if (s) reads.push({ app: s[1], start: t });
    else if (d) { const r = reads.findLast((x) => x.app === d[1] && x.done === undefined); if (r) r.done = t; }
  }

  console.log(`  ${host(t0)}  SpringBoard: Rehearsly handed iOS ${open.replace(/.*Rehearsly:\d+: /, '')}`);
  if (loadStart) console.log(`  ${host(loadStart)}  Safari starts loading it (+${((loadStart - t0) / 1000).toFixed(2)} s)`);
  else console.log('  Safari never started loading it');
  if (committed) console.log(`  ${host(committed)}  a page committed`);
  if (leap) console.log(`  ${host(leap)}  apps.apple.com hands Safari to itms-appss:// (+${((leap - loadStart) / 1000).toFixed(2)} s into the load)`);
  if (failed) console.log(`  ${host(failed)}  the load ends: didFailProvisionalLoad (code 102), no page committed`);
  const safari = reads.filter((r) => r.app === 'com.apple.mobilesafari');
  const app = reads.filter((r) => r.app !== 'com.apple.mobilesafari');
  console.log(`  reads of Rehearsly's tree after the link: ${app.length}` +
    (app.length ? `, the last done ${host(app.at(-1).done ?? app.at(-1).start)}` : ''));
  const end = failed ?? leap;
  const before = safari.filter((r) => end && (r.done ?? r.start) < end);
  const during = safari.filter((r) => end && r.start < end && (r.done ?? r.start) >= end);
  const after = safari.filter((r) => !end || r.start >= end);
  console.log(`  reads of Safari: ${safari.length} - before the leap ${before.length}, across it ${during.length}, after it ${after.length}`);
  if (safari[0]) console.log(`  first read of Safari: ${host(safari[0].start)}-${safari[0].done ? host(safari[0].done) : '?'}`);
  for (const r of before) console.log(`    before: ${host(r.start)}-${host(r.done)}`);
  const order = !end ? 'no leap seen' : before.length ? 'read before the leap' : 'read only after the leap';
  console.log(`  order: ${order}`);
  for (const s of steps) {
    if (/apps\\\.apple|TabBarItemTitle|breadcrumb|profile-rate-app|opened-url|Safari cannot|safari-from-app/.test(s.text)) {
      console.log(`  ${host(s.t)}  maestro: ${s.text.slice(0, 140)}`);
    }
  }
  });
}
