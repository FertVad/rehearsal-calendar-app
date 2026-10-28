import { asyncHandler } from './asyncHandler.js';
import { consumeOperationIpBudget, getOperationIpPolicy } from '../services/operationIpRateLimit.js';

const admissionDeadlineMs = 3000;

export function limitOperationIp(operation) {
  const policy = getOperationIpPolicy(operation);
  return asyncHandler(async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    let timer;
    let budget;
    try {
      // Promise.race installs rejection observers on both branches. A late
      // result/rejection cannot reach next(), and is never retried/refunded.
      // The underlying pool wait/SQL may still finish and conservatively spend
      // budget after HTTP503; the adapter does not expose cancellation.
      budget = await Promise.race([
        Promise.resolve().then(() => consumeOperationIpBudget(operation, req.ip)),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Operation IP admission deadline exceeded')), admissionDeadlineMs);
        }),
      ]);
    } catch {
      if (res.destroyed || res.writableEnded || res.headersSent) return;
      return res.status(503).json({ error: 'Authentication is temporarily unavailable' });
    } finally {
      clearTimeout(timer);
    }
    if (res.destroyed || res.writableEnded || res.headersSent) return;
    res.set({
      'RateLimit-Policy': `${policy.limit};w=${policy.windowSeconds}`,
      'RateLimit-Limit': String(policy.limit),
      'RateLimit-Remaining': String(budget.remaining),
      'RateLimit-Reset': String(budget.retryAfter),
    });
    if (!budget.allowed) {
      res.set('Retry-After', String(budget.retryAfter));
      return res.status(429).json({ error: policy.message });
    }
    next();
  });
}
