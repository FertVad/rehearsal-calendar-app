// T-253: how each synthesized touch of d3's landing runs (12.11.2026,
// ~/.maestro/tests/2026-11-12_08*) reached the simulator.
// For every XCTest "Recap event action playback" in a run's
// device-simulator.log it prints: the time, the point XCTest synthesized,
// and whether backboardd showed the T-207 signature - the digitizer
// registered twice ("unknown digitizer ... initializing now"), events
// skipped ("didn't see a previous touch down"), and the contact cancelled
// while still touching ("canceling paths contacts: [pathIndex ...") with no
// "presence: none" (lift) before it.
// With --save <dir>, each lost touch's lines (from the playback's start to
// its end, verbatim, with the log's line numbers) go to
// <dir>/<run>/<flow>/lost-touch-<time>.log.
// Usage: node audit/evidence/T-253/d3-touches.mjs [--save <dir>] <run/flow> ...
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.join(os.homedir(), '.maestro', 'tests');
const args = process.argv.slice(2);
const si = args.indexOf('--save');
const save = si >= 0 ? args.splice(si, 2)[1] : null;

for (const run of args) {
  const file = path.join(root, run, 'logs', 'device-simulator.log');
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  console.log(`\n## ${run}`);
  let seg = null;
  let point = '';
  const flush = (end) => {
    if (!seg) return;
    const lost = seg.cancelTouching && !seg.lifted;
    if (lost && save) {
      const dest = path.join(save, run, `lost-touch-${seg.time.replace(/:/g, '')}.log`);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const from = Math.max(0, seg.line - 5);
      fs.writeFileSync(dest,
        `# ${run}/logs/device-simulator.log, lines ${from + 1}-${end}: the touch at ${seg.point} (${seg.time})\n` +
        lines.slice(from, end).map((l, k) => `${from + k + 1}: ${l}`).join('\n') + '\n');
    }
    console.log(
      `${seg.time}  point ${seg.point || '?'}  line ${seg.line}  ` +
        `reinit=${seg.reinit} skipped=${seg.skipped} lifted=${seg.lifted} cancelledWhileTouching=${seg.cancelTouching}  => ` +
        (lost ? 'LOST (T-207 signature)' : 'delivered'),
    );
    seg = null;
  };
  lines.forEach((l, i) => {
    const p = l.match(/_XCSynthesizedPointerEvent: 0x[0-9a-f]+> \{([\d.]+, [\d.]+)\}/);
    if (p) point = p[1];
    if (/Recap event action playback initiated/.test(l)) {
      flush(i);
      seg = { time: '', point, line: i + 1, reinit: false, skipped: 0, lifted: false, cancelTouching: false };
      point = '';
    }
    if (!seg) return;
    const t = l.match(/^\d{4}-\d\d-\d\d (\d\d:\d\d:\d\d\.\d{3})\d*\+0200/);
    if (t && !seg.time) seg.time = t[1];
    if (/unknown digitizer .*-- initializing now/.test(l)) seg.reinit = true;
    if (/didn't see a previous touch down/.test(l)) seg.skipped++;
    if (/presence: none/.test(l)) seg.lifted = true;
    if (/canceling paths contacts: \[pathIndex/.test(l) && !seg.lifted) seg.cancelTouching = true;
    if (/Recap event action playback completed/.test(l)) flush(i + 1);
  });
  flush(lines.length);
}
