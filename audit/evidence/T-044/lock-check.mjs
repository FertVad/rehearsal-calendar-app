// T-044: package-lock.json root entry must list exactly package.json's dependencies,
// and nothing in the lock may still need a removed package.
// Usage: node audit/evidence/T-044/lock-check.mjs <dir> <removed-package>
import fs from 'node:fs';
import path from 'node:path';

const [dir, removed] = process.argv.slice(2);
const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(dir, 'package-lock.json'), 'utf8'));
const root = lock.packages[''];
let bad = 0;
for (const kind of ['dependencies', 'devDependencies']) {
  const a = JSON.stringify(pkg[kind] || {}), b = JSON.stringify(root[kind] || {});
  console.log(`${kind}: ${a === b ? 'lock root == package.json' : 'MISMATCH'}`);
  if (a !== b) bad++;
}
const entries = Object.keys(lock.packages).filter(k => k === `node_modules/${removed}` || k.endsWith(`/node_modules/${removed}`));
console.log(`lock entries for ${removed}: ${entries.length}`);
const needers = Object.entries(lock.packages).filter(([, p]) =>
  ['dependencies', 'optionalDependencies', 'peerDependencies'].some(k => p[k] && removed in p[k]));
console.log(`lock packages that depend on ${removed}: ${needers.map(([k]) => k || '<root>').join(', ') || 'none'}`);
process.exit(bad || entries.length || needers.length ? 1 : 0);
