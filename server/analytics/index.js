// Analytics module barrel export
// Central entry point for analytics functionality

import dbInstance from '../database/db.js';

// Use the main database connection wrapper from server/database/db.js
// This provides .get(), .all(), .run() methods that work with both PostgreSQL and SQLite
export function getDbConnection() {
  return dbInstance;
}

// Re-export services and routes
export { default as trackingService } from './services/trackingService.js';
export { default as analyticsService } from './services/analyticsService.js';

export { default as trackRoutes } from './routes/track.js';
export { default as adminRoutes } from './routes/admin.js';
export { default as authRoutes } from './routes/auth.js';

export { default as adminAuth } from './middleware/adminAuth.js';
export { default as rateLimiter } from './middleware/rateLimiter.js';
