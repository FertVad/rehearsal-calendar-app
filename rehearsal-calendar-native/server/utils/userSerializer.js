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
    createdAt: dbUser.created_at,
  };
}

export { serializeUser };
