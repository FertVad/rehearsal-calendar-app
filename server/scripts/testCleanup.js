// Test script for cleanup logic
// Inserts test data and runs cleanup to verify retention policy

import db, { initDatabase } from '../database/db.js';

async function testCleanup() {
  console.log('🧪 Testing cleanup logic...\n');

  await initDatabase();

  // Ensure schema exists (for SQLite)
  try {
    await db.run(`CREATE TABLE IF NOT EXISTS rehearsals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      scene TEXT,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      duration TEXT,
      actors TEXT,
      actor_name_snapshot TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await db.run(`CREATE TABLE IF NOT EXISTS availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT NOT NULL,
      date TEXT NOT NULL,
      time_ranges TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  } catch (err) {
    console.warn('Schema already exists or error:', err.message);
  }

  // Insert test data
  console.log('📝 Inserting test data...');

  // Old rehearsals (should be deleted)
  await db.run(
    `INSERT INTO rehearsals (project_id, scene, date, time, duration, actors, notes)
     VALUES (NULL, 'Old Scene', date('now', '-2 years'), '10:00', '2', '[]', 'Should be deleted')`
  );

  await db.run(
    `INSERT INTO rehearsals (project_id, scene, date, time, duration, actors, notes)
     VALUES (NULL, 'Old Scene 2', date('now', '-400 days'), '11:00', '1', '[]', 'Should be deleted')`
  );

  // Recent rehearsals (should be kept)
  await db.run(
    `INSERT INTO rehearsals (project_id, scene, date, time, duration, actors, notes)
     VALUES (NULL, 'Recent Scene', date('now', '-100 days'), '12:00', '2', '[]', 'Should be kept')`
  );

  await db.run(
    `INSERT INTO rehearsals (project_id, scene, date, time, duration, actors, notes)
     VALUES (NULL, 'Future Scene', date('now', '+30 days'), '13:00', '1', '[]', 'Should be kept')`
  );

  // Old availability (should be deleted)
  await db.run(
    `INSERT INTO availability (telegram_id, date, time_ranges)
     VALUES ('test_user_1', date('now', '-1 year'), '[{"start":"09:00","end":"18:00"}]')`
  );

  await db.run(
    `INSERT INTO availability (telegram_id, date, time_ranges)
     VALUES ('test_user_2', date('now', '-200 days'), '[{"start":"10:00","end":"16:00"}]')`
  );

  // Recent availability (should be kept)
  await db.run(
    `INSERT INTO availability (telegram_id, date, time_ranges)
     VALUES ('test_user_3', date('now', '-50 days'), '[{"start":"11:00","end":"17:00"}]')`
  );

  await db.run(
    `INSERT INTO availability (telegram_id, date, time_ranges)
     VALUES ('test_user_4', date('now', '+10 days'), '[{"start":"12:00","end":"18:00"}]')`
  );

  console.log('✅ Test data inserted\n');

  // Count before cleanup
  const beforeRehearsals = await db.get('SELECT COUNT(*) as count FROM rehearsals');
  const beforeAvailability = await db.get('SELECT COUNT(*) as count FROM availability');

  console.log('📊 Before cleanup:');
  console.log(`   Rehearsals: ${beforeRehearsals.count}`);
  console.log(`   Availability: ${beforeAvailability.count}\n`);

  // Run cleanup
  console.log('🧹 Running cleanup...');

  const rehearsalsResult = await db.run(
    `DELETE FROM rehearsals WHERE date < date('now', '-1 year')`
  );

  const availabilityResult = await db.run(
    `DELETE FROM availability WHERE date < date('now', '-6 months')`
  );

  console.log(`   Deleted rehearsals: ${rehearsalsResult?.changes || 0}`);
  console.log(`   Deleted availability: ${availabilityResult?.changes || 0}\n`);

  // Count after cleanup
  const afterRehearsals = await db.get('SELECT COUNT(*) as count FROM rehearsals');
  const afterAvailability = await db.get('SELECT COUNT(*) as count FROM availability');

  console.log('📊 After cleanup:');
  console.log(`   Rehearsals: ${afterRehearsals.count}`);
  console.log(`   Availability: ${afterAvailability.count}\n`);

  // Verify retention policy
  const oldRehearsals = await db.all(
    `SELECT * FROM rehearsals WHERE date < date('now', '-1 year')`
  );

  const oldAvailability = await db.all(
    `SELECT * FROM availability WHERE date < date('now', '-6 months')`
  );

  console.log('✅ Verification:');
  console.log(`   Old rehearsals remaining: ${oldRehearsals.length} (should be 0)`);
  console.log(`   Old availability remaining: ${oldAvailability.length} (should be 0)\n`);

  // Clean up test data
  console.log('🧼 Cleaning up test data...');
  await db.run(`DELETE FROM rehearsals WHERE scene LIKE '%Scene%'`);
  await db.run(`DELETE FROM availability WHERE telegram_id LIKE 'test_user_%'`);

  if (oldRehearsals.length === 0 && oldAvailability.length === 0) {
    console.log('🎉 Test PASSED! Retention policy working correctly.\n');
    return true;
  } else {
    console.error('❌ Test FAILED! Some old data was not deleted.\n');
    return false;
  }
}

// Run test
testCleanup()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error('💥 Test error:', err);
    process.exit(1);
  });
