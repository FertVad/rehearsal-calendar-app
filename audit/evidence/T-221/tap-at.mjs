// T-221: which of a flow's taps a lost touch belongs to.
//
// touch-scan.mjs (T-207) gives the local time of each touch backboardd dropped;
// this lists the taps in the flow's commands.json whose run covers that time,
// and the command after them.
//
//   node audit/evidence/T-221/tap-at.mjs <flow artifacts dir> <HH:MM:SS.mmm> [UTC offset, default +02:00]
import fs from 'node:fs';
import path from 'node:path';

const [dir, at, offset = '+02:00'] = process.argv.slice(2);
const commands = JSON.parse(fs.readFileSync(path.join(dir, 'commands.json'), 'utf8'));
const day = new Date(commands[0].metadata.timestamp).toISOString().slice(0, 10);
const target = new Date(`${day}T${at}${offset}`).getTime();
commands.forEach((c, i) => {
  const kind = Object.keys(c.command)[0];
  const start = c.metadata.timestamp;
  const end = start + (c.metadata.duration ?? 0);
  if (kind !== 'tapOnElement' || start > target || end < target) return;
  const next = commands[i + 1];
  const nextKind = next && Object.keys(next.command)[0];
  console.log(`${at} lost in tap ${JSON.stringify(c.command[kind].selector)} `
    + `(${new Date(start).toISOString()} +${c.metadata.duration} ms, ${c.metadata.status})`);
  if (next) {
    console.log(`  next: ${nextKind} ${JSON.stringify(next.command[nextKind].selector ?? '')} `
      + `${next.metadata.status}${next.metadata.error ? ` - ${next.metadata.error.message}` : ''}`);
  }
});
