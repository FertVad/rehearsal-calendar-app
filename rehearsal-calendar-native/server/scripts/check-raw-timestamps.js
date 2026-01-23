/**
 * Check raw timestamps as stored in database
 */

import pkg from 'pg';
import dotenv from 'dotenv';
import { timestampToLocal } from '../utils/timezone.js';

dotenv.config();
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  console.log('\n🔍 Checking raw timestamps in database...\n');

  // Get user
  const userResult = await pool.query(
    "SELECT id, email, timezone FROM native_users WHERE email = 'test@example.com'"
  );

  const user = userResult.rows[0];
  console.log(`User: ${user.email} (TZ: ${user.timezone})\n`);

  // Get rehearsal with raw timestamps
  const rehResult = await pool.query(
    `SELECT r.id, r.title, r.starts_at, r.ends_at,
            r.starts_at AT TIME ZONE 'UTC' as starts_at_utc,
            r.ends_at AT TIME ZONE 'UTC' as ends_at_utc,
            p.name as project_name
     FROM native_rehearsals r
     JOIN native_projects p ON r.project_id = p.id
     WHERE r.id = 85`
  );

  if (rehResult.rows.length === 0) {
    console.log('❌ Rehearsal ID 85 not found');
    await pool.end();
    return;
  }

  const reh = rehResult.rows[0];

  console.log('=== REHEARSAL ===');
  console.log(`ID: ${reh.id}`);
  console.log(`Project: ${reh.project_name}`);
  console.log(`Title: ${reh.title || '(no title)'}\n`);

  console.log('Raw values from PostgreSQL:');
  console.log(`  starts_at: ${reh.starts_at}`);
  console.log(`  ends_at:   ${reh.ends_at}\n`);

  console.log('Converted to UTC string:');
  const startsAtISO = reh.starts_at.toISOString();
  const endsAtISO = reh.ends_at.toISOString();
  console.log(`  starts_at: ${startsAtISO}`);
  console.log(`  ends_at:   ${endsAtISO}\n`);

  // Convert to user's timezone
  console.log(`Converted to user's timezone (${user.timezone}):`);
  const startLocal = timestampToLocal(startsAtISO, user.timezone);
  const endLocal = timestampToLocal(endsAtISO, user.timezone);
  console.log(`  starts_at: ${startLocal.date} ${startLocal.time}`);
  console.log(`  ends_at:   ${endLocal.date} ${endLocal.time}\n`);

  // Also convert to Israel timezone
  console.log(`Converted to Israel timezone (Asia/Jerusalem):`);
  const startIsrael = timestampToLocal(startsAtISO, 'Asia/Jerusalem');
  const endIsrael = timestampToLocal(endsAtISO, 'Asia/Jerusalem');
  console.log(`  starts_at: ${startIsrael.date} ${startIsrael.time}`);
  console.log(`  ends_at:   ${endIsrael.date} ${endIsrael.time}\n`);

  // Check availability record
  const availResult = await pool.query(
    `SELECT id, source, title, starts_at, ends_at, type,
            starts_at AT TIME ZONE 'UTC' as starts_at_utc
     FROM native_user_availability
     WHERE user_id = $1 AND external_event_id = 85`,
    [user.id]
  );

  if (availResult.rows.length > 0) {
    const avail = availResult.rows[0];
    console.log('=== AVAILABILITY RECORD (from rehearsal) ===');
    console.log(`ID: ${avail.id}`);
    console.log(`Source: ${avail.source}`);
    console.log(`Type: ${avail.type}\n`);

    const availStartISO = avail.starts_at.toISOString();
    const availEndISO = avail.ends_at.toISOString();

    console.log('UTC timestamps:');
    console.log(`  starts_at: ${availStartISO}`);
    console.log(`  ends_at:   ${availEndISO}\n`);

    console.log(`User timezone (${user.timezone}):`);
    const availStartLocal = timestampToLocal(availStartISO, user.timezone);
    const availEndLocal = timestampToLocal(availEndISO, user.timezone);
    console.log(`  starts_at: ${availStartLocal.date} ${availStartLocal.time}`);
    console.log(`  ends_at:   ${availEndLocal.date} ${availEndLocal.time}\n`);
  }

  await pool.end();
}

main().catch(console.error);
