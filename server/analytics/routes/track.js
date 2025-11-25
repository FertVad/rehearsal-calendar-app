// Analytics tracking routes
// POST /api/analytics/track - записать событие

import express from 'express';
import trackingService from '../services/trackingService.js';
import rateLimiter from '../middleware/rateLimiter.js';

const router = express.Router();

// Apply rate limiting: 100 requests per minute per user/IP
router.use(rateLimiter(100, 60 * 1000));

/**
 * Track single event
 * POST /api/analytics/track
 * Body: { event: string, userId?: string, properties?: object }
 */
router.post('/track', async (req, res) => {
  try {
    const { event, userId, properties } = req.body;

    // Validation
    if (!event) {
      return res.status(400).json({
        success: false,
        error: 'Event name is required'
      });
    }

    if (typeof event !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Event name must be a string'
      });
    }

    // Track event
    const tracked = await trackingService.trackEvent(
      userId,
      event,
      properties || {}
    );

    res.status(201).json({
      success: true,
      event: tracked
    });

  } catch (error) {
    console.error('[Track API] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track event'
    });
  }
});

/**
 * Track multiple events (batch)
 * POST /api/analytics/track/batch
 * Body: { events: [{ event, userId?, properties? }] }
 */
router.post('/track/batch', async (req, res) => {
  try {
    const { events } = req.body;

    // Validation
    if (!events || !Array.isArray(events)) {
      return res.status(400).json({
        success: false,
        error: 'Events array is required'
      });
    }

    if (events.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Events array cannot be empty'
      });
    }

    if (events.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 events per batch'
      });
    }

    // Validate each event
    for (const event of events) {
      if (!event.event || typeof event.event !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Each event must have a valid event name'
        });
      }
    }

    // Track events
    const formatted = events.map(e => ({
      userId: e.userId,
      eventName: e.event,
      properties: e.properties || {}
    }));

    const count = await trackingService.trackEventsBatch(formatted);

    res.status(201).json({
      success: true,
      tracked: count,
      total: events.length
    });

  } catch (error) {
    console.error('[Track API] Batch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track events'
    });
  }
});

/**
 * Get user events (для дебага)
 * GET /api/analytics/events/:userId?limit=50
 */
router.get('/events/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    if (limit > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Maximum limit is 1000'
      });
    }

    const events = await trackingService.getUserEvents(userId, limit);

    res.json({
      success: true,
      userId,
      events,
      count: events.length
    });

  } catch (error) {
    console.error('[Track API] Get events error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get events'
    });
  }
});

export default router;
