/**
 * Timezone and availability constants
 */

/**
 * Default timezone fallback — matches DB schema default
 * @type {string}
 */
export const DEFAULT_TIMEZONE = 'UTC';

/**
 * Availability slot types
 * @type {Object<string, string>}
 */
export const AVAILABILITY_TYPES = {
  FREE: 'free',
  BUSY: 'busy',
  TENTATIVE: 'tentative',
};

/**
 * Sources for availability slots
 * @type {Object<string, string>}
 */
export const AVAILABILITY_SOURCES = {
  MANUAL: 'manual',
  REHEARSAL: 'rehearsal',
  GOOGLE: 'google_calendar',
  APPLE: 'apple_calendar',
};
