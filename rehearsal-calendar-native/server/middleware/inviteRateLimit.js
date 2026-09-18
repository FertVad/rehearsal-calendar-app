import { asyncHandler } from './asyncHandler.js';
import { consumeInviteIpBudget, consumeInviteAccountBudget } from '../services/inviteRateLimit.js';

function limitBy(consume, identity) {
  return asyncHandler(async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    let budget;
    try {
      budget = await consume(identity(req));
    } catch {
      return res.status(503).json({ error: 'Invitations are temporarily unavailable' });
    }
    // Preserve the public rate-limit response contract. For join, expose the
    // more restrictive of the IP and account allowances already consumed.
    const remaining = Math.min(res.locals.inviteRemaining ?? 20, budget.remaining);
    res.locals.inviteRemaining = remaining;
    res.set({
      'RateLimit-Policy': '20;w=60',
      'RateLimit-Limit': '20',
      'RateLimit-Remaining': String(remaining),
      'RateLimit-Reset': String(budget.retryAfter),
    });
    if (!budget.allowed) {
      res.set('Retry-After', String(budget.retryAfter));
      return res.status(429).json({ error: 'Too many requests, please try again later' });
    }
    next();
  });
}

// Identities exclude route, project, invite code and any unverified account
// parameter. req.ip uses the application's explicitly configured proxy policy;
// req.userId is set only by requireAuth, which must precede the account guard.
export const limitInviteIp = limitBy(consumeInviteIpBudget, req => req.ip);
export const limitInviteAccount = limitBy(consumeInviteAccountBudget, req => req.userId);
