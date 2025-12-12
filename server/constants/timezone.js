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
 * RSVP status values (database)
 * @type {Object<string, string>}
 */
export const RSVP_STATUS_DB = {
  YES: 'yes',
  NO: 'no',
  MAYBE: 'maybe',
  INVITED: 'invited',
};

/**
 * RSVP status values (client API)
 * @type {Object<string, string>}
 */
export const RSVP_STATUS_CLIENT = {
  CONFIRMED: 'confirmed',
  DECLINED: 'declined',
  TENTATIVE: 'tentative',
  INVITED: 'invited',
};

/**
 * Map database RSVP status to client status
 * @param {string} dbStatus - Status from database ('yes', 'no', 'maybe', 'invited')
 * @returns {string} - Client status ('confirmed', 'declined', 'tentative', 'invited')
 */
export function mapDBStatusToClient(dbStatus) {
  const mapping = {
    [RSVP_STATUS_DB.YES]: RSVP_STATUS_CLIENT.CONFIRMED,
    [RSVP_STATUS_DB.NO]: RSVP_STATUS_CLIENT.DECLINED,
    [RSVP_STATUS_DB.MAYBE]: RSVP_STATUS_CLIENT.TENTATIVE,
    [RSVP_STATUS_DB.INVITED]: RSVP_STATUS_CLIENT.INVITED,
  };
  return mapping[dbStatus] || dbStatus;
}

/**
 * Map client RSVP status to database status
 * @param {string} clientStatus - Status from client ('confirmed', 'declined', 'tentative', 'invited')
 * @returns {string} - Database status ('yes', 'no', 'maybe', 'invited')
 */
export function mapClientStatusToDB(clientStatus) {
  const mapping = {
    [RSVP_STATUS_CLIENT.CONFIRMED]: RSVP_STATUS_DB.YES,
    [RSVP_STATUS_CLIENT.DECLINED]: RSVP_STATUS_DB.NO,
    [RSVP_STATUS_CLIENT.TENTATIVE]: RSVP_STATUS_DB.MAYBE,
    [RSVP_STATUS_CLIENT.INVITED]: RSVP_STATUS_DB.INVITED,
  };
  return mapping[clientStatus] || clientStatus;
}

/**
 * Date/time format constants
 * @type {Object<string, string>}
 */
export const DATE_FORMATS = {
  DATE_ONLY: 'YYYY-MM-DD',
  TIME_ONLY: 'HH:mm',
  DATETIME: 'YYYY-MM-DD HH:mm',
  ISO8601: 'YYYY-MM-DDTHH:mm:ss',
};
