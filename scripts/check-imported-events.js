require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    console.log('[Check] Looking for imported events for user 3...\n');

    // Check all events for user 3
    const all = await pool.query(
      `SELECT id, starts_at, ends_at, type, title, is_all_day, source, external_event_id
       FROM native_user_availability
       WHERE user_id = $1
       ORDER BY id`,
      [3]
    );

    console.log(`[Check] Total events for user 3: ${all.rowCount}\n`);

    // Group by source
    const bySource = {};
    for (const row of all.rows) {
      if (!bySource[row.source]) {
        bySource[row.source] = [];
      }
      bySource[row.source].push(row);
    }

    console.log('=== Events by source ===');
    for (const [source, events] of Object.entries(bySource)) {
      console.log(`\n${source}: ${events.length} events`);
      events.forEach(e => {
        console.log(`  [${e.id}] ${e.starts_at} - ${e.ends_at} | ${e.title || 'no title'} | all_day=${e.is_all_day} | ext_id=${e.external_event_id || 'none'}`);
      });
    }

    // Check specific external IDs
    console.log('\n=== Checking specific calendar event IDs ===');
    const ids = [
      '9959C7FD-17BC-4CBA-A7BA-1D132C4B8CED',
      'F8D3F630-6839-4FDB-BCBB-BB5B9F4D4740',
      '707E4D9F-4723-474C-9FA6-A0CA0B7EE5A4'
    ];

    for (const extId of ids) {
      const found = await pool.query(
        `SELECT id, starts_at, ends_at, source, is_all_day
         FROM native_user_availability
         WHERE user_id = $1 AND external_event_id = $2`,
        [3, extId]
      );

      if (found.rowCount > 0) {
        const row = found.rows[0];
        console.log(`\n${extId}:`);
        console.log(`  id=${row.id}, source=${row.source}, is_all_day=${row.is_all_day}`);
        console.log(`  starts_at=${row.starts_at}`);
        console.log(`  ends_at=${row.ends_at}`);
      } else {
        console.log(`\n${extId}: NOT FOUND`);
      }
    }

    await pool.end();
  } catch (err) {
    console.error('[Check] Error:', err.message);
    await pool.end();
    process.exit(1);
  }
})();
