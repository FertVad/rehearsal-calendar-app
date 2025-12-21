require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    console.log('[Delete] Looking for incorrectly imported all-day event...');

    // First, check if it exists
    const check = await pool.query(
      `SELECT id, starts_at, ends_at, is_all_day, title
       FROM native_user_availability
       WHERE external_event_id = $1
         AND source IN ('apple_calendar', 'google_calendar')`,
      ['F8D3F630-6839-4FDB-BCBB-BB5B9F4D4740']
    );

    if (check.rowCount === 0) {
      console.log('[Delete] Event not found - already deleted or never imported');
      await pool.end();
      return;
    }

    console.log('[Delete] Found event:', check.rows[0].title);
    console.log('[Delete] Incorrect time:', check.rows[0].starts_at, '-', check.rows[0].ends_at);

    // Delete it
    const result = await pool.query(
      `DELETE FROM native_user_availability
       WHERE external_event_id = $1
         AND source IN ('apple_calendar', 'google_calendar')
       RETURNING id`,
      ['F8D3F630-6839-4FDB-BCBB-BB5B9F4D4740']
    );

    console.log('[Delete] ✓ Deleted', result.rowCount, 'event(s)');
    console.log('[Delete] ✓ Done! Event will be reimported with correct times on next sync');

    await pool.end();
  } catch (err) {
    console.error('[Delete] Error:', err.message);
    await pool.end();
    process.exit(1);
  }
})();
