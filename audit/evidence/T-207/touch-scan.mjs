// T-207: lost taps across the simulator logs Maestro kept.
//
// For every flow's device-simulator.log under e2e/out/artifacts, counts the
// synthetic digitizers XCTest attached (one per tap), the ones backboardd
// registered twice ("we already have a service for senderID"), and the touch
// events it dropped ("didn't see a previous touch down"). With --banner, also
// the times the app's scene went to foreground while it was already up (the
// DevLoadingView window) and how far each dropped touch was from the last one.
//
//   node audit/evidence/T-207/touch-scan.mjs [artifacts dir]
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? 'rehearsal-calendar-native/e2e/out/artifacts');
const rows = [];
for (const run of fs.readdirSync(root).sort()) {
  const runDir = path.join(root, run);
  if (!fs.statSync(runDir).isDirectory()) continue;
  for (const flow of fs.readdirSync(runDir)) {
    const log = path.join(runDir, flow, 'logs', 'device-simulator.log');
    if (!fs.existsSync(log)) continue;
    let attached = 0, twice = 0, dropped = 0, lost = 0, prevDropped = false, scenes = 0, lastScene = null, tapsSinceScene = 0;
    const lostAt = [], twiceAfterScene = [];
    const secs = (t) => { const [h, m, s] = t.split(':'); return h * 3600 + m * 60 + Number(s); };
    for (const line of fs.readFileSync(log, 'utf8').split('\n')) {
      if (!line.includes('backboardd')) continue;
      const at = line.slice(11, 23);
      if (line.includes('new scene host settings') && line.includes('com.rehearsal.app')) {
        scenes++; lastScene = `${at} ${line.replace(/^.*-default> /, '')}`; tapsSinceScene = 0;
      }
      if (line.includes('digitizer attached')) { attached++; tapsSinceScene++; }
      else if (line.includes('we already have a service for senderID')) {
        twice++;
        twiceAfterScene.push(lastScene
          ? `${(secs(at) - secs(lastScene.slice(0, 12))).toFixed(2)}s/tap ${tapsSinceScene} after "${lastScene.slice(13)}"`
          : '-');
      }
      else if (line.includes("didn't see a previous touch down")) {
        dropped++;
        if (!prevDropped) { lost++; lostAt.push(line.slice(11, 23)); }
        prevDropped = true;
        continue;
      }
      if (line.includes('digitizer detached')) prevDropped = false;
    }
    // What Maestro made of each lost tap: the line after its "Try tapping".
    const maestroLog = path.join(runDir, flow, 'logs', 'maestro.log');
    const maestro = fs.existsSync(maestroLog) ? fs.readFileSync(maestroLog, 'utf8').split('\n') : [];
    const verdicts = lostAt.map((at) => {
      let i = -1;
      maestro.forEach((l, n) => { if (l.includes('Try tapping') && l.slice(0, 12) <= at) i = n; });
      if (i < 0) return `${at} ?`;
      const next = maestro.slice(i + 1, i + 6).find((l) => /screenshotBasedTap|retry|Retry/i.test(l)) ?? '';
      return `${at} -> ${next.replace(/^.*?: /, '').slice(0, 90)}`;
    });
    rows.push({ run, flow, attached, twice, dropped, lost, lostAt: verdicts, scenes, twiceAfterScene });
  }
}

let taps = 0, twiceAll = 0, lostAll = 0;
for (const r of rows) {
  taps += r.attached; twiceAll += r.twice; lostAll += r.lost;
  if (r.twice || r.lost) {
    console.log(`${r.run}  ${r.flow}: digitizers ${r.attached}, registered twice ${r.twice} (s after the app's last scene change: ${r.twiceAfterScene.join(', ')}), app scene changes ${r.scenes}, taps lost ${r.lost}`);
    for (const v of r.lostAt) console.log(`    lost ${v}`);
  }
}
console.log(`\n${rows.length} flow logs, ${taps} digitizers attached, ${twiceAll} registered twice, ${lostAll} taps lost`);
