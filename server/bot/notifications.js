import { getBot } from './index.js';
import parse from 'date-fns/parse';
import addMinutes from 'date-fns/addMinutes';
import format from 'date-fns/format';
import { shouldNotify } from './notifyQueue.js';
import db, { isPostgres } from '../database/db.js';

import {
  formatRehearsalCreated,
  formatRehearsalUpdated,
  formatRehearsalDeleted,
} from './templates.js';

const ENABLE_NOTIFICATIONS = process.env.ENABLE_NOTIFICATIONS !== 'false';

/**
 * Load project settings (notifications_enabled, notification_language)
 */
async function loadProjectSettings(chatId) {
  try {
    const query = 'SELECT notifications_enabled, notification_language FROM projects WHERE chat_id = ? LIMIT 1';
    const project = await db.get(query, [String(chatId)]);

    if (!project) {
      return { enabled: false, language: 'en' };
    }

    // Handle PostgreSQL BOOLEAN vs SQLite INTEGER
    const enabled = isPostgres
      ? Boolean(project.notifications_enabled)
      : project.notifications_enabled === 1;

    return {
      enabled,
      language: project.notification_language || 'en'
    };
  } catch (err) {
    console.error('[notify] Failed to load project settings:', err);
    return { enabled: false, language: 'en' };
  }
}

function withTimes(rehearsal) {
  let startTime = rehearsal.startTime || rehearsal.time || '';
  let endTime = rehearsal.endTime || '';
  const { duration } = rehearsal;
  if (!endTime && duration) {
    if (duration.includes('-')) {
      const parts = duration.split('-').map(p => p.trim());
      if (parts.length === 2) {
        startTime = parts[0];
        endTime = parts[1];
      }
    } else if (startTime) {
      try {
        const startDate = parse(startTime, 'HH:mm', new Date());
        const hours = parseFloat(duration);
        if (!isNaN(hours)) {
          const endDate = addMinutes(startDate, Math.round(hours * 60));
          endTime = format(endDate, 'HH:mm');
        }
      } catch {
        // ignore
      }
    }
  }
  return { ...rehearsal, startTime, endTime };
}

function parseActorNames(snapshot) {
  try {
    const parsed = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
    if (Array.isArray(parsed)) {
      return parsed.map(a => a?.name).filter(Boolean);
    }
  } catch {
    // ignore
  }
  return [];
}

async function resolveActorNames(rehearsal) {
  const names = parseActorNames(rehearsal.actor_name_snapshot);
  if (names.length) return names;
  const ids = (rehearsal.actors || []).map(String);
  if (!ids.length) return [];
  try {
    let rows;
    const intIds = ids.map(id => parseInt(id, 10));
    if (isPostgres) {
      rows = await db.all(
        'SELECT id::text AS id, COALESCE(username, name) AS name FROM actors WHERE id = ANY(?::int[])',
        [intIds]
      );
    } else {
      const placeholders = ids.map(() => '?').join(',');
      rows = await db.all(
        `SELECT CAST(id AS TEXT) AS id, name FROM actors WHERE id IN (${placeholders})`,
        intIds
      );
    }
    const byId = new Map(rows.map(r => [String(r.id), r.name]));
    console.warn('[notify] actor_name_snapshot missing, resolved via fallback');
    return ids.map(id => byId.get(id) || id);
  } catch (err) {
    console.warn('[notify] actor_name_snapshot missing, fallback failed', err);
    return ids;
  }
}

export async function send(chatId, text, extra = {}) {
  const start = Date.now();
  const { type = 'unknown' } = extra;
  if (!ENABLE_NOTIFICATIONS) {
    console.info('[notify] skipped by flag', {
      chatId,
      type,
      duration: Date.now() - start,
    });
    return;
  }
  try {
    const bot = getBot();
    await bot.telegram.sendMessage(chatId, text);
    console.info('[notify] sent', {
      chatId,
      type,
      duration: Date.now() - start,
    });
  } catch (err) {
    console.error('[notify] error', {
      chatId,
      type,
      duration: Date.now() - start,
      error: err.message,
    });
  }
}

export async function notifyRehearsalCreated(chatId, rehearsal) {
  if (!shouldNotify('created', chatId, rehearsal.id)) return;

  // Load project settings to check if notifications are enabled
  const settings = await loadProjectSettings(chatId);
  if (!settings.enabled) {
    console.info('[notify] skipped - notifications disabled for project', { chatId });
    return;
  }

  const data = withTimes(rehearsal);
  const actors = await resolveActorNames(rehearsal);
  await send(chatId, formatRehearsalCreated({ ...data, actors }, settings.language), { type: 'created' });
}

export async function notifyRehearsalUpdated(chatId, _before, after) {
  if (!shouldNotify('updated', chatId, after.id)) return;

  // Load project settings to check if notifications are enabled
  const settings = await loadProjectSettings(chatId);
  if (!settings.enabled) {
    console.info('[notify] skipped - notifications disabled for project', { chatId });
    return;
  }

  const data = withTimes(after);
  const actors = await resolveActorNames(after);
  await send(chatId, formatRehearsalUpdated({ ...data, actors }, settings.language), { type: 'updated' });
}

export async function notifyRehearsalDeleted(chatId, rehearsal) {
  if (!shouldNotify('deleted', chatId, rehearsal.id)) return;

  // Load project settings to check if notifications are enabled
  const settings = await loadProjectSettings(chatId);
  if (!settings.enabled) {
    console.info('[notify] skipped - notifications disabled for project', { chatId });
    return;
  }

  const data = withTimes(rehearsal);
  const actors = await resolveActorNames(rehearsal);
  await send(chatId, formatRehearsalDeleted({ ...data, actors }, settings.language), { type: 'deleted' });
}
