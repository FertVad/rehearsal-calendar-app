// Reads a run's logs - plain or .gz - and prints the lines that match a
// pattern, so the order of Safari's page, its leap to itms-appss:// and
// Maestro's reads of the screen can be put side by side (T-420).
// node grep-logs.mjs <dir-or-file> <regex> [maxLines]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';

const [target, pattern, max = '400'] = process.argv.slice(2);
if (!target || !pattern) {
  console.error('usage: node grep-logs.mjs <dir-or-file> <regex> [maxLines]');
  process.exit(2);
}
const re = new RegExp(pattern);
const files = [];
(function walk(p) {
  if (statSync(p).isDirectory()) for (const f of readdirSync(p).sort()) walk(join(p, f));
  else files.push(p);
})(target);

let printed = 0;
for (const file of files) {
  if (/\.(png|jpg|mp4)$/.test(file)) continue;
  let buf = readFileSync(file);
  if (file.endsWith('.gz')) buf = gunzipSync(buf);
  const lines = buf.toString('utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!re.test(lines[i])) continue;
    console.log(`${file.slice(target.length)}:${i + 1}: ${lines[i].slice(0, 400)}`);
    if (++printed >= Number(max)) process.exit(0);
  }
}
