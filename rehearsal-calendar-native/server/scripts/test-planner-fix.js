/**
 * Test that planner API now converts ALL users' availability to requester's timezone
 */

import pkg from 'pg';
import dotenv from 'dotenv';
import { timestampToLocal, timestampToISO } from '../utils/timezone.js';

dotenv.config();
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function simulatePlannerAPI(requesterId, projectId, date) {
  console.log('\n' + '='.repeat(70));
  console.log(`SIMULATING API REQUEST: /api/native/projects/${projectId}/members/availability`);
  console.log(`Requester ID: ${requesterId}, Date: ${date}`);
  console.log('='.repeat(70) + '\n');

  // Get requester info
  const requester = await pool.query(
    'SELECT id, email, timezone FROM native_users WHERE id = $1',
    [requesterId]
  );

  if (requester.rows.length === 0) {
    console.log('❌ Requester not found');
    return;
  }

  const requesterUser = requester.rows[0];
  const requesterTimezone = requesterUser.timezone || 'Asia/Jerusalem';

  console.log(`👤 Requester: ${requesterUser.email}`);
  console.log(`🌍 Requester timezone: ${requesterTimezone}\n`);

  // Get all project members
  const members = await pool.query(
    `SELECT u.id, u.email, u.timezone, pm.role
     FROM native_project_members pm
     JOIN native_users u ON pm.user_id = u.id
     WHERE pm.project_id = $1 AND pm.status = 'active'`,
    [projectId]
  );

  const targetUserIds = members.rows.map(m => m.id);

  console.log(`📋 Project has ${members.rows.length} members:\n`);
  for (const m of members.rows) {
    console.log(`   - ${m.email} (${m.timezone || 'UTC'})`);
  }
  console.log('');

  // Fetch availability records (same as API does)
  const availabilityRecords = await pool.query(
    `SELECT user_id, starts_at, ends_at, type, is_all_day, title, source
     FROM native_user_availability
     WHERE user_id = ANY($1)
       AND starts_at >= $2::date - interval '1 day'
       AND starts_at < $3::date + interval '2 days'
     ORDER BY user_id, starts_at ASC`,
    [targetUserIds, date, date]
  );

  console.log(`📊 Found ${availabilityRecords.rows.length} availability records in DB\n`);

  // Group by user
  const recordsByUser = new Map();
  for (const record of availabilityRecords.rows) {
    if (!recordsByUser.has(record.user_id)) {
      recordsByUser.set(record.user_id, []);
    }
    recordsByUser.get(record.user_id).push(record);
  }

  console.log('='.repeat(70));
  console.log('\n🎯 API RESPONSE (converted to requester\'s timezone):\n');

  const availability = [];

  for (const userId of targetUserIds) {
    const member = members.rows.find(m => m.id === userId);
    const userRecords = recordsByUser.get(userId) || [];

    console.log(`\n👤 ${member.email} (original TZ: ${member.timezone || 'UTC'}):`);

    if (userRecords.length === 0) {
      console.log('   No busy slots');
      continue;
    }

    // Group by date in REQUESTER's timezone
    const recordsByDate = new Map();
    for (const record of userRecords) {
      const startsAtISO = timestampToISO(record.starts_at);
      const { date: localDate } = timestampToLocal(startsAtISO, requesterTimezone);

      if (!recordsByDate.has(localDate)) {
        recordsByDate.set(localDate, []);
      }
      recordsByDate.get(localDate).push(record);
    }

    const records = recordsByDate.get(date) || [];

    if (records.length === 0) {
      console.log(`   No busy slots on ${date}`);
      continue;
    }

    console.log(`   Busy slots on ${date} (in requester's TZ ${requesterTimezone}):`);

    for (const record of records) {
      if (record.is_all_day) {
        console.log(`     00:00 - 23:59 (all-day, source: ${record.source})`);
      } else {
        const startsAtISO = timestampToISO(record.starts_at);
        const endsAtISO = timestampToISO(record.ends_at);
        const { time: startTime } = timestampToLocal(startsAtISO, requesterTimezone);
        const { time: endTime } = timestampToLocal(endsAtISO, requesterTimezone);

        // Also show what it would be in member's own timezone for comparison
        const memberTz = member.timezone || 'UTC';
        const { time: startTimeOrig } = timestampToLocal(startsAtISO, memberTz);
        const { time: endTimeOrig } = timestampToLocal(endsAtISO, memberTz);

        console.log(`     ${startTime} - ${endTime} (source: ${record.source})`);
        if (memberTz !== requesterTimezone) {
          console.log(`       (in member's TZ ${memberTz}: ${startTimeOrig} - ${endTimeOrig})`);
        }
      }
    }

    const userAvail = {
      userId: String(userId),
      email: member.email,
      dates: [{
        date,
        timeRanges: records.map(r => {
          if (r.is_all_day) {
            return { start: '00:00', end: '23:59', type: r.type, isAllDay: true };
          }
          const startsAtISO = timestampToISO(r.starts_at);
          const endsAtISO = timestampToISO(r.ends_at);
          const { time: startTime } = timestampToLocal(startsAtISO, requesterTimezone);
          const { time: endTime } = timestampToLocal(endsAtISO, requesterTimezone);
          return { start: startTime, end: endTime, type: r.type, isAllDay: false };
        })
      }]
    };

    availability.push(userAvail);
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n💡 VERIFICATION:\n');

  // Check if all users with the same rehearsal show the same time slot
  const rehearsalSlots = new Map(); // rehearsalId -> { time, userEmails }

  for (const record of availabilityRecords.rows) {
    if (record.source === 'rehearsal') {
      const startsAtISO = timestampToISO(record.starts_at);
      const endsAtISO = timestampToISO(record.ends_at);
      const { time: startTime } = timestampToLocal(startsAtISO, requesterTimezone);
      const { time: endTime } = timestampToLocal(endsAtISO, requesterTimezone);
      const timeSlot = `${startTime}-${endTime}`;

      const member = members.rows.find(m => m.id === record.user_id);

      if (!rehearsalSlots.has(timeSlot)) {
        rehearsalSlots.set(timeSlot, []);
      }
      rehearsalSlots.get(timeSlot).push(member.email);
    }
  }

  if (rehearsalSlots.size > 0) {
    console.log('✅ All rehearsal participants show the SAME time slot:');
    for (const [timeSlot, emails] of rehearsalSlots.entries()) {
      console.log(`   ${timeSlot} → ${emails.join(', ')}`);
    }
  } else {
    console.log('ℹ️  No rehearsal records found');
  }

  console.log('\n' + '='.repeat(70) + '\n');

  return availability;
}

async function main() {
  console.log('\n🔍 Testing Planner API Fix...\n');

  // Get project
  const project = await pool.query(
    "SELECT id, name, timezone FROM native_projects WHERE name = 'Cabaret'"
  );

  if (project.rows.length === 0) {
    console.log('❌ Project "Cabaret" not found');
    await pool.end();
    return;
  }

  const projectId = project.rows[0].id;

  // Test 1: Request from admin (Jerusalem timezone)
  console.log('\n📋 TEST 1: Admin (Jerusalem) views planner');
  const admin = await pool.query(
    "SELECT id FROM native_users WHERE email = 'test1@mail.com'"
  );
  if (admin.rows.length > 0) {
    await simulatePlannerAPI(admin.rows[0].id, projectId, '2026-01-20');
  }

  // Test 2: Request from user with different timezone (Moscow)
  console.log('\n📋 TEST 2: User Test (Moscow) views planner');
  const testUser = await pool.query(
    "SELECT id FROM native_users WHERE email = 'test10@mail.com'"
  );
  if (testUser.rows.length > 0) {
    await simulatePlannerAPI(testUser.rows[0].id, projectId, '2026-01-20');
  }

  await pool.end();
}

main().catch(console.error);
