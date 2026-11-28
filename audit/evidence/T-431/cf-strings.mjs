// T-431: the printable strings of a binary that match a pattern, with the
// strings around each (as `strings | grep -C`), to see what CoreFoundation
// logs next to "home directory is inaccessible".
// node cf-strings.mjs <binary> <regexp> [around=3]
import fs from 'node:fs';

const [file, pattern, around = '3'] = process.argv.slice(2);
const data = fs.readFileSync(file);
const found = [];
let start = -1;
for (let i = 0; i <= data.length; i += 1) {
  const c = data[i];
  const printable = c >= 0x20 && c < 0x7f;
  if (printable && start < 0) start = i;
  if (!printable && start >= 0) {
    if (i - start >= 6) found.push(data.toString('latin1', start, i));
    start = -1;
  }
}
const re = new RegExp(pattern, 'i');
const n = Number(around);
found.forEach((s, i) => {
  if (!re.test(s)) return;
  console.log(`--- #${i}`);
  for (let j = Math.max(0, i - n); j <= Math.min(found.length - 1, i + n); j += 1) console.log(`${j === i ? '>' : ' '} ${found[j]}`);
});
