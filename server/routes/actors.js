import { Router } from 'express';
import * as Actor from '../database/models/Actor.js';
import * as Project from '../database/models/Project.js';
import * as Availability from '../database/models/Availability.js';
import { AvailabilityModel } from '../database/models/Availability.js';
import db from '../database/db.js';
import { mergeBusyRanges, toMinutes, toTimeString } from '../shared/availability.js';
import { parseAvailabilityRow } from '../utils/helpers.js';
import { requireTelegramAuth, requireProjectMember } from '../middleware/authMiddleware.js';

/**
 * Router handling actor related endpoints.
 */
const router = Router();

function normalizeRangeInput(r) {
  if (!r) throw new Error('empty range');
  const parseOne = v => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const m = v.match(/^(\d{1,2}):(\d{2})$/);
      if (!m) throw new Error(`bad time string "${v}"`);
      const hh = String(Number(m[1])).padStart(2, '0');
      const mm = m[2];
      return toMinutes(`${hh}:${mm}`);
    }
    throw new Error(`unsupported time type: ${typeof v}`);
  };
  const sMin = parseOne(r.start);
  const eMin = parseOne(r.end);
  const start = toTimeString(sMin);
  const end = toTimeString(eMin);
  if (sMin >= eMin) throw new Error(`start>=end (${start}..${end})`);
  return { start, end };
}

// Removed open endpoint: GET /api/actors (security)

// PUT /api/actors/:telegramId/availability
router.put('/actors/:telegramId/availability', requireTelegramAuth({ allowDevParam: true }), requireProjectMember(Project, Actor), async (req, res) => {
  try {
    const { telegramId } = req.params;
    // Support both array body and { updates: [...] }
    const updates = Array.isArray(req.body) ? req.body : (Array.isArray(req.body?.updates) ? req.body.updates : null);
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Invalid body: updates must be an array' });
    }

    const project = req.project;
    const requestingActor = req.actor;
    const actor = await Actor.findByTelegramId(String(telegramId), project.id);
    if (!actor) {
      return res.status(404).json({ error: 'Actor not found' });
    }
    if (String(requestingActor.telegram_id) !== String(telegramId) && !requestingActor.is_admin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const model = new AvailabilityModel(db);
    const pcRow = await db.get('SELECT COUNT(DISTINCT project_id) as cnt FROM actors WHERE telegram_id = ?', [String(telegramId)]);
    const changed = {};
    for (const u of updates) {
      const { date, timeRanges = [] } = u ?? {};
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'Некорректная дата (ожидается YYYY-MM-DD)' });
      }
      const d = new Date(date);
      if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date) {
        return res.status(400).json({ error: 'Некорректная дата (ожидается YYYY-MM-DD)' });
      }
      if (!Array.isArray(timeRanges)) {
        return res.status(400).json({ error: 'Некорректные интервалы времени' });
      }

      const normalizedRanges = (timeRanges ?? []).map((r, idx) => {
        try {
          return normalizeRangeInput(r);
        } catch (e) {
          let message = String(e.message);
          if (message.includes('bad time string')) message = 'Некорректное время (ожидается HH:mm)';
          else if (message.includes('start>=end')) message = 'Конец интервала должен быть позже начала';
          const err = new Error(`#${idx} ${message}`);
          err.isValidation = true;
          throw err;
        }
      });

      const merged = mergeBusyRanges(normalizedRanges);
      if (!merged.length) await model.removeByTelegramAndDate(String(telegramId), date);
      else await model.createOrUpdateByTelegram(String(telegramId), date, merged);
      changed[date] = { timeRanges: merged };
    }
    console.info('[audit] availability.update', {
      route: '/api/actors/:telegramId/availability',
      initiator: String(requestingActor.telegram_id),
      target: String(telegramId),
      updates: updates.length,
      projectsCount: Number(pcRow?.cnt || 0),
    });
    return res.json({ ok: true, actorId: String(actor.id), availability: changed, meta: { projectsCount: Number(pcRow?.cnt || 0) } });
  } catch (err) {
    console.error('[PUT availability] error', err);
    if (err?.isValidation) return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: 'Не удалось обновить доступность' });
  }
});

// Batch update (global) — optional convenience endpoint
router.put('/actors/:telegramId/availability/batch', requireTelegramAuth({ allowDevParam: true }), requireProjectMember(Project, Actor), async (req, res) => {
  try {
    const { telegramId } = req.params;
    const updates = Array.isArray(req.body?.updates) ? req.body.updates : (Array.isArray(req.body) ? req.body : null);
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'updates must be a non-empty array' });
    }

    const project = req.project;
    const requestingActor = req.actor;
    const actor = await Actor.findByTelegramId(String(telegramId), project.id);
    if (!actor) return res.status(404).json({ error: 'Actor not found' });
    if (String(requestingActor.telegram_id) !== String(telegramId) && !requestingActor.is_admin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Basic validation and normalization
    const normalized = updates.map((u, idx) => {
      const date = u?.date;
      const trs = Array.isArray(u?.timeRanges) ? u.timeRanges : [];
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const e = new Error(`#${idx} Некорректная дата (ожидается YYYY-MM-DD)`);
        e.isValidation = true; throw e;
      }
      const d = new Date(date);
      if (Number.isNaN(d.getTime()) || d.toISOString().slice(0,10) !== date) {
        const e = new Error(`#${idx} Некорректная дата (ожидается YYYY-MM-DD)`);
        e.isValidation = true; throw e;
      }
      const timeRanges = trs.map((r, j) => {
        try { return normalizeRangeInput(r); } catch (e) {
          let message = String(e.message);
          if (message.includes('bad time string')) message = 'Некорректное время (ожидается HH:mm)';
          else if (message.includes('start>=end')) message = 'Конец интервала должен быть позже начала';
          const err = new Error(`#${idx}.${j} ${message}`); err.isValidation = true; throw err;
        }
      });
      return { date, timeRanges };
    });

    const model = new AvailabilityModel(db);
    const pcRow = await db.get('SELECT COUNT(DISTINCT project_id) as cnt FROM actors WHERE telegram_id = ?', [String(telegramId)]);
    await model.batchUpdateByTelegram(String(telegramId), normalized);
    console.info('[audit] availability.batch_update', {
      route: '/api/actors/:telegramId/availability/batch',
      initiator: String(requestingActor.telegram_id),
      target: String(telegramId),
      updatedCount: normalized.length,
      projectsCount: Number(pcRow?.cnt || 0),
    });
    return res.json({ success: true, telegramId: String(telegramId), updatedCount: normalized.length, meta: { projectsCount: Number(pcRow?.cnt || 0) } });
  } catch (err) {
    console.error('[PUT availability batch] error', err);
    if (err?.isValidation) return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: 'Не удалось обновить доступность' });
  }
});

export default router;
