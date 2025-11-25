import { Router } from 'express';
import db from '../database/db.js';
import { AvailabilityModel } from '../database/models/Availability.js';
import { 
  getAvailabilityByTelegramId, 
  getActorProjects,
  formatAvailabilityDisplay 
} from '../utils/availabilityHelpers.js';
import { requireTelegramAuth } from '../middleware/authMiddleware.js';

const router = Router();

// Access control: allow if requester == target OR requester is admin
async function ensureSelfOrAdminForTarget(req, res, next) {
  try {
    const targetTelegramId = String(req.params.telegramId);
    const requesterTelegramId = String(req.tg?.userId || '');
    if (!requesterTelegramId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (targetTelegramId === requesterTelegramId) return next();

    // Admin in any shared project: requester is admin in project where target is a member
    const adminProjects = await db.all(
      `SELECT project_id FROM actors WHERE telegram_id = ? AND is_admin = TRUE`,
      [requesterTelegramId],
    );
    if (!adminProjects.length) return res.status(403).json({ error: 'Access denied' });
    const adminProjectIds = new Set(adminProjects.map(p => String(p.project_id)));
    const targetProjects = await db.all(
      `SELECT project_id FROM actors WHERE telegram_id = ?`,
      [targetTelegramId],
    );
    const hasShared = targetProjects.some(p => adminProjectIds.has(String(p.project_id)));
    if (!hasShared) return res.status(403).json({ error: 'Access denied' });
    return next();
  } catch (err) {
    console.error('[global] access control error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/global/actors/:telegramId/projects – all projects for actor
router.get('/actors/:telegramId/projects', requireTelegramAuth({ allowDevParam: true }), async (req, res) => {
  try {
    const telegramId = String(req.params.telegramId);
    const requester = String(req.tg?.userId || '');
    if (telegramId !== requester) {
      return res.status(403).json({ error: 'Can only view own projects' });
    }
    const projects = await getActorProjects(telegramId);
    res.json({
      telegramId,
      projects,
      totalProjects: projects.length,
      adminProjects: projects.filter(p => p.is_admin).length,
    });
  } catch (error) {
    console.error('Error fetching actor projects:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/global/actors/:telegramId/availability – full availability for range
router.get('/actors/:telegramId/availability', requireTelegramAuth({ allowDevParam: true }), ensureSelfOrAdminForTarget, async (req, res) => {
  try {
    const telegramId = String(req.params.telegramId);
    const { startDate, endDate } = req.query;
    if (typeof startDate !== 'string' || typeof endDate !== 'string') {
      return res.status(400).json({ error: 'startDate and endDate query parameters are required' });
    }
    const rows = await getAvailabilityByTelegramId(telegramId, startDate, endDate);
    const availability = rows.map(item => ({
      ...item,
      display: formatAvailabilityDisplay(item.timeRanges),
    }));
    res.json({ telegramId, dateRange: { startDate, endDate }, availability, totalRecords: availability.length });
  } catch (error) {
    console.error('Error fetching global availability:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/global/actors/:telegramId/availability/batch – batch update
router.put('/actors/:telegramId/availability/batch', requireTelegramAuth({ allowDevParam: true }), ensureSelfOrAdminForTarget, async (req, res) => {
  try {
    const telegramId = String(req.params.telegramId);
    const updates = Array.isArray(req.body?.updates) ? req.body.updates : (Array.isArray(req.body) ? req.body : null);
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'updates array is required and must not be empty' });
    }
    // basic validation
    for (const [idx, u] of updates.entries()) {
      if (!u?.date || !Array.isArray(u?.timeRanges)) {
        return res.status(400).json({ error: `update #${idx} must have date and timeRanges[]` });
      }
    }
    const model = new AvailabilityModel(db);
    await model.batchUpdateByTelegram(telegramId, updates);
    res.json({ success: true, telegramId, updatedCount: updates.length, message: 'Batch availability updated globally' });
  } catch (error) {
    console.error('Error batch updating availability (global):', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/global/actors/:telegramId/stats – basic stats
router.get('/actors/:telegramId/stats', requireTelegramAuth({ allowDevParam: true }), async (req, res) => {
  try {
    const telegramId = String(req.params.telegramId);
    const requester = String(req.tg?.userId || '');
    if (telegramId !== requester) return res.status(403).json({ error: 'Can only view own stats' });

    const projects = await getActorProjects(telegramId);
    const daysAgo = d => { const x = new Date(); x.setDate(x.getDate() - d); return x.toISOString().slice(0,10); };
    const startDate = daysAgo(30);
    const endDate = new Date().toISOString().slice(0,10);
    const rows = await getAvailabilityByTelegramId(telegramId, startDate, endDate);

    const stats = { available: 0, busy: 0, partial: 0 };
    for (const item of rows) {
      if (!item.timeRanges || item.timeRanges.length === 0) stats.available++;
      else if (item.timeRanges === 'busy') stats.busy++;
      else stats.partial++;
    }

    res.json({
      telegramId,
      projects: {
        total: projects.length,
        adminProjects: projects.filter(p => p.is_admin).length,
        projectNames: projects.map(p => p.name),
      },
      availability: {
        period: `${startDate} to ${endDate}`,
        totalRecords: rows.length,
        breakdown: stats,
      },
    });
  } catch (error) {
    console.error('Error fetching actor stats (global):', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/global/availability/batch – multi-user batch (admin only per shared projects)
router.post('/availability/batch', requireTelegramAuth({ allowDevParam: true }), async (req, res) => {
  try {
    const updates = Array.isArray(req.body?.updates) ? req.body.updates : null; // [{ telegramId, date, timeRanges }]
    const requester = String(req.tg?.userId || '');
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'updates array is required and must not be empty' });
    }
    const telegramIds = [...new Set(updates.map(u => String(u.telegramId)))];
    const adminProjects = await db.all('SELECT project_id FROM actors WHERE telegram_id = ? AND is_admin = TRUE', [requester]);
    const adminProjectIds = new Set(adminProjects.map(p => String(p.project_id)));
    for (const tid of telegramIds) {
      const targetProjects = await db.all('SELECT project_id FROM actors WHERE telegram_id = ?', [tid]);
      const hasShared = targetProjects.some(tp => adminProjectIds.has(String(tp.project_id)));
      if (!hasShared) return res.status(403).json({ error: `Access denied for user ${tid}` });
    }

    // group by user and perform batch updates
    const grouped = new Map();
    for (const u of updates) {
      const key = String(u.telegramId);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push({ date: u.date, timeRanges: Array.isArray(u.timeRanges) ? u.timeRanges : [] });
    }
    const model = new AvailabilityModel(db);
    await db.run('BEGIN');
    try {
      for (const [tid, ups] of grouped.entries()) {
        await model.batchUpdateByTelegram(tid, ups);
      }
      await db.run('COMMIT');
    } catch (err) {
      await db.run('ROLLBACK').catch(() => {});
      throw err;
    }
    res.json({ success: true, usersAffected: grouped.size, totalUpdated: updates.length });
  } catch (error) {
    console.error('Error batch updating multiple users (global):', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

