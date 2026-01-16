/**
 * Database abstraction layer for PostgreSQL and SQLite
 *
 * TIMESTAMPTZ handling:
 * - PostgreSQL: node-postgres automatically converts TIMESTAMPTZ columns to JavaScript Date objects
 * - SQLite: Timestamps are stored as ISO 8601 strings
 *
 * No special date/time conversion needed here - handled by the database driver.
 */

import Database from 'better-sqlite3';
import path from 'path';
import pkg from 'pg';
import { logger } from '../utils/logger.js';

const { Pool } = pkg;

let pool = null;
let sqlite;
let db;
export let isPostgres = false;

export async function initDatabase() {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (databaseUrl) {
    pool = new Pool({ connectionString: databaseUrl });
    try {
      await pool.query('SELECT 1');
      logger.info('Connected to PostgreSQL');
      isPostgres = true;
    } catch (err) {
      logger.error('PostgreSQL connection failed, falling back to SQLite:', err);
      pool = null;
    }
  }

  if (isPostgres) {
    function transform(sql) {
      let idx = 0;
      return sql.replace(/\?/g, () => `$${++idx}`);
    }

    db = {
      async run(sql, params = []) {
        let q = sql.trim();
        if (/^insert\s+/i.test(q) && !/returning/i.test(q)) {
          q += ' RETURNING id';
        }
        const res = await pool.query(transform(q), params);
        return { lastInsertId: res.rows[0]?.id };
      },
      async get(sql, params = []) {
        const res = await pool.query(transform(sql), params);
        return res.rows[0];
      },
      async all(sql, params = []) {
        const res = await pool.query(transform(sql), params);
        return res.rows;
      },
    };
  } else {
    const dbPath = path.join(process.cwd(), 'server', 'database', 'data.sqlite');
    sqlite = new Database(dbPath);
    logger.info('Using SQLite database');
    db = {
      run(sql, params = []) {
        const info = sqlite.prepare(sql).run(params);
        return { lastInsertId: info.lastInsertRowid };
      },
      get(sql, params = []) {
        return sqlite.prepare(sql).get(params);
      },
      all(sql, params = []) {
        return sqlite.prepare(sql).all(params);
      },
    };
  }

  return db;
}

export async function testConnection() {
  if (pool) {
    await pool.query('SELECT 1');
  } else if (sqlite) {
    sqlite.prepare('SELECT 1').get();
  }
}

export { db as default };
