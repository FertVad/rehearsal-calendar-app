import { Router } from 'express';
import * as Project from '../database/models/Project.js';
import * as Rehearsal from '../database/models/Rehearsal.js';
import * as Actor from '../database/models/Actor.js';
import * as notifications from '../bot/notifications.js';
import db, { isPostgres } from '../database/db.js';

import { normalizeChatId } from '../utils/helpers.js';
import { requireTelegramAuth, requireProjectMember, requireProjectAdmin } from '../middleware/authMiddleware.js';

/**
 * Router handling rehearsal related endpoints.
 */
const router = Router();
const toBool = (v) => String(v || '').toLowerCase() === 'true' || String(v) === '1';
const DEBUG = toBool(process.env.DEBUG);

// Security: Telegram WebApp auth + membership/admin checks are applied per-route

async function buildActorNameSnapshot(actorIds = []) {
  const ids = (actorIds || []).map(String);
  if (!ids.length) return [];
  try {
    let rows;
    const intIds = ids.map(id => parseInt(id, 10));
    if (isPostgres) {
      rows = await db.all(
        'SELECT id::text AS id, name FROM actors WHERE id = ANY($1::int[])',
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
    return ids.map(id => ({ id, name: byId.get(id) || id }));
  } catch (err) {
    console.error('Failed to build actor snapshot', err);
    return ids.map(id => ({ id, name: id }));
  }
}

// Removed open endpoint: GET /api/rehearsals (security)

// POST /api/project/:chatId/rehearsals
router.post('/project/:chatId/rehearsals', requireTelegramAuth({ allowDevParam: true }), requireProjectMember(Project, Actor), requireProjectAdmin(), async (req, res) => {
  const start = Date.now();
  const data = req.body;
  const project = req.project;
  const chatId = normalizeChatId(req.params.chatId);
  try {
    const actorIds = (data.actors ?? []).map(String);
    const snapshot = await buildActorNameSnapshot(actorIds);
    const snapshotJson = JSON.stringify(snapshot);
    const created = await Rehearsal.create({
      project_id: project.id,
      scene: data.scene,
      date: data.date,
      time: data.time,
      duration: data.duration,
      actors: JSON.stringify(actorIds),
      actor_name_snapshot: snapshotJson,
      notes: data.notes || '',
    });
    const rehearsal = {
      id: String(created.id),
      scene: created.scene,
      date: created.date,
      time: created.time,
      duration: created.duration,
      actors: actorIds,
      actor_name_snapshot: snapshotJson,
      notes: created.notes || '',
      createdAt: created.created_at ? new Date(created.created_at) : new Date(),
      updatedAt: created.created_at ? new Date(created.created_at) : new Date(),
    };
    res.status(201).json({ rehearsal });
    const durationMs = Date.now() - start;
    if (DEBUG) console.log('[rehearsal-created]', {
      chatId,
      rehearsalId: rehearsal.id,
      date: rehearsal.date,
      actors: actorIds.length,
      durationMs,
    });
    void notifications.notifyRehearsalCreated(chatId, rehearsal).catch(console.error);
  } catch (err) {
    await db.run('ROLLBACK').catch(() => {});
    console.error('Save rehearsal error', err);
    res.status(500).json({ error: 'Failed to save rehearsal' });
  }
});
// Common update handler
async function updateRehearsal(req, res) {
  const start = Date.now();
  const { id, chatId: rawChatId } = req.params;
  const chatId = normalizeChatId(rawChatId);
  const projectId = req.project.id;
  const data = req.body;
  try {
    const existing = await Rehearsal.findById(id);
    if (!existing || existing.project_id !== projectId) {
      return res.status(404).json({ error: 'Rehearsal not found' });
    }

    const oldRehearsal = {
      id: String(existing.id),
      scene: existing.scene,
      date: existing.date,
      time: existing.time,
      duration: existing.duration,
      actors: JSON.parse(existing.actors || '[]'),
      actor_name_snapshot: existing.actor_name_snapshot,
      notes: existing.notes || '',
      createdAt: existing.created_at ? new Date(existing.created_at) : new Date(),
      updatedAt: existing.updated_at ? new Date(existing.updated_at) : new Date(),
    };
    const newActors = Array.isArray(data.actors) ? data.actors.map(String) : oldRehearsal.actors;
    let snapshotJson = existing.actor_name_snapshot || '[]';
    if (Array.isArray(data.actors)) {
      const snapshot = await buildActorNameSnapshot(newActors);
      snapshotJson = JSON.stringify(snapshot);
    }

    const updated = await Rehearsal.update(id, {
      project_id: projectId,
      scene: data.scene,
      date: data.date,
      time: data.time,
      duration: data.duration,
      actors: Array.isArray(data.actors) ? JSON.stringify(newActors) : null,
      actor_name_snapshot: Array.isArray(data.actors) ? snapshotJson : null,
      notes: data.notes || '',
    });

    if (!updated) {
      return res.status(404).json({ error: 'Rehearsal not found' });
    }

    const rehearsal = {
      id: String(updated.id),
      scene: updated.scene,
      date: updated.date,
      time: updated.time,
      duration: updated.duration,
      actors: JSON.parse(updated.actors || '[]'),
      actor_name_snapshot: updated.actor_name_snapshot,
      notes: updated.notes || '',
      updatedAt: new Date(),
    };

    res.json({ rehearsal });
    const durationMs = Date.now() - start;
    if (DEBUG) console.log('[rehearsal-updated]', {
      chatId,
      rehearsalId: rehearsal.id,
      durationMs,
    });
    void notifications.notifyRehearsalUpdated(chatId, oldRehearsal, rehearsal).catch(console.error);
  } catch (err) {
    await db.run('ROLLBACK').catch(() => {});
    console.error('Update rehearsal error', err);
    res.status(500).json({ error: 'Failed to update rehearsal' });
  }
}

router.put('/project/:chatId/rehearsals/:id', requireTelegramAuth({ allowDevParam: true }), requireProjectMember(Project, Actor), requireProjectAdmin(), updateRehearsal);

// DELETE /api/projects/:chatId/rehearsals/:id
router.delete('/project/:chatId/rehearsals/:id', requireTelegramAuth({ allowDevParam: true }), requireProjectMember(Project, Actor), requireProjectAdmin(), async (req, res) => {
  const start = Date.now();
  const { id, chatId: rawChatId } = req.params;
  const chatId = normalizeChatId(rawChatId);
  const logBase = {
    route: '/api/projects/:chatId/rehearsals/:id',
    method: 'DELETE',
    chatId,
    id,
  };
  try {
    const rehearsal = await Rehearsal.findById(id);
    if (!rehearsal || rehearsal.project_id !== req.project.id) {
      const durationMs = Date.now() - start;
      console.warn(JSON.stringify({ ...logBase, status: 404, durationMs }));
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    const deletedRehearsal = {
      id: String(rehearsal.id),
      scene: rehearsal.scene,
      date: rehearsal.date,
      time: rehearsal.time,
      duration: rehearsal.duration,
      actors: JSON.parse(rehearsal.actors || '[]'),
      notes: rehearsal.notes || '',
    };

    await Rehearsal.remove(id);
    const durationMs = Date.now() - start;
    console.log(JSON.stringify({ ...logBase, status: 200, durationMs }));
    res.json({ success: true, deletedId: Number(id) });
    if (DEBUG) console.log('[rehearsal-deleted]', {
      chatId,
      rehearsalId: id,
      date: rehearsal.date,
      durationMs,
    });
    void notifications.notifyRehearsalDeleted(chatId, deletedRehearsal).catch(console.error);
  } catch (err) {
    await db.run('ROLLBACK').catch(() => {});
    const durationMs = Date.now() - start;
    console.error('Delete rehearsal error', err);
    console.log(JSON.stringify({ ...logBase, status: 500, durationMs }));
    res.status(500).json({ success: false, error: 'Failed to delete rehearsal' });
  }
});

// Additional endpoints extracted from server.js

// GET /api/project/:chatId/rehearsals
router.get('/project/:chatId/rehearsals', requireTelegramAuth({ allowDevParam: true }), requireProjectMember(Project, Actor), async (req, res) => {
  
  if (DEBUG) console.log('🚀 GET rehearsals endpoint STARTED');
  try {
    const rawChatId = req.params.chatId;
    if (DEBUG) console.log('🔍 Step 1: rawChatId =', rawChatId);

    const chatId = normalizeChatId(rawChatId);
    if (DEBUG) console.log('🔍 Step 2: normalized chatId =', chatId);

    // Optional actor filter
    const actorId = typeof req.query.actorId === 'string' ? req.query.actorId : undefined;

    if (DEBUG) console.log('🔍 GET rehearsals - Raw chatId:', rawChatId, '→ Normalized:', chatId);
    if (DEBUG) console.log('🔍 GET rehearsals - chatId type:', typeof chatId, 'value:', JSON.stringify(chatId));
    if (DEBUG) console.log('🔍 GET rehearsals - startsWith dev check:', chatId.startsWith('dev-'));
    if (DEBUG) console.log('🔍 Step 3: Checking dev mode, chatId.startsWith("dev-") =', chatId.startsWith('dev-'));

    // Development mode
    if (chatId.startsWith('dev-')) {
      if (DEBUG) console.log('🔧 API Development mode: returning test rehearsals');

      let testRehearsals = [
        {
          id: 'dev-rehearsal-1',
          scene: 'Пролог',
          date: '2025-07-29',
          time: '15:00',
          duration: '2',
          actors: ['Миша', 'Вадим'],
          notes: 'Тестовая репетиция',
          createdAt: new Date().toISOString(),
        },
      ];

      if (actorId) {
        testRehearsals = testRehearsals.filter(r => (r.actors || []).includes(actorId));
      }

      return res.json({ rehearsals: testRehearsals });
    }

    if (DEBUG) console.log('🔍 Step 4: Not dev mode, proceeding to production logic');

    const project = await Project.findByChatId(chatId);
    if (!project) {
      console.log('❌ Project not found for normalized chatId:', chatId);
      return res.status(404).json({ error: 'Project not found' });
    }

    console.log('✅ GET: Project found - ID:', project.id, 'name:', project.name);

    const allRehearsals = await Rehearsal.findAll();
    console.log('📊 GET: Total rehearsals in DB:', allRehearsals.length);
    console.log('🔍 GET: All rehearsals with project_id:', allRehearsals.map(r => ({
      id: r.id,
      project_id: r.project_id,
      date: r.date,
      scene: r.scene || 'no scene'
    })));

    let rehearsals = allRehearsals
      .filter(r => {
        const matches = r.project_id === project.id;
        console.log(`🔍 GET: Rehearsal ${r.id} - project_id: ${r.project_id}, target: ${project.id}, matches: ${matches}`);
        return matches;
      })
      .map(r => {
        let actorNameSnapshot = [];
        try {
          if (r.actor_name_snapshot && typeof r.actor_name_snapshot === 'string' && r.actor_name_snapshot.trim()) {
            actorNameSnapshot = JSON.parse(r.actor_name_snapshot);
          }
        } catch (e) {
          console.warn(`Failed to parse actor_name_snapshot for rehearsal ${r.id}:`, e.message);
        }

        return {
          id: String(r.id),
          scene: r.scene,
          date: r.date,
          time: r.time,
          duration: r.duration,
          actors: JSON.parse(r.actors || '[]'),
          actorNameSnapshot,
          notes: r.notes || '',
          createdAt: r.created_at ? new Date(r.created_at) : new Date(),
          updatedAt: r.created_at ? new Date(r.created_at) : new Date(),
        };
      });

    if (actorId) {
      rehearsals = rehearsals.filter(r => (r.actors || []).includes(actorId));
    }

    console.log('📋 Found rehearsals for project', project.id, ':', rehearsals.length);
    res.json({ rehearsals });
  } catch (error) {
    console.error('❌ GET rehearsals ERROR:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch rehearsals' });
  }
  console.log('🏁 GET rehearsals endpoint FINISHED');
});

// Removed open endpoint: POST /api/rehearsals (security)
// Removed endpoint: GET /api/scenes (unused - scenes stored in rehearsals table)
// Removed endpoint: POST /api/availability (legacy availability check)

export default router;
