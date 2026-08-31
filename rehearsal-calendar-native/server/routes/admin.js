import { Router } from 'express';
import db from '../database/db.js';
import { adminLogin, requireAdmin } from '../middleware/adminAuth.js';
import { generateAdminPageHTML } from './admin/dashboardPage.js';
import { fullName } from './../utils/names.js';

const router = Router();

// Serve admin dashboard HTML
router.get('/', (_req, res) => {
  res.send(generateAdminPageHTML());
});

// Login
router.post('/api/login', adminLogin);

// Aggregate stats
router.get('/api/stats', requireAdmin, async (_req, res) => {
  try {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const [
      totalUsers,
      newWeek,
      newMonth,
      inactiveUsers,
      totalProjects,
      totalRehearsals,
    ] = await Promise.all([
      db.get('SELECT COUNT(*) as count FROM native_users'),
      db.get('SELECT COUNT(*) as count FROM native_users WHERE created_at >= $1', [weekAgo.toISOString()]),
      db.get('SELECT COUNT(*) as count FROM native_users WHERE created_at >= $1', [monthAgo.toISOString()]),
      db.get(`
        SELECT COUNT(*) as count
        FROM native_users
        WHERE last_login_at IS NOT NULL AND last_login_at < $1
      `, [monthAgo.toISOString()]),
      db.get('SELECT COUNT(*) as count FROM native_projects'),
      db.get('SELECT COUNT(*) as count FROM native_rehearsals'),
    ]);

    const totalUsersCount = Number(totalUsers.count);
    const inactiveCount = Number(inactiveUsers.count);
    const churnUsersRate = totalUsersCount > 0
      ? Math.round((inactiveCount / totalUsersCount) * 1000) / 10
      : 0;

    res.json({
      users: {
        total: totalUsersCount,
        newThisWeek: Number(newWeek.count),
        newThisMonth: Number(newMonth.count),
      },
      churn: {
        users: {
          inactiveLast30Days: inactiveCount,
          rate: churnUsersRate,
        },
      },
      usage: {
        projects: Number(totalProjects.count),
        rehearsals: Number(totalRehearsals.count),
      },
    });
  } catch (err) {
    console.error('[Admin] Stats error:', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// Users list
router.get('/api/users', requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const offset = parseInt(req.query.offset) || 0;

    const [total, users] = await Promise.all([
      db.get('SELECT COUNT(*) as count FROM native_users'),
      db.all(`
        SELECT
          u.id, u.email, u.first_name, u.last_name,
          u.created_at, u.last_login_at
        FROM native_users u
        ORDER BY u.created_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]),
    ]);

    res.json({
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        firstName: u.first_name,
        lastName: u.last_name,
        createdAt: u.created_at,
        lastLoginAt: u.last_login_at,
      })),
      total: Number(total.count),
    });
  } catch (err) {
    console.error('[Admin] Users error:', err);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// Transactions list

// Bug reports list
router.get('/api/bug-reports', requireAdmin, async (req, res) => {
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
});

// Update bug report status
router.patch('/api/bug-reports/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['new', 'in_progress', 'fixed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be: new, in_progress, fixed' });
    }

    await db.run('UPDATE native_bug_reports SET status = $1 WHERE id = $2', [status, id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[Admin] Update bug report status error:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

export default router;
