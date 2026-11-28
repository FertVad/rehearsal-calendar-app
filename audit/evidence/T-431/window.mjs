// T-431: the processes that log in a window of a device-simulator.log, each
// with its first line's time and whether it logged before the window (a
// process new in the window was started in it).
// node window.mjs <device-simulator.log> <from MM:SS.mmm> <to MM:SS.mmm>
// Lines carry either the host's zone (+0200) or the device's (-1000), whole
// hours apart: times are compared without the hour, so the window must lie in
// one hour.
import fs from 'node:fs';
import readline from 'node:readline';

const [file, from, to] = process.argv.slice(2);
const before = new Set();
const inWindow = new Map();
const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
for await (const line of rl) {
  const m = /^\S+ \d\d:(\d\d:\d\d\.\d{3})\d*[-+]\d{4}\s+\S+\s+([^:\s]+\[\d+\]):/.exec(line);
  if (!m) continue;
  const [, at, proc] = m;
  if (at < from) before.add(proc);
  else if (at <= to && !inWindow.has(proc)) inWindow.set(proc, at);
}
for (const [proc, at] of inWindow) console.log(`${at}  ${before.has(proc) ? '      ' : 'NEW   '}${proc}`);
