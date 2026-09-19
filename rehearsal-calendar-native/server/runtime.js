import { createApp } from './app.js';
import { initDatabase, getDatabaseStatus, testConnection } from './database/db.js';
import { logger } from './utils/logger.js';

/**
 * Build the real server without acquiring resources. The first database-bound
 * request shares one initialization attempt with concurrent requests. A failed
 * attempt stays unavailable until process restart or explicit adapter recovery;
 * ordinary traffic cannot create an endless connection/retry loop.
 */
export function createRuntimeApp() {
  let initialization;
  async function ensureInitialized() {
    const { state } = getDatabaseStatus();
    if (state === 'ready') return true;
    if (state === 'closing') return false;
    initialization ??= initDatabase().then(() => true, () => {
      // Driver errors may contain credentials or infrastructure details. One
      // fixed diagnostic per failed attempt is sufficient for this boundary.
      logger.error('Database initialization unavailable');
      return false;
    });
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
