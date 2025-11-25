// Admin authentication routes
// Login, logout, session check

import express from 'express';
import { handleLogin, handleLogout, handleCheckSession, requireAdminAuth } from '../middleware/adminAuth.js';

const router = express.Router();

/**
 * POST /api/analytics/admin/auth/login
 * Login with admin password
 */
router.post('/login', handleLogin);

/**
 * POST /api/analytics/admin/auth/logout
 * Logout and invalidate session
 */
router.post('/logout', requireAdminAuth, handleLogout);

/**
 * GET /api/analytics/admin/auth/check
 * Check if current session is valid
 */
router.get('/check', requireAdminAuth, handleCheckSession);

export default router;
