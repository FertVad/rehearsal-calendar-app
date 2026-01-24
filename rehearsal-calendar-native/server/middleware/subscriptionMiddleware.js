/**
 * Subscription Middleware
 * Checks if user has an active subscription before allowing certain operations
 *
 * Pattern: Similar to jwtMiddleware.js - sets req properties and can block requests
 */

import { getUserActiveSubscription } from '../services/subscriptionService.js';
import { logger } from '../utils/logger.js';

/**
 * Check if user has an active subscription
 * Blocks request if user doesn't have active subscription
 *
 * Usage:
 * router.post('/projects', requireAuth, requireSubscription, async (req, res) => {
 *   // Only users with active subscriptions can create projects
 * });
 */
export async function requireSubscription(req, res, next) {
  try {
    const userId = req.userId; // Set by requireAuth middleware

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    // Check if user has active subscription
    const subscription = await getUserActiveSubscription(userId);

    if (!subscription) {
      return res.status(403).json({
        error: 'Active subscription required',
        message: 'This feature requires an active subscription. Please subscribe to continue.',
        code: 'SUBSCRIPTION_REQUIRED',
      });
    }

    // Attach subscription to request for route handlers to use
    req.subscription = subscription;

    next();
  } catch (error) {
    logger.error('[Subscription Middleware] Error checking subscription:', error);
    return res.status(500).json({
      error: 'Failed to verify subscription',
      code: 'SUBSCRIPTION_CHECK_FAILED',
    });
  }
}

/**
 * Check if user has subscription and attach to request
 * Does NOT block request - just adds subscription info to req.subscription
 *
 * Usage:
 * router.get('/projects', requireAuth, attachSubscription, async (req, res) => {
 *   const hasSubscription = !!req.subscription;
 *   // Show different UI based on subscription status
 * });
 */
export async function attachSubscription(req, res, next) {
  try {
    const userId = req.userId;

    if (userId) {
      const subscription = await getUserActiveSubscription(userId);
      req.subscription = subscription || null;
    } else {
      req.subscription = null;
    }

    next();
  } catch (error) {
    logger.error('[Subscription Middleware] Error attaching subscription:', error);
    req.subscription = null;
    next(); // Continue anyway - don't block request
  }
}
