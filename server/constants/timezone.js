/**
 * Timezone and availability constants
 */

/**
 * Default timezone for the application
 * @type {string}
 */
export const DEFAULT_TIMEZONE = 'Asia/Jerusalem';

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

/**
 * RSVP status values (like system - Telegram-style)
 * Only 'yes' (like) or null (no like)
 * @type {Object<string, string>}
 */
export const RSVP_STATUS = {
  YES: 'yes', // User liked/confirmed
  // NO, MAYBE, TENTATIVE removed - not used in like system
};
