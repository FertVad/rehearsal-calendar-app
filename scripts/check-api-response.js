require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    console.log('[Check API] Fetching all-day events for user 3...\n');

    // Get the two all-day events
    const result = await pool.query(
      `SELECT id, starts_at, ends_at, type, title, is_all_day, source, external_event_id
       FROM native_user_availability
       WHERE user_id = $1 AND is_all_day = true
       ORDER BY starts_at`,
      [3]
    );

    console.log(`Found ${result.rowCount} all-day events:\n`);

    for (const row of result.rows) {
      console.log(`[${row.id}] ${row.title}`);
      console.log(`  external_id: ${row.external_event_id}`);
      console.log(`  source: ${row.source}`);
      console.log(`  is_all_day: ${row.is_all_day}`);
      console.log(`  Raw starts_at:`, row.starts_at);
      console.log(`  Raw ends_at:`, row.ends_at);

      // This is what the API returns (via timestampToISO)
      const startsAtISO = row.starts_at instanceof Date ? row.starts_at.toISOString() : new Date(row.starts_at).toISOString();
      const endsAtISO = row.ends_at instanceof Date ? row.ends_at.toISOString() : new Date(row.ends_at).toISOString();

      console.log(`  API startsAt: ${startsAtISO}`);
      console.log(`  API endsAt: ${endsAtISO}`);

      // Extract date from API response
      const startDate = startsAtISO.split('T')[0];
      const endDate = endsAtISO.split('T')[0];

      console.log(`  Date extracted by client: ${startDate}`);
      console.log(`  Expected date: Should be the date in calendar (23 or 28 Dec)`);
      console.log('');
    }

    await pool.end();
  } catch (err) {
    console.error('[Check API] Error:', err.message);
    await pool.end();
    process.exit(1);
  }
})();
