// T-431: the touches backboardd lost in device-simulator.log(s) - "we already
// have a service for senderID" followed by "didn't see a previous touch down"
// (docs/e2e.md, "A lost tap") - per log, with their times, and the taps
// Maestro started in that flow's maestro.log, so the lost one can be named.
// node lost-touches.mjs <folder to search>...
import fs from 'node:fs';
import path from 'node:path';

const logs = (where) => (fs.statSync(where).isDirectory()
  ? fs.readdirSync(where).flatMap((name) => logs(path.join(where, name)))
  : (path.basename(where) === 'device-simulator.log' ? [where] : []));
for (const file of process.argv.slice(2).flatMap(logs)) {
  const lost = [];
  let twice = null;
  // Read in pieces: some logs are hundreds of MB.
  const fd = fs.openSync(file, 'r');
  const buffer = Buffer.alloc(1 << 22);
  let rest = '';
  for (let n; (n = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0;) {
    const text = rest + buffer.toString('utf8', 0, n);
    const lines = text.split('\n');
    rest = lines.pop();
    for (const line of lines) {
      if (line.includes('we already have a service for senderID')) twice = line.slice(11, 23);
      else if (twice && line.includes("didn't see a previous touch down")) { lost.push(twice); twice = null; }
    }
  }
  fs.closeSync(fd);
  const maestro = path.join(path.dirname(file), 'maestro.log');
  const taps = fs.existsSync(maestro)
    ? fs.readFileSync(maestro, 'utf8').split('\n').filter((l) => /onCommandStart: Tap on/.test(l)).map((l) => `${l.slice(0, 12)} ${l.slice(l.indexOf('Tap on'), l.indexOf(' RUNNING'))}`)
    : [];
  console.log(`${file.replace(/.*e2e\/out\//, '')}\n  lost: ${lost.length} ${lost.join(', ')}\n  taps: ${taps.length}${taps.length ? `, first ${taps[0]}` : ''}`);
}
