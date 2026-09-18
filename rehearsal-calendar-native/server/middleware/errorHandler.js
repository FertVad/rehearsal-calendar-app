import { STATUS_CODES } from 'node:http';
import { logger } from '../utils/logger.js';

// Keep the four-argument signature: Express uses it to identify error handlers.
export function errorHandler(error, _req, res, next) {
  if (res.headersSent) return next(error);

  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599
    ? error.status : 500;
  // Parser errors can contain request bodies; driver errors can contain SQL and
  // credentials. Log bounded diagnostic metadata, never those messages/bodies.
  const code = typeof error?.code === 'string' && /^[A-Z0-9_]{1,40}$/.test(error.code)
    ? error.code : undefined;
  logger.error('Request failed:', { status, ...(code ? { code } : {}) });
  res.status(status).json({
    error: status >= 500 ? 'Internal server error' : (STATUS_CODES[status] || 'Bad Request'),
  });
}
