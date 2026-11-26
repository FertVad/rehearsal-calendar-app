// T-297: how __tests__/postgres/fixtures/migrator-477ea2f was made. Run from
// the repository root with the full history: `node audit/evidence/T-297/extract-fixture.mjs`.
// Writes each file of 477ea2f's migrator code byte for byte and prints its
// sha256 (the literals pinned in t294Upgrade.mjs).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = '477ea2f';
const prefix = 'rehearsal-calendar-native/server/';
const target = `${prefix}__tests__/postgres/fixtures/migrator-${base}`;
const files = [
  'scripts/migrate.js',
  'database/migrations/artifacts.mjs',
  'database/migrations/cli.mjs',
  'database/migrations/core.mjs',
  'database/migrations/errors.mjs',
  'database/migrations/history.mjs',
  'database/migrations/sql.mjs',
  'database/schema/manifest.mjs',
];
for (const file of files) {
  const bytes = execFileSync('git', ['show', `${base}:${prefix}${file}`], { maxBuffer: 16 * 1024 * 1024 });
  const out = path.join(target, file);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, bytes);
  console.log(`${createHash('sha256').update(bytes).digest('hex')}  ${file}`);
}
