// Lists the lines of files under a directory that match a regular expression (T-208).
// node search.mjs <dir> <regex> [file regex]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const [dir, pattern, filePattern = '\\.(mm|m|h|swift)$'] = process.argv.slice(2);
const re = new RegExp(pattern);
const fileRe = new RegExp(filePattern);
const walk = (d) => {
  for (const name of readdirSync(d)) {
    const p = path.join(d, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (fileRe.test(name)) {
      readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
        if (re.test(line)) console.log(`${p}:${i + 1}: ${line.trim().slice(0, 200)}`);
      });
    }
  }
};
walk(dir);
