// Cross-DB system validation (SQLite/Postgres) via project DB wrapper
import db, { initDatabase, isPostgres } from '../database/db.js';

async function validateSystem() {
  console.log('🔍 Валидация системы после миграции...');
  await initDatabase();
  const issues = [];

  try {
    // 1) Дубликаты по (telegram_id, date)
    const duplicates = await db.all(
      `SELECT telegram_id, date, COUNT(*) as count
       FROM availability
       WHERE telegram_id IS NOT NULL
       GROUP BY telegram_id, date
       HAVING COUNT(*) > 1`
    );
    if (duplicates.length > 0) {
      issues.push(`❌ Найдено ${duplicates.length} групп дубликатов по (telegram_id,date)`);
    } else {
      console.log('✅ Дубликатов не найдено');
    }

    // 2) Индексы
    if (isPostgres) {
      const idx = await db.all(
        `SELECT indexname AS name
         FROM pg_indexes
         WHERE tablename = 'availability'`
      );
      const names = new Set(idx.map(i => i.name));
      const required = ['idx_availability_telegram_id_date', 'idx_availability_telegram_id'];
      const missing = required.filter(n => !names.has(n));
      if (missing.length) issues.push(`❌ Отсутствуют индексы: ${missing.join(', ')}`);
      else console.log('✅ Все индексы на месте');
    } else {
      const idx = await db.all(
        `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='availability'`
      );
      const names = new Set(idx.map(i => i.name));
      const required = ['idx_availability_telegram_id_date', 'idx_availability_telegram_id'];
      const missing = required.filter(n => !names.has(n));
      if (missing.length) issues.push(`❌ Отсутствуют индексы: ${missing.join(', ')}`);
      else console.log('✅ Все индексы на месте');
    }

    // 3) Целостность: записи availability с telegram_id без соответствующих актёров
    const orphan = await db.get(
      `SELECT COUNT(*) AS count
       FROM availability av
       LEFT JOIN actors a ON av.telegram_id = a.telegram_id
       WHERE av.telegram_id IS NOT NULL AND a.telegram_id IS NULL`
    );
    if (Number(orphan?.count || 0) > 0) {
      issues.push(`❌ Найдено ${orphan.count} записей availability без соответствующих actors`);
    } else {
      console.log('✅ Целостность данных (availability → actors) в порядке');
    }

    // 4) Статистика
    const stats = await db.get(
      `SELECT 
         COUNT(*) AS total_records,
         COUNT(DISTINCT telegram_id) AS unique_actors,
         COUNT(CASE WHEN telegram_id IS NOT NULL THEN 1 END) AS with_telegram_id
       FROM availability`
    );
    console.log(`📊 Статистика:\n  - Всего записей: ${stats?.total_records || 0}\n  - Уникальных актеров: ${stats?.unique_actors || 0}\n  - С telegram_id: ${stats?.with_telegram_id || 0}`);

    // Итог
    if (issues.length === 0) {
      console.log('🎉 Система готова к production! Все проверки пройдены.');
      return true;
    } else {
      console.log('⚠️  Найдены проблемы:');
      for (const i of issues) console.log(i);
      return false;
    }
  } catch (err) {
    console.error('💥 Ошибка валидации:', err);
    return false;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  validateSystem()
    .then(ok => process.exit(ok ? 0 : 1))
    .catch(() => process.exit(1));
}

export { validateSystem };

