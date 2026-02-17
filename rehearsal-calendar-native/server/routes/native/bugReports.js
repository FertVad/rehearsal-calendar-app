import { Router } from 'express';
import db from '../../database/db.js';
import { requireAuth } from '../../middleware/jwtMiddleware.js';

const router = Router();

// POST /api/native/bug-reports
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { message, screen } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const result = await db.run(
      `INSERT INTO native_bug_reports (user_id, message, screen, created_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [userId, message.trim(), screen || null]
    );

    res.json({ success: true, data: { id: result.lastInsertId } });
  } catch (error) {
    console.error('Error creating bug report:', error);
    res.status(500).json({ error: 'Failed to create bug report' });
  }
});

export default router;
