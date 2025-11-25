import { Router } from 'express';
import * as Project from '../database/models/Project.js';
import * as Actor from '../database/models/Actor.js';
import db from '../database/db.js';
import { requireTelegramAuth, requireProjectMember } from '../middleware/authMiddleware.js';
import { getAvailabilityByTelegramId } from '../utils/availabilityHelpers.js';
import { send as sendNotification } from '../bot/notifications.js';

/**
 * Router handling project related endpoints.
 */
const router = Router();
const toBool = (v) => String(v || '').toLowerCase() === 'true' || String(v) === '1';
const DEBUG = toBool(process.env.DEBUG);

// GET /api/project/:chatId
router.get('/project/:chatId', requireTelegramAuth({ allowDevParam: true }), requireProjectMember(Project, Actor), async (req, res) => {
  try {
    const project = req.project;
    res.json({ project });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// GET /api/project/:chatId/actors
router.get('/project/:chatId/actors', requireTelegramAuth({ allowDevParam: true }), requireProjectMember(Project, Actor), async (req, res) => {
  try {
    if (DEBUG) console.log('\n=== API /project/:chatId/actors TRACE START ===');
    if (DEBUG) console.log('Request params:', req.params);
    if (DEBUG) console.log('Request query:', req.query);
    const project = req.project;
    let { startDate, endDate } = req.query || {};
    const toDateStr = (d) => new Date(d).toISOString().slice(0, 10);
    const addDays = (d, n) => {
      const dt = new Date(d);
      dt.setDate(dt.getDate() + n);
      return dt;
    };
    const isValidDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime());
    // Default window: [today .. today+89] (90 days)
    const todayStr = toDateStr(new Date());
    if (!isValidDate(startDate)) startDate = todayStr;
    if (!isValidDate(endDate)) endDate = toDateStr(addDays(startDate, 89));
    // Clamp to max 90 days window
    const startObj = new Date(startDate);
    const maxEnd = toDateStr(addDays(startObj, 89));
    if (endDate > maxEnd) endDate = maxEnd;
    if (DEBUG) console.log('Computed date range:', { startDate, endDate });
    if (DEBUG) console.log('Project:', { id: project.id, chat_id: project.chat_id, name: project.name });
    const actors = (await Actor.findAll()).filter(a => a.project_id === project.id);
    if (DEBUG) console.log('Actors in project:', actors.length, actors.map(a => ({ id: a.id, name: a.name, telegram_id: a.telegram_id })));

    const result = await Promise.all(
      actors.map(async a => {
        if (DEBUG) console.log(`\n--- Processing actor: ${a.name} (${a.telegram_id}) ---`);

        // Get merged availability (manual + rehearsals from ALL projects)
        const availabilityList = await getAvailabilityByTelegramId(String(a.telegram_id), String(startDate), String(endDate));
        if (DEBUG) console.log(`[Actors API] tg=${a.telegram_id} merged availability rows:`, availabilityList?.length || 0, 'dates:', (availabilityList||[]).map(r => r.date));

        const pc = await db.get('SELECT COUNT(DISTINCT project_id) as cnt FROM actors WHERE telegram_id = ?', [String(a.telegram_id)]);
        const availabilityMap = {};
        for (const item of availabilityList) {
          availabilityMap[item.date] = { timeRanges: item.timeRanges };
        }
        if (DEBUG) console.log(`Actor ${a.telegram_id} final availability keys:`, Object.keys(availabilityMap));
        return {
          id: String(a.id),
          name: a.name,
          telegramId: a.telegram_id,
          isAdmin: Boolean(a.is_admin),
          availability: availabilityMap,
          projectsCount: Number(pc?.cnt || 0),
        };
      })
    );
    if (DEBUG) console.log('\n=== FINAL API RESPONSE SUMMARY ===');
    if (DEBUG) console.log('Response actors count:', result.length);
    result.forEach(r => {
      if (DEBUG) console.log(`Actor ${r.name}`, {
        telegram_id: r.telegramId,
        availability_days_count: Object.keys(r.availability || {}).length,
        availability_sample_dates: Object.keys(r.availability || {}).slice(0, 3),
      });
    });
    if (DEBUG) console.log('=== API TRACE END ===\n');
    res.json({ actors: result, meta: { startDate, endDate } });
  } catch (error) {
    console.error('Error fetching actors:', error);
    res.status(500).json({ error: 'Failed to fetch actors' });
  }
});

// POST /api/project/:chatId/send-schedule
router.post('/project/:chatId/send-schedule', requireTelegramAuth({ allowDevParam: true }), requireProjectMember(Project, Actor), async (req, res) => {
  try {
    const project = req.project;
    const actor = req.actor;
    const { message } = req.body;

    // Check if user is admin
    if (!actor.is_admin) {
      return res.status(403).json({ error: 'Only admins can send schedule to group' });
    }

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Send message to group
    await sendNotification(project.chat_id, message, { type: 'schedule' });

    res.json({ success: true });
  } catch (error) {
    console.error('Error sending schedule:', error);
    res.status(500).json({ error: 'Failed to send schedule' });
  }
});


export default router;
