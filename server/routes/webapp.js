import { Router } from 'express';
import { verifyTelegramInitData } from '../utils/telegramAuth.js';
import * as Project from '../database/models/Project.js';
import * as Actor from '../database/models/Actor.js';
import { requireTelegramAuth } from '../middleware/authMiddleware.js';

const router = Router();
const toBool = (v) => String(v || '').toLowerCase() === 'true' || String(v) === '1';
const DEBUG = toBool(process.env.DEBUG);

// Upsert actor on WebApp open
// Client must send header: x-telegram-init-data (Telegram WebApp initData)
router.post('/webapp/upsert-actor', requireTelegramAuth({ allowDevParam: true }), async (req, res) => {
  try {
    const { userId, chatId } = req.tg || {};
    if (!userId || !chatId) {
      return res.status(400).json({ ok: false, error: 'Missing user/chat context' });
    }

    // Resolve project
    const project = await Project.findByChatId(chatId);
    if (!project) {
      return res.status(404).json({ ok: false, error: 'Project not found' });
    }

    // Check if actor already exists for this project
    const existing = await Actor.findByTelegramId(String(userId), project.id);
    if (existing) {
      if (DEBUG) console.log('[webapp] upsert-actor: actor exists, return without changes', {
        chatId,
        projectId: project.id,
        userId,
        actorId: existing.id,
        is_admin: existing.is_admin,
      });
      return res.json({ ok: true, actor: existing });
    }

    // Parse init data again to extract display name (middleware keeps only ids)
    const raw = req.header('x-telegram-init-data') || '';
    let first_name = '', last_name = '', username = '';
    try {
      const token = process.env.TELEGRAM_BOT_TOKEN || '';
      const verified = verifyTelegramInitData(raw, token, {});
      if (verified.ok) {
        first_name = verified.user?.first_name || '';
        last_name = verified.user?.last_name || '';
        username = verified.user?.username || '';
      }
    } catch (e) {
      // keep silent; fallback to userId
      console.warn('[webapp] initData parse failed (name fallback to id)', e?.message || e);
    }

    const displayName = [first_name, last_name].filter(Boolean).join(' ') || username || String(userId);

    let actor;
    try {
      actor = await Actor.create({
        telegram_id: String(userId),
        name: displayName,
        project_id: project.id,
        is_admin: false,
      });
      if (DEBUG) console.log('[webapp] upsert-actor: actor created', { chatId, projectId: project.id, userId, actorId: actor?.id });
    } catch (createErr) {
      console.error('[webapp] upsert-actor: failed to create actor', createErr);
      return res.status(500).json({ ok: false, error: 'Failed to create actor' });
    }

    return res.json({ ok: true, actor });
  } catch (err) {
    console.error('[webapp] upsert-actor error', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

export default router;
