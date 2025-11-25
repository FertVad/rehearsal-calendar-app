import Database from 'better-sqlite3';
import path from 'path';
import { Pool } from 'pg';

const sqlitePath = path.join(process.cwd(), 'server', 'database', 'data.sqlite');
const sqlite = new Database(sqlitePath);

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const pool = new Pool({ connectionString: databaseUrl });

function fetchAll(table) {
  return sqlite.prepare(`SELECT * FROM ${table}`).all();
}

async function insertRows(table, rows) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
  for (const row of rows) {
    const values = cols.map(c => row[c]);
    await pool.query(
      `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
      values
    );
  }
  const [{ max }] = (await pool.query(`SELECT MAX(id) as max FROM ${table}`)).rows;
  await pool.query(
    `SELECT setval(pg_get_serial_sequence('${table}','id'), $1)`,
    [max || 1]
  );
}

async function migrate() {
  await pool.query('BEGIN');
  try {
    await insertRows('projects', fetchAll('projects'));
    await insertRows('actors', fetchAll('actors'));
    await insertRows('availability', fetchAll('availability'));
    await insertRows('rehearsals', fetchAll('rehearsals'));
    await pool.query('COMMIT');
    console.log('Migration finished');
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Migration failed', err);
  } finally {
    await pool.end();
    sqlite.close();
  }
}

migrate();
