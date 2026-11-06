// T-042: plain-text cross-check of the unused StyleSheet keys found by
// unused-styles.mjs. Input: a file of lines "  <file>:<line> <key>" (the
// "Unused keys" block of unused-styles.mjs).
// Usage: node grep-keys.mjs rehearsal-calendar-native <list-file>
// For each key it searches:
//   - the styles file itself, whole word, outside the declaration line;
//   - all of src/, a property read `.key` or `['key']` (barrel imports such as
//     `import { styles } from '../styles'` hide the module's name);
//   - all of e2e/ and server/, whole word (a name could be used as a string there).
// Prints every hit, so each one can be put to the style object it reads.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2]);
const list = fs.readFileSync(process.argv[3], 'utf8').split('\n')
  .map((l) => l.trim().match(/^(\S+):(\d+) (\S+)$/)).filter(Boolean);

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  if (e.name === 'node_modules' || e.name === 'out') return [];
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p) : /\.(ts|tsx|js|mjs|cjs|yaml|json|html)$/.test(e.name) ? [p] : [];
});
const src = walk(path.join(root, 'src'));
const other = [...walk(path.join(root, 'e2e')), ...walk(path.join(root, 'server'))];
const text = new Map([...src, ...other].map((f) => [f, fs.readFileSync(f, 'utf8')]));

let total = 0;
for (const [, file, line, key] of list) {
  const abs = path.join(root, file);
  const mod = path.basename(file).replace(/\.tsx?$/, '');
  const importers = src.filter((f) => f !== abs && text.get(f).includes(mod));
  const re = new RegExp(`\\b${key}\\b`);
  const access = new RegExp(`\\.${key}\\b|\\[['"\`]${key}['"\`]\\]`);
  const hits = [];
  for (const f of [abs, ...src.filter((x) => x !== abs), ...other]) {
    text.get(f).split('\n').forEach((l, i) => {
      if (f === abs && i + 1 === Number(line)) return;
      const r = f === abs || other.includes(f) ? re : access;
      if (r.test(l)) hits.push(`${path.relative(root, f)}:${i + 1}: ${l.trim()}`);
    });
  }
  total += hits.length;
  console.log(`${file}:${line} ${key} — importers ${importers.map((f) => path.relative(root, f)).join(', ') || 'none'} — hits ${hits.length}`);
  for (const h of hits) console.log(`    ${h}`);
}
console.log(`keys ${list.length}, grep hits ${total}`);
