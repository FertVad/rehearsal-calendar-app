// Admin analytics API endpoints
// Provides metrics and statistics for admin dashboard

import express from 'express';
import analyticsService from '../services/analyticsService.js';
import { requireAdminAuth } from '../middleware/adminAuth.js';
import * as userActivity from '../queries/userActivity.js';
import { getDbConnection } from '../index.js';

const router = express.Router();

// Apply authentication middleware to all admin routes
router.use(requireAdminAuth);

/**
 * GET /api/analytics/admin/overview
 * Get overview statistics: total users, DAU, MAU, event breakdown
 */
router.get('/overview', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Default to last 30 days
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const stats = await analyticsService.getOverviewStats(
      start.toISOString(),
      end.toISOString()
    );

    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    console.error('[Analytics Admin] Overview error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to get overview stats'
    });
  }
});

/**
 * GET /api/analytics/admin/dau
 * Get Daily Active Users for a specific date
 */
router.get('/dau', async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Date parameter is required'
      });
    }

    const dau = await analyticsService.getDailyActiveUsers(date);

    res.json({
      success: true,
      date,
      dau
    });
  } catch (err) {
    console.error('[Analytics Admin] DAU error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to get DAU'
    });
  }
});

/**
 * GET /api/analytics/admin/mau
 * Get Monthly Active Users for a specific month
 */
router.get('/mau', async (req, res) => {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({
        success: false,
        error: 'Year and month parameters are required'
      });
    }

    const mau = await analyticsService.getMonthlyActiveUsers(
      parseInt(year),
      parseInt(month)
    );

    res.json({
      success: true,
      year: parseInt(year),
      month: parseInt(month),
      mau
    });
  } catch (err) {
    console.error('[Analytics Admin] MAU error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to get MAU'
    });
  }
});

/**
 * GET /api/analytics/admin/dau-mau-range
 * Get DAU/MAU data for a date range
 */
router.get('/dau-mau-range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start and end date parameters are required'
      });
    }

    const data = await analyticsService.getDauMauRange(startDate, endDate);

    res.json({
      success: true,
      startDate,
      endDate,
      data
    });
  } catch (err) {
    console.error('[Analytics Admin] DAU/MAU range error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to get DAU/MAU range'
    });
  }
});

/**
 * GET /api/analytics/admin/events
 * Get event breakdown by event name
 */
router.get('/events', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Default to last 30 days
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const events = await analyticsService.getEventBreakdown(
      start.toISOString(),
      end.toISOString()
    );

    res.json({
      success: true,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      events
    });
  } catch (err) {
    console.error('[Analytics Admin] Events error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to get event breakdown'
    });
  }
});

/**
 * GET /api/analytics/admin/top-users
 * Get top active users
 */
router.get('/top-users', async (req, res) => {
  try {
    const { limit = 10, startDate, endDate } = req.query;

    // Default to last 30 days
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const users = await analyticsService.getTopActiveUsers(
      parseInt(limit),
      start.toISOString(),
      end.toISOString()
    );

    res.json({
      success: true,
      users
    });
  } catch (err) {
    console.error('[Analytics Admin] Top users error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to get top users'
    });
  }
});

/**
 * GET /api/analytics/admin/retention
 * Get user retention data for a cohort
 */
router.get('/retention', async (req, res) => {
  try {
    const { cohortDate } = req.query;

    if (!cohortDate) {
      return res.status(400).json({
        success: false,
        error: 'Cohort date parameter is required'
      });
    }

    const retention = await analyticsService.getUserRetention(cohortDate);

    res.json({
      success: true,
      retention
    });
  } catch (err) {
    console.error('[Analytics Admin] Retention error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to get retention data'
    });
  }
});

/**
 * GET /api/analytics/admin/hourly-activity
 * Get hourly activity distribution for a specific date
 */
router.get('/hourly-activity', async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Date parameter is required'
      });
    }

    const activity = await analyticsService.getHourlyActivity(date);

    res.json({
      success: true,
      date,
      activity
    });
  } catch (err) {
    console.error('[Analytics Admin] Hourly activity error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to get hourly activity'
    });
  }
});

/**
 * GET /api/analytics/admin/user-activity/:userId
 * Get activity timeline for a specific user
 */
router.get('/user-activity/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;

    const activity = await analyticsService.getUserActivity(userId, parseInt(limit));

    res.json({
      success: true,
      userId,
      activity
    });
  } catch (err) {
    console.error('[Analytics Admin] User activity error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to get user activity'
    });
  }
});

/**
 * GET /api/analytics/admin/stats
 * Get basic stats: total users, events, projects
 */
router.get('/stats', async (req, res) => {
  try {
    const [totalUsers, totalEvents, totalProjects] = await Promise.all([
      analyticsService.getTotalUsers(),
      analyticsService.getTotalEvents(),
      analyticsService.getTotalProjects()
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalEvents,
        totalProjects
      }
    });
  } catch (err) {
    console.error('[Analytics Admin] Stats error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to get stats'
    });
  }
});

/**
 * GET /api/analytics/admin/user-activity-summary
 * Get user activity metrics: total, active, inactive, churn
 */
router.get('/user-activity-summary', async (req, res) => {
  try {
    const db = getDbConnection();
    const summary = await userActivity.getUserActivitySummary(db);

    res.json({
      success: true,
      data: summary
    });
  } catch (err) {
    console.error('[Analytics Admin] User activity summary error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to get user activity summary'
    });
  }
});

export default router;
