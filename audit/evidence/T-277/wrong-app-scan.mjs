#!/usr/bin/env node
// T-277: after Safari is opened (Maestro stops it, then opens a link), which
// app does Maestro's driver read? For each opening in a device-xctest.log it
// lists the snapshots of other apps taken before Safari's first one, and every
// 60 s "XCTPerformOnMainRunLoop work timed out" (the night run's failure).
//
//   node audit/evidence/T-277/wrong-app-scan.mjs <device-xctest.log>…
//
// Exit 1 when any opening read another app first: the flow ran with the app
// it does not drive still behind Safari.
import fs from 'node:fs';

const time = (line) => line.slice(11, 26);
let wrongOpenings = 0;
let hangs = 0;

for (const file of process.argv.slice(2)) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  let opening = null;
  const openings = [];
  for (const line of lines) {
    if (line.includes('[End] Terminating app com.apple.mobilesafari')) {
      opening = { at: time(line), others: [], hang: false };
      openings.push(opening);
      continue;
    }
    if (!opening) continue;
    const snap = line.match(/\[Start\] View hierarchy snapshot for Application '([^']+)'/);
    if (snap) {
      if (snap[1] === 'com.apple.mobilesafari') opening = null;
      else opening.others.push(`${time(line)} ${snap[1]}`);
    }
    if (opening && line.includes('XCTPerformOnMainRunLoop work timed out after 60.0s')
      && line.includes('Snapshot failure')) {
      opening.hang = true;
      opening.others.push(`${time(line)} 60 s timeout`);
    }
  }
  console.log(`${file}\n  Safari opened ${openings.length} time(s)`);
  for (const o of openings) {
    const verdict = o.others.length ? `read another app first: ${o.others.length}` : 'Safari read first';
    console.log(`  ${o.at}  ${verdict}${o.hang ? '  (hung 60 s)' : ''}`);
    for (const other of o.others) console.log(`      ${other}`);
    if (o.others.length) wrongOpenings += 1;
    if (o.hang) hangs += 1;
  }
}
console.log(`\nopenings that read another app first: ${wrongOpenings}; of them hung 60 s: ${hangs}`);
process.exit(wrongOpenings ? 1 : 0);
