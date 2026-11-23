import { asyncHandler } from '../middleware/asyncHandler.js';
import { Router } from 'express';
import db from '../database/db.js';
import { adminLogin, requireAdmin } from '../middleware/adminAuth.js';
import { generateAdminPageHTML } from './admin/dashboardPage.js';
import { fullName } from './../utils/names.js';
import { analytics, summary } from '../services/admin/analytics.js';
import {
  FilterRefused, emptyFacts, loadFacts, loadPeople, matches, parseFilters, registeredSince, userRow,
} from '../services/admin/people.js';

const router = Router();

// Serve admin dashboard HTML
router.get('/', (_req, res) => {
  res.send(generateAdminPageHTML());
});

// Login
router.post('/api/login', adminLogin);

// The filters every statistics route takes; a malformed one is a 400, not a guess.
function filtersOf(req, res) {
  try {
    return parseFilters(req.query);
  } catch (error) {
    if (!(error instanceof FilterRefused)) throw error;
    res.status(400).json({ error: error.message });
    return null;
  }
}

// The cards: as of now, real people only — service accounts never count (T-293).
// Who has not signed in for 30 days is all the sign-in figure can say: a
// session renews itself without one (H03).
router.get('/api/stats', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const filters = filtersOf(req, res);
    if (!filters) return;
    res.json(await summary(db, filters));
  } catch (err) {
    console.error('[Admin] Stats error:', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
}));

// Everything under the cards: funnel, sources, projects, notifications (T-293).
// No addresses here — they stay in the users table.
router.get('/api/analytics', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const filters = filtersOf(req, res);
    if (!filters) return;
    res.json(await analytics(db, filters));
  } catch (err) {
    console.error('[Admin] Analytics error:', err);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
}));

// Users list: one row per person registered in the period, newest first, with
// where they came from and how far they got. Service accounts only with ?service=1.
router.get('/api/users', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const filters = filtersOf(req, res);
    if (!filters) return;
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    const directory = await loadPeople(db);
    const listed = [...directory.people.values()]
      .filter((person) => (filters.service || !person.service) && matches(person, filters)
        && registeredSince(person, filters.since))
      .sort((a, b) => (b.createdAt ?? -Infinity) - (a.createdAt ?? -Infinity) || b.id - a.id);
    const page = listed.slice(offset, offset + limit);
    const facts = await loadFacts(db, page.map((person) => person.id));

    res.json({
      users: page.map((person) => userRow(person, facts.get(person.id) || emptyFacts(), directory)),
      total: listed.length,
    });
  } catch (err) {
    console.error('[Admin] Users error:', err);
    res.status(500).json({ error: 'Failed to load users' });
  }
}));

// Bug reports list
router.get('/api/bug-reports', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const offset = parseInt(req.query.offset) || 0;

    const [total, reports] = await Promise.all([
      db.get('SELECT COUNT(*) as count FROM native_bug_reports'),
      db.all(`
        SELECT
          r.id, r.message, r.screen, r.status, r.created_at,
          u.email, u.first_name, u.last_name
        FROM native_bug_reports r
        JOIN native_users u ON r.user_id = u.id
        ORDER BY
          CASE r.status
            WHEN 'new' THEN 0
            WHEN 'in_progress' THEN 1
            WHEN 'fixed' THEN 2
          END,
          r.created_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]),
    ]);

    res.json({
      reports: reports.map(r => ({
        id: r.id,
        message: r.message,
        screen: r.screen,
        status: r.status,
        createdAt: r.created_at,
        email: r.email,
        name: fullName(r, r.email),
      })),
      total: Number(total.count),
    });
  } catch (err) {
    console.error('[Admin] Bug reports error:', err);
    res.status(500).json({ error: 'Failed to load bug reports' });
  }
}));

// Update bug report status
router.patch('/api/bug-reports/:id/status', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[1-9]\d*$/.test(id) || Number(id) > 2147483647) {
      return res.status(400).json({ error: 'Invalid bug report ID' });
    }
    const status = req.body?.status;

    const validStatuses = ['new', 'in_progress', 'fixed'];
    if (typeof status !== 'string' || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be: new, in_progress, fixed' });
    }

    const report = await db.get(
      'UPDATE native_bug_reports SET status = $1 WHERE id = $2 RETURNING id',
      [status, Number(id)],
    );
    if (!report) return res.status(404).json({ error: 'Bug report not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[Admin] Update bug report status error:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
}));

export default router;
