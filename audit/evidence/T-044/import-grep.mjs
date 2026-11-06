// T-044: for every dependency in a package.json, list the tracked files that import it.
// Usage: node audit/evidence/T-044/import-grep.mjs <dir-with-package.json> [<search-root>]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
const root = process.argv[3] || dir;
const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
const files = execFileSync('git', ['ls-files', root], { encoding: 'utf8' })
  .split('\n').filter(f => /\.(c|m)?(j|t)sx?$/.test(f) || f.endsWith('.json') && !f.endsWith('package-lock.json'));
const esc = s => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
for (const kind of ['dependencies', 'devDependencies']) {
  console.log(`## ${kind}`);
  for (const name of Object.keys(pkg[kind] || {})) {
    const re = new RegExp(`(from\\s+|import\\(\\s*|require\\(\\s*|jest\\.mock\\(\\s*|["'])${esc(name)}(/[^'"]*)?['"]`);
    const hits = [];
    for (const f of files) {
      if (f.endsWith('/package.json')) continue;
      const lines = fs.readFileSync(f, 'utf8').split('\n');
      lines.forEach((l, i) => { if (re.test(l)) hits.push(`${f}:${i + 1}`); });
    }
    console.log(`${name}: ${hits.length} file refs${hits.length ? ' — e.g. ' + hits.slice(0, 3).join(', ') : ''}`);
  }
}
