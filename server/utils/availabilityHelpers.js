import { AvailabilityModel } from '../database/models/Availability.js';
import db from '../database/db.js';
import { mergeBusyRanges } from '../shared/availability.js';

export async function getAvailabilityByTelegramId(telegramId, startDate, endDate) {
  const model = new AvailabilityModel(db);

  // 1. Get manual availability from availability table
  const manualRows = await model.findByTelegramAndDateRange(String(telegramId), startDate, endDate);
  const manualByDate = new Map();
  for (const r of manualRows) {
    manualByDate.set(r.date, {
      date: r.date,
      timeRanges: (() => { try { return JSON.parse(r.time_ranges || '[]'); } catch { return []; } })(),
      updatedAt: r.created_at,
    });
  }

  // 2. Get rehearsal availability from rehearsals table (all projects where user is actor)
  // Note: rehearsals.actors contains actor.id (internal DB IDs), not telegram_id
  // So we need to join with actors table to find rehearsals for this telegram_id

  // First, get all actor IDs for this telegram_id
  const actorRecords = await db.all(
    `SELECT id FROM actors WHERE telegram_id = ?`,
    [String(telegramId)]
  );

  if (actorRecords.length === 0) {
    // User has no actor records, skip rehearsal fetching
    const allDates = new Set([...manualByDate.keys()]);
    const result = [];
    for (const date of allDates) {
      const manual = manualByDate.get(date)?.timeRanges || [];
      result.push({
        date,
        timeRanges: manual,
        updatedAt: manualByDate.get(date)?.updatedAt || null,
      });
    }
    result.sort((a, b) => a.date.localeCompare(b.date));
    return result;
  }

  // Then fetch rehearsals where any of these actor IDs is in the actors array
  // Universal approach: check if the JSON text contains the actor ID
  const rehearsals = await db.all(
    `SELECT r.date, r.time, r.duration
     FROM rehearsals r
     WHERE r.date BETWEEN ? AND ?
       AND (${actorRecords.map(() => `r.actors LIKE ?`).join(' OR ')})`,
    [
      startDate,
      endDate,
      ...actorRecords.map(a => `%"${a.id}"%`)
    ]
  );

  // 3. Group rehearsals by date and convert to time ranges
  const rehearsalsByDate = new Map();
  for (const reh of rehearsals) {
    if (!rehearsalsByDate.has(reh.date)) {
      rehearsalsByDate.set(reh.date, []);
    }
    // duration format: "14:00 - 15:00"
    const match = reh.duration?.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
    if (match) {
      rehearsalsByDate.get(reh.date).push({
        start: match[1],
        end: match[2],
      });
    }
  }

  // 4. Merge manual + rehearsal availability for each date
  const allDates = new Set([...manualByDate.keys(), ...rehearsalsByDate.keys()]);
  const result = [];
  for (const date of allDates) {
    const manual = manualByDate.get(date)?.timeRanges || [];
    const rehearsal = rehearsalsByDate.get(date) || [];
    const merged = mergeBusyRanges([...manual, ...rehearsal]);
    result.push({
      date,
      timeRanges: merged,
      updatedAt: manualByDate.get(date)?.updatedAt || null,
    });
  }

  // Sort by date
  result.sort((a, b) => a.date.localeCompare(b.date));
  return result;
}

export async function updateAvailabilityByTelegramId(telegramId, date, timeRanges) {
  const model = new AvailabilityModel(db);
  await model.createOrUpdateByTelegram(String(telegramId), date, timeRanges);
}

export async function getActorProjects(telegramId) {
  return db.all(
    `SELECT p.chat_id, p.name, a.is_admin
     FROM actors a
     JOIN projects p ON a.project_id = p.id
     WHERE a.telegram_id = ?`,
    [String(telegramId)],
  );
}

export function formatAvailabilityDisplay(timeRanges) {
  if (!timeRanges || timeRanges === '') return 'Свободен';
  if (timeRanges === 'x' || timeRanges === 'busy') return 'Занят';
  try {
    const ranges = typeof timeRanges === 'string' ? JSON.parse(timeRanges) : timeRanges;
    if (!Array.isArray(ranges) || ranges.length === 0) return 'Свободен';
    return ranges.map(r => `${r.start}-${r.end}`).join(', ');
  } catch {
    return 'Свободен';
  }
}

export async function checkAvailabilityConflicts(actorTelegramIds, date, time, duration) {
  const model = new AvailabilityModel(db);
  const conflicts = [];
  for (const tid of actorTelegramIds) {
    const row = await model.findByTelegramAndDate(String(tid), date);
    if (row && hasTimeConflict(row.time_ranges, time, duration)) {
      const actor = await db.get('SELECT name FROM actors WHERE telegram_id = ? LIMIT 1', [String(tid)]);
      conflicts.push({ telegramId: String(tid), name: actor?.name || 'Unknown', conflictReason: 'Пересечение с занятостью' });
    }
  }
  return conflicts;
}

export function hasTimeConflict(timeRanges, rehearsalTime, duration) {
  if (!timeRanges || timeRanges === '') return false;
  if (timeRanges === 'x' || timeRanges === 'busy') return true;
  try {
    const ranges = typeof timeRanges === 'string' ? JSON.parse(timeRanges) : timeRanges;
    // TODO: implement precise overlap check based on rehearsalTime + duration
    void ranges;
    void rehearsalTime;
    void duration;
    return false;
  } catch {
    return false;
  }
}

// Legacy passthroughs (retain names referenced elsewhere if needed)
export { parseAvailabilityRow } from './helpers.js';
export { mergeBusyRanges } from '../shared/availability.js';
