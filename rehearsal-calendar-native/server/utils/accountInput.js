/**
 * What the server accepts for an account, whoever sends it.
 *
 * The app checks these fields too, but the API answers anyone: a one-letter
 * password, a timezone that does not exist or a number where a name belongs
 * used to be stored as sent and fail later, somewhere else — an unknown zone
 * is a RangeError in the date helpers and an SQL error at AT TIME ZONE.
 */

export const PASSWORD_MIN_LENGTH = 8;
// bcrypt reads the first 72 bytes and silently ignores the rest, so a longer
// password would be accepted and then half of it would not matter.
export const PASSWORD_MAX_BYTES = 72;
export const LOCALES = Object.freeze(['en', 'ru', 'es', 'de']);
const NAME_MAX = 100;
const PHONE_MAX = 50;
const EMAIL_MAX = 254;
const TIMEZONE_MAX = 64;

export class InputError extends Error {
  constructor(field, code, message) {
    super(message);
    this.name = 'InputError';
    this.field = field;
    this.code = code;
  }
}

/** The response body for an InputError, in the API's error format. */
export function inputErrorBody(error) {
  return { error: error.message, code: error.code, field: error.field };
}

// PostgreSQL text cannot hold U+0000, so a name with one failed in the
// INSERT as a 500 (review R3-03). bcrypt stops reading a password at it, which
// would make "abc\0anything" the same password as "abc".
const hasNul = (value) => value.includes('\u0000');

export function checkPassword(value, field = 'password') {
  if (typeof value !== 'string' || [...value].length < PASSWORD_MIN_LENGTH
      || Buffer.byteLength(value, 'utf8') > PASSWORD_MAX_BYTES || !value.trim() || hasNul(value)) {
    throw new InputError(field, 'PASSWORD_POLICY',
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters and at most ${PASSWORD_MAX_BYTES} bytes`);
  }
  return value;
}

// Addresses are stored trimmed and lower-cased. Every stored address already
// was, with no two differing only by case (OPS-R3-DATA, 25.09), so an exact
// match on the normalized form finds every account.
export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

export function checkEmail(value) {
  const email = normalizeEmail(value);
  if (typeof email !== 'string' || email.length > EMAIL_MAX || hasNul(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new InputError('email', 'EMAIL_INVALID', 'Email address is invalid');
  }
  return email;
}

const NAMED_ZONES = new Set(Intl.supportedValuesOf('timeZone'));

// A named IANA zone, as the JS date helpers and PostgreSQL's AT TIME ZONE both
// read it. Intl also accepts UTC offsets such as "+03:00" or "-0330", which
// PostgreSQL reads with the POSIX sign (west positive) or rejects outright, so
// one stored value put the same instant on different days in JS and in SQL
// (review R3-02). The name is kept as sent: "Europe/Kyiv" stays "Europe/Kyiv".
export function isTimeZone(value) {
  if (typeof value !== 'string' || !value || value.length > TIMEZONE_MAX) return false;
  let resolved;
  try {
    resolved = new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return false;
  }
  return resolved === 'UTC' || resolved.startsWith('Etc/') || NAMED_ZONES.has(resolved);
}

function requiredName(value, field) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > NAME_MAX || hasNul(value)) {
    throw new InputError(field, 'NAME_INVALID', `${field} must be 1 to ${NAME_MAX} characters`);
  }
  return value.trim();
}

// null and '' both clear an optional text field; undefined leaves it alone.
// JSON cannot carry undefined, so an emptied field has to arrive as one of the
// other two — which used to be read as "no change" (HP02).
function optionalText(value, field, max) {
  if (value === null) return null;
  if (typeof value !== 'string' || value.trim().length > max || hasNul(value)) {
    throw new InputError(field, 'TEXT_INVALID', `${field} must be text of at most ${max} characters`);
  }
  return value.trim() || null;
}

function checkTimeZone(value) {
  if (!isTimeZone(value)) throw new InputError('timezone', 'TIMEZONE_INVALID', 'timezone must be an IANA time zone');
  return value;
}

function checkBoolean(field) {
  return (value) => {
    if (typeof value !== 'boolean') throw new InputError(field, 'BOOLEAN_REQUIRED', `${field} must be true or false`);
    return value;
  };
}

function checkLocale(value) {
  if (!LOCALES.includes(value)) throw new InputError('locale', 'LOCALE_INVALID', `locale must be one of ${LOCALES.join(', ')}`);
  return value;
}

/** Registration fields: email, password and first name are required. */
export function registrationInput(body) {
  if (!body || typeof body !== 'object') throw new InputError('body', 'BODY_INVALID', 'Request body is invalid');
  return {
    email: checkEmail(body.email),
    password: checkPassword(body.password),
    firstName: requiredName(body.firstName, 'firstName'),
    lastName: body.lastName === undefined ? null : optionalText(body.lastName, 'lastName', NAME_MAX),
    timezone: body.timezone === undefined || body.timezone === null ? null : checkTimeZone(body.timezone),
    // The language of the confirmation email; stored as the profile locale.
    locale: body.locale === undefined || body.locale === null ? 'en' : checkLocale(body.locale),
  };
}

// Profile fields PUT /auth/me may change, each with its column and rule.
// Password and email are not here: both need more than a column write.
const PROFILE_FIELDS = {
  firstName: ['first_name', (value) => requiredName(value, 'firstName')],
  lastName: ['last_name', (value) => optionalText(value, 'lastName', NAME_MAX)],
  phone: ['phone', (value) => optionalText(value, 'phone', PHONE_MAX)],
  timezone: ['timezone', checkTimeZone],
  locale: ['locale', checkLocale],
  notificationsEnabled: ['notifications_enabled', checkBoolean('notificationsEnabled')],
  emailNotifications: ['email_notifications', checkBoolean('emailNotifications')],
  weekStartDay: ['week_start_day', (value) => {
    if (value !== 'monday' && value !== 'sunday') {
      throw new InputError('weekStartDay', 'WEEK_START_INVALID', 'weekStartDay must be either "monday" or "sunday"');
    }
    return value;
  }],
  onboardingCompleted: ['onboarding_completed', checkBoolean('onboardingCompleted')],
};

/** Column updates for the profile fields present in a PUT /auth/me body. */
export function profileUpdates(body) {
  if (!body || typeof body !== 'object') throw new InputError('body', 'BODY_INVALID', 'Request body is invalid');
  const updates = [];
  for (const [field, [column, check]] of Object.entries(PROFILE_FIELDS)) {
    if (body[field] === undefined) continue;
    updates.push([column, check(body[field])]);
  }
  return updates;
}
