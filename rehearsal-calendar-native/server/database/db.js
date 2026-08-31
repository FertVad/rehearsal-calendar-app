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

      /**
       * Runs the callback inside a real transaction, on one connection.
       *
       * Issuing BEGIN through this module's ordinary run() does not do what it
       * looks like. Every call goes through pool.query, which checks a client
       * out and hands it straight back — so BEGIN returns a connection to the
       * pool with a transaction still open on it. What follows is worse than a
       * transaction that does not roll back: the next request to be given that
       * connection joins the transaction it never opened, and the first
       * request's ROLLBACK undoes its writes. Two writes landing together, one
       * silently discarded, no error either side.
       *
       * The callback is handed a db-shaped object bound to the one connection.
       * Use it for everything inside, or that statement is outside the
       * transaction again.
       */
      async transaction(fn) {
        const client = await pool.connect();
        const scoped = {
          async run(sql, params = []) {
            let q = sql.trim();
            if (/^insert\s+/i.test(q) && !/returning/i.test(q)) q += ' RETURNING id';
            const res = await client.query(transform(q), params);
            return { lastInsertId: res.rows[0]?.id };
          },
          async get(sql, params = []) {
            return (await client.query(transform(sql), params)).rows[0];
          },
          async all(sql, params = []) {
            return (await client.query(transform(sql), params)).rows;
          },
        };

        try {
          await client.query('BEGIN');
          const result = await fn(scoped);
          await client.query('COMMIT');
          return result;
        } catch (err) {
          // Best effort: if the connection itself is what failed, there is
          // nothing to roll back and the release below discards it.
          try {
            await client.query('ROLLBACK');
          } catch {
            // ignore
          }
          throw err;
        } finally {
          client.release();
        }
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

      // One connection to begin with, so the statements cannot scatter the way
      // they do over a pool. Written out rather than using better-sqlite3's own
      // transaction(), which takes a synchronous function.
      async transaction(fn) {
        sqlite.prepare('BEGIN').run();
        try {
          const result = await fn(db);
          sqlite.prepare('COMMIT').run();
          return result;
        } catch (err) {
          try {
            sqlite.prepare('ROLLBACK').run();
          } catch {
            // ignore
          }
          throw err;
        }
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
