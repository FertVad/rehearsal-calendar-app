// T-431 review: the lines of a device-simulator.log in a window, optionally
// only those matching a pattern, cut to 220 characters.
// node lines.mjs <device-simulator.log> <from MM:SS.mmm> <to MM:SS.mmm> [pattern]
// Times are compared without the hour (see window.mjs).
import fs from 'node:fs';
import readline from 'node:readline';

const [file, from, to, pattern] = process.argv.slice(2);
const only = pattern ? new RegExp(pattern) : null;
const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
for await (const line of rl) {
  const m = /^\S+ \d\d:(\d\d:\d\d\.\d{3})/.exec(line);
  if (!m || m[1] < from || m[1] > to) continue;
  if (only && !only.test(line)) continue;
  console.log(line.slice(0, 220));
}
