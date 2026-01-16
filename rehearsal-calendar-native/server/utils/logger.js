/**
 * Simple Logger Utility for Server
 * Respects DEBUG and NODE_ENV environment variables
 */

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const DEBUG_ENABLED = process.env.DEBUG === 'true' || process.env.DEBUG === '1';

/**
 * Logger with automatic production filtering
 */
export const logger = {
  /**
   * Debug logs - only shown when DEBUG=true or in non-production
   */
  debug: (message, ...args) => {
    if (DEBUG_ENABLED || !IS_PRODUCTION) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },

  /**
   * Info logs - only shown in non-production
   */
  info: (message, ...args) => {
    if (!IS_PRODUCTION) {
      console.info(`[INFO] ${message}`, ...args);
    }
  },

  /**
   * Warning logs - always shown
   */
  warn: (message, ...args) => {
    console.warn(`[WARN] ${message}`, ...args);
  },

  /**
   * Error logs - always shown with stack trace
   */
  error: (message, error, ...args) => {
    if (error instanceof Error) {
      console.error(`[ERROR] ${message}`, error.message, ...args);
      if (!IS_PRODUCTION) {
        console.error(error.stack);
      }
    } else {
      console.error(`[ERROR] ${message}`, error, ...args);
    }
  },
};
