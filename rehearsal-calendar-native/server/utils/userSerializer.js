/**
 * User serialization utility
 * Converts database snake_case fields to API camelCase
 */

/**
 * Serialize a user object from database format to API format
 * @param {Object} dbUser - User object from database (snake_case)
 * @returns {Object} Serialized user object (camelCase)
 */
function serializeUser(dbUser) {
  if (!dbUser) return null;

  return {
    id: dbUser.id,
    email: dbUser.email,
    firstName: dbUser.first_name,
    lastName: dbUser.last_name,
    phone: dbUser.phone,
    avatarUrl: dbUser.avatar_url,
    timezone: dbUser.timezone,
    locale: dbUser.locale,
    weekStartDay: dbUser.week_start_day,
    notificationsEnabled: dbUser.notifications_enabled,
    emailNotifications: dbUser.email_notifications,
    onboardingCompleted: dbUser.onboarding_completed,
    createdAt: dbUser.created_at,
  };
}

// What serializeUser reads, plus the version a new session is signed with.
// Read in the transaction that checked the proof, under its lock (R3-06).
const SESSION_USER_COLUMNS = `id, email, first_name, last_name, phone, avatar_url, timezone, locale,
  notifications_enabled, email_notifications, week_start_day, onboarding_completed, created_at, token_version`;

export { serializeUser, SESSION_USER_COLUMNS };
