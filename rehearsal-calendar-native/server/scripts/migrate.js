#!/usr/bin/env node
/**
 * Applies pending SQL migrations, once each.
 *
 * Usage:
 *   npm run migrate            apply everything not yet applied
 *   npm run migrate -- --dry   list what would be applied, change nothing
 *   npm run migrate -- --baseline
 *                              record every current file as applied WITHOUT
 *                              running it — for a database that already has
 *                              them. Needed once per environment.
 *
 * Why a baseline exists at all: migrations/ grew as a pile of hand-run files,
 * four of which drop columns or rewrite data. Those have long since been
 * applied to production, and running them again would break it. The runner
 * therefore refuses to guess about the past — it is told, once, that everything
 * present is done, and only manages what comes after.
 *
 * Naming: prefix new files with a number (003-, 004-) so order is explicit.
 * Files ending -postgres.sql or -sqlite.sql run only on that engine; anything
 * else runs on both.
 *
 * This is deliberately NOT wired into deployment. Vercel starts many instances
 * at once and they would race each other; a schema change is a decision someone
 * makes, then watches.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(__dirname, '..');
const migrationsDir = path.join(serverRoot, 'migrations');

dotenv.config({ path: path.join(serverRoot, '.env') });

const args = process.argv.slice(2);
const dryRun = args.includes('--dry');
const baseline = args.includes('--baseline');

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const isPostgres = Boolean(databaseUrl);

/** Files this engine should run, in filename order. */
function migrationFiles() {
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => {
      if (f.endsWith('-postgres.sql')) return isPostgres;
      if (f.endsWith('-sqlite.sql')) return !isPostgres;
      return true;
    })
    .sort();
}

/**
 * A thin engine adapter. The app's db.js is not reused on purpose: it rewrites
 * `?` into `$n` and appends RETURNING to inserts, both of which would mangle
 * hand-written DDL.
 */
async function connect() {
  if (isPostgres) {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: databaseUrl });
    return {
      label: 'PostgreSQL',
      exec: (sql) => pool.query(sql),
      applied: async () => {
        await pool.query(
          `CREATE TABLE IF NOT EXISTS native_migrations (
             filename TEXT PRIMARY KEY,
             applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
           )`
        );
        const { rows } = await pool.query('SELECT filename FROM native_migrations');
        return new Set(rows.map((r) => r.filename));
      },
      record: (filename) =>
        pool.query('INSERT INTO native_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING', [
          filename,
        ]),
      close: () => pool.end(),
    };
  }

  const { default: Database } = await import('better-sqlite3');
  const db = new Database(path.join(serverRoot, 'database', 'data.sqlite'));
  return {
    label: 'SQLite',
    exec: async (sql) => db.exec(sql),
    applied: async () => {
      db.exec(
        `CREATE TABLE IF NOT EXISTS native_migrations (
           filename TEXT PRIMARY KEY,
           applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
         )`
      );
      return new Set(db.prepare('SELECT filename FROM native_migrations').all().map((r) => r.filename));
    },
    record: async (filename) =>
      db.prepare('INSERT OR IGNORE INTO native_migrations (filename) VALUES (?)').run(filename),
    close: async () => db.close(),
  };
}

async function main() {
  const engine = await connect();
  console.log(`Database: ${engine.label}`);

  const done = await engine.applied();
  const pending = migrationFiles().filter((f) => !done.has(f));

  if (baseline) {
    if (done.size > 0) {
      console.log(`Already baselined — ${done.size} migrations on record. Nothing to do.`);
      await engine.close();
      return;
    }
    for (const file of pending) await engine.record(file);
    console.log(`Baselined ${pending.length} migrations as already applied. None were run.`);
    await engine.close();
    return;
  }

  if (done.size === 0 && pending.length > 0) {
    console.error(
      'Refusing to run: nothing is on record, so this database looks either brand new or\n' +
        'never baselined. Four of these migrations drop columns or rewrite data — running\n' +
        'them against a live database would break it.\n\n' +
        '  Existing database → npm run migrate -- --baseline\n' +
        '  Empty database    → apply database/init-native-schema.sql first, then baseline'
    );
    await engine.close();
    process.exitCode = 1;
    return;
  }

  if (pending.length === 0) {
    console.log('Up to date — nothing pending.');
    await engine.close();
    return;
  }

  console.log(`${pending.length} pending:`);
  for (const file of pending) console.log(`  ${file}`);

  if (dryRun) {
    console.log('\n--dry: nothing was applied.');
    await engine.close();
    return;
  }

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    process.stdout.write(`Applying ${file} ... `);
    try {
      await engine.exec(sql);
      await engine.record(file);
      console.log('ok');
    } catch (err) {
      console.log('FAILED');
      console.error(`\n${err.message}\n`);
      console.error(
        'Stopped here. Nothing after this file was applied, and this one is not recorded,\n' +
          'so fixing the cause and re-running resumes from the same place.'
      );
      await engine.close();
      process.exitCode = 1;
      return;
    }
  }

  console.log('\nDone.');
  await engine.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
