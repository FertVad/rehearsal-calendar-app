import db from '../db.js';

/**
 * AvailabilityModel handles global availability storage by telegram_id.
 * After refactoring, availability table stores ONLY manual user-created availability.
 * Rehearsal availability comes from rehearsals table and is merged on-the-fly.
 */
export class AvailabilityModel {
  constructor(database) {
    this.db = database || db;
  }

  // Primary: get by telegram_id + date
  async findByTelegramAndDate(telegramId, date) {
    const sql = `
      SELECT telegram_id, date, time_ranges, created_at
      FROM availability
      WHERE telegram_id = ? AND date = ?`;
    const params = [String(telegramId), date];
    try {
      return await this.db.get(sql, params);
    } catch (err) {
      console.error('DB error findByTelegramAndDate', { telegramId, date, err });
      throw err;
    }
  }

  async findByTelegramAndDateRange(telegramId, startDate, endDate) {
    const sql = `
      SELECT telegram_id, date, time_ranges, created_at
      FROM availability
      WHERE telegram_id = ?
        AND date >= ?
        AND date <= ?
      ORDER BY date`;
    const params = [String(telegramId), startDate, endDate];
    try {
      console.log('[AvailModel] === START ===');
      console.log('[AvailModel] Input params:', {
        telegramId: String(telegramId), startDate, endDate,
        telegramIdType: typeof telegramId,
      });
      console.log('[AvailModel] SQL:', sql.replace(/\s+/g, ' ').trim());
      console.log('[AvailModel] Params:', params);
      const rows = await this.db.all(sql, params);
      console.log('[AvailModel] Raw DB result count:', rows?.length || 0);
      if (rows && rows.length) {
        console.log('[AvailModel] Sample DB row:', rows[0]);
        console.log('[AvailModel] All dates returned:', rows.map(r => r.date));
      }
      console.log('[AvailModel] === END ===');
      return rows;
    } catch (err) {
      console.error('DB error findByTelegramAndDateRange', { telegramId, startDate, endDate, err });
      throw err;
    }
  }

  // Upsert by telegram_id + date (cross‑DB without native upsert)
  async createOrUpdateByTelegram(telegramId, date, timeRanges) {
    const existing = await this.findByTelegramAndDate(telegramId, date);
    const json = JSON.stringify(timeRanges ?? []);
    if (existing) {
      const sql = `UPDATE availability
        SET time_ranges = ?,
            created_at = CURRENT_TIMESTAMP
        WHERE telegram_id = ? AND date = ?`;
      return this.db.run(sql, [json, String(telegramId), date]);
    }
    const sql = `INSERT INTO availability (telegram_id, date, time_ranges, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)`;
    return this.db.run(sql, [String(telegramId), date, json]);
  }

  async removeByTelegramAndDate(telegramId, date) {
    const sql = `DELETE FROM availability WHERE telegram_id = ? AND date = ?`;
    return this.db.run(sql, [String(telegramId), date]);
  }

  async batchUpdateByTelegram(telegramId, updates = []) {
    await this.db.run('BEGIN');
    try {
      for (const u of updates) {
        const { date, timeRanges } = u || {};
        if (!date) continue;
        await this.createOrUpdateByTelegram(telegramId, date, timeRanges || []);
      }
      await this.db.run('COMMIT');
    } catch (err) {
      await this.db.run('ROLLBACK').catch(() => {});
      throw err;
    }
  }

  async getUserAvailability(telegramId, dates = []) {
    if (!Array.isArray(dates) || dates.length === 0) return {};
    const placeholders = dates.map(() => '?').join(',');
    const sql = `SELECT date, time_ranges, created_at FROM availability
                 WHERE telegram_id = ? AND date IN (${placeholders})
                 ORDER BY date`;
    const rows = await this.db.all(sql, [String(telegramId), ...dates]);
    const map = {};
    for (const r of rows) {
      map[r.date] = {
        timeRanges: (() => { try { return JSON.parse(r.time_ranges || '[]'); } catch { return []; } })(),
        updatedAt: r.created_at,
      };
    }
    return map;
  }

  async mapActorIdsToTelegramIds(actorIds = []) {
    if (!actorIds.length) return {};
    const placeholders = actorIds.map(() => '?').join(',');
    const rows = await this.db.all(`SELECT id, telegram_id FROM actors WHERE id IN (${placeholders})`, actorIds);
    const res = {};
    for (const a of rows) res[a.id] = a.telegram_id;
    return res;
  }
}
