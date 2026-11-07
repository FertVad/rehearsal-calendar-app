import { createApp } from './app.js';
import { initDatabase, getDatabaseStatus, testConnection } from './database/db.js';
import { logger } from './utils/logger.js';

/**
 * Pause after a failed initialization before the next request may try again.
 * Longer than one whole attempt (10 s connect + 2 s probe, database/db.js), so
 * attempts never run back to back and traffic makes at most one connection
 * attempt per pause; short against a serverless instance's life of minutes, so
 * an instance that started while the database was waking does not stay 503.
 * See docs/server-runtime.md, "Startup and availability".
 */
export const initializationRetryDelayMs = 15_000;

/**
 * Build the real server without acquiring resources. The first database-bound
 * request shares one initialization attempt with concurrent requests. After a
 * failed attempt, requests answer unavailable without touching the database
 * until the pause has passed; the next request then starts one new attempt,
 * shared again by concurrent requests. Nothing retries on its own: no timer,
 * no background monitor — only incoming traffic, at most once per pause.
 * `now` exists for tests to substitute the clock.
 */
export function createRuntimeApp({ now = Date.now } = {}) {
  let initialization;
  let failedAt;
  async function ensureInitialized() {
    const { state } = getDatabaseStatus();
    if (state === 'ready') return true;
    if (state === 'closing') return false;
    if (!initialization) {
      if (failedAt !== undefined && now() - failedAt < initializationRetryDelayMs) return false;
      initialization = initDatabase().then(() => true, () => {
        // Driver errors may contain credentials or infrastructure details. One
        // fixed diagnostic per failed attempt is sufficient for this boundary.
        logger.error('Database initialization unavailable');
        // The pause counts from the end of the attempt, so a slow attempt
        // cannot be followed immediately by another.
        failedAt = now();
        initialization = undefined;
        return false;
      });
    }
    await initialization;
    return getDatabaseStatus().state === 'ready';
  }
  async function checkReady() {
    if (!await ensureInitialized()) return false;
    try {
      await testConnection();
      return true;
    } catch {
      return false;
    }
  }
  return createApp({ databaseRuntime: { ensureInitialized, checkReady } });
}
