// T-216: gives files a new mtime and keeps their content, as a checkout or a
// commit that rewrites them does.  node audit/evidence/T-216/touch.mjs <files>
import { utimesSync } from 'node:fs';

const now = new Date();
for (const file of process.argv.slice(2)) {
  utimesSync(file, now, now);
  console.log(now.getTime(), file);
}
