import { Router } from 'express';
import db from '../database/db.js';
import { adminLogin, requireAdmin } from '../middleware/adminAuth.js';
import { generateAdminPageHTML } from './admin/dashboardPage.js';

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
      activeSubs,
      revenue,
      cancelledSubs,
      inactiveUsers,
      totalProjects,
      totalRehearsals,
    ] = await Promise.all([
      db.get('SELECT COUNT(*) as count FROM native_users'),
      db.get('SELECT COUNT(*) as count FROM native_users WHERE created_at >= $1', [weekAgo.toISOString()]),
      db.get('SELECT COUNT(*) as count FROM native_users WHERE created_at >= $1', [monthAgo.toISOString()]),
      db.all(`
        SELECT p.display_name_en as plan, COUNT(s.id) as count
        FROM native_user_subscriptions s
        JOIN native_subscription_plans p ON s.plan_id = p.id
        WHERE s.status = 'active'
        GROUP BY p.id, p.display_name_en
      `),
      db.get(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM native_payment_transactions
        WHERE status = 'completed'
      `),
      db.get(`
        SELECT COUNT(*) as count
        FROM native_user_subscriptions
        WHERE status = 'cancelled' AND cancelled_at >= $1
      `, [monthAgo.toISOString()]),
      db.get(`
        SELECT COUNT(*) as count
        FROM native_users
        WHERE last_login_at IS NOT NULL AND last_login_at < $1
      `, [monthAgo.toISOString()]),
      db.get('SELECT COUNT(*) as count FROM native_projects'),
      db.get('SELECT COUNT(*) as count FROM native_rehearsals'),
    ]);

    const totalActive = activeSubs.reduce((sum, s) => sum + Number(s.count), 0);
    const churnSubsBase = totalActive + Number(cancelledSubs.count);
    const churnSubsRate = churnSubsBase > 0
      ? Math.round((Number(cancelledSubs.count) / churnSubsBase) * 1000) / 10
      : 0;

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
      subscriptions: {
        active: activeSubs.map(s => ({ plan: s.plan, count: Number(s.count) })),
        totalActive,
      },
      revenue: {
        total: Number(revenue.total),
        currency: 'ILS',
      },
      churn: {
        subscriptions: {
          cancelledLast30Days: Number(cancelledSubs.count),
          rate: churnSubsRate,
        },
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
          u.created_at, u.last_login_at,
          s.status as subscription_status,
          p.display_name_en as plan_name
        FROM native_users u
        LEFT JOIN native_user_subscriptions s
          ON s.user_id = u.id AND s.status = 'active'
        LEFT JOIN native_subscription_plans p
          ON s.plan_id = p.id
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
        subscriptionStatus: u.subscription_status,
        planName: u.plan_name,
      })),
      total: Number(total.count),
    });
  } catch (err) {
    console.error('[Admin] Users error:', err);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// Transactions list
router.get('/api/transactions', requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const offset = parseInt(req.query.offset) || 0;

    const [total, transactions] = await Promise.all([
      db.get('SELECT COUNT(*) as count FROM native_payment_transactions'),
      db.all(`
        SELECT
          t.id, t.amount, t.currency, t.transaction_type, t.status,
          t.attempted_at, u.email
        FROM native_payment_transactions t
        JOIN native_users u ON t.user_id = u.id
        ORDER BY t.attempted_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]),
    ]);

    res.json({
      transactions: transactions.map(t => ({
        id: t.id,
        email: t.email,
        amount: Number(t.amount),
        currency: t.currency,
        type: t.transaction_type,
        status: t.status,
        attemptedAt: t.attempted_at,
      })),
      total: Number(total.count),
    });
  } catch (err) {
    console.error('[Admin] Transactions error:', err);
    res.status(500).json({ error: 'Failed to load transactions' });
  }
});

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
        name: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email,
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
