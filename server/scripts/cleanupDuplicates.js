// Cleanup duplicate availability rows by (telegram_id, date)
// Works with the existing DB wrapper (SQLite/Postgres)

import db, { initDatabase } from '../database/db.js';

async function cleanupDuplicateAvailability() {
  console.log('🧹 Начинаем очистку дубликатов availability...');
  await initDatabase();

  // 1) Найти дубликаты
  const duplicates = await db.all(
    `SELECT telegram_id, date, COUNT(*) AS count
     FROM availability
     WHERE telegram_id IS NOT NULL
     GROUP BY telegram_id, date
     HAVING COUNT(*) > 1
     ORDER BY count DESC`
  );
  console.log(`📊 Найдено ${duplicates.length} групп дубликатов`);
  if (duplicates.length === 0) {
    console.log('✅ Дубликатов не найдено!');
    return;
  }

  // 2) Создать backup таблицу с дубликатами
  const backupName = `availability_duplicates_backup_${Date.now()}`;
  try {
    await db.run(
      `CREATE TABLE ${backupName} AS
       SELECT * FROM availability
       WHERE (telegram_id, date) IN (
         SELECT telegram_id, date FROM availability
         WHERE telegram_id IS NOT NULL
         GROUP BY telegram_id, date
         HAVING COUNT(*) > 1
       )`
    );
    console.log('💾 Backup дубликатов создан:', backupName);
  } catch (err) {
    console.warn('⚠️ Не удалось создать backup таблицу:', err?.message || err);
  }

  // 3) Удаление старых записей, оставляя самую новую
  let cleanedCount = 0;
  await db.run('BEGIN');
  try {
    for (const d of duplicates) {
      const rows = await db.all(
        `SELECT id, time_ranges, created_at
         FROM availability
         WHERE telegram_id = ? AND date = ?
         ORDER BY created_at DESC`,
        [String(d.telegram_id), d.date]
      );
      if (!rows || rows.length <= 1) continue;
      const [, ...toDelete] = rows; // keep the newest
      for (const r of toDelete) {
        await db.run('DELETE FROM availability WHERE id = ?', [r.id]);
        cleanedCount++;
      }
    }
    await db.run('COMMIT');
  } catch (err) {
    await db.run('ROLLBACK').catch(() => {});
    throw err;
  }
  console.log(`🗑️  Удалено ${cleanedCount} дубликатов`);

  // 4) Проверка результата
  const remaining = await db.all(
    `SELECT telegram_id, date, COUNT(*) AS count
     FROM availability
     WHERE telegram_id IS NOT NULL
     GROUP BY telegram_id, date
     HAVING COUNT(*) > 1`
  );
  if (remaining.length === 0) console.log('✅ Все дубликаты успешно удалены!');
  else console.log(`⚠️ Осталось групп дубликатов: ${remaining.length}`);

  // 5) Уникальный индекс (предотвращение будущих дубликатов)
  try {
    await db.run(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_availability_telegram_id_date_unique
       ON availability(telegram_id, date)`
    );
    console.log('🔒 Уникальный индекс создан/проверен');
  } catch (err) {
    console.warn('⚠️ Не удалось создать уникальный индекс:', err?.message || err);
  }
}

// Запуск как standalone
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupDuplicateAvailability()
    .then(() => { console.log('🎉 Очистка завершена успешно!'); process.exit(0); })
    .catch(err => { console.error('💥 Ошибка очистки:', err); process.exit(1); });
}

export { cleanupDuplicateAvailability };

