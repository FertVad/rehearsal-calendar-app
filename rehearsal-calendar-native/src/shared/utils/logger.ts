/**
 * Simple Logger Utility
 * Automatically disables debug logs in production
 */

const IS_DEV = process.env.NODE_ENV !== 'production';

/**
 * Logger with automatic production filtering
 */
export const logger = {
  /**
   * Debug logs - only shown in development
   */
  debug: (message: string, ...args: any[]) => {
    if (IS_DEV) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },

  /**
   * Info logs - only shown in development
   */
  info: (message: string, ...args: any[]) => {
    if (IS_DEV) {
      console.info(`[INFO] ${message}`, ...args);
    }
  },

  /**
   * Warning logs - always shown
   */
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },

  /**
   * Error logs - always shown
   */
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  },
};
