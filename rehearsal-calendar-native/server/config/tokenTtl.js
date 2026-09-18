const secondsPerUnit = Object.freeze({ s: 1, m: 60, h: 3600, d: 86400 });

function durationSeconds(environment, name, fallback) {
  const value = environment[name] === undefined ? fallback : environment[name];
  const match = typeof value === 'string' && /^([1-9]\d*)([smhd])$/.exec(value.trim());
  if (!match) {
    throw new Error(`${name} must be a positive integer followed by s, m, h or d`);
  }
  const seconds = Number(match[1]) * secondsPerUnit[match[2]];
  // Keep the duration exact in both units. This bound also keeps JWT NumericDate
  // addition safe for any clock value within JavaScript's Date range.
  if (!Number.isSafeInteger(seconds) || !Number.isSafeInteger(seconds * 1000)) {
    throw new Error(`${name} exceeds the supported integer duration`);
  }
  return seconds;
}

// Pure configuration: no dotenv, database, files or request-time policy changes.
export function readTokenTtls(environment = process.env) {
  const accessSeconds = durationSeconds(environment, 'JWT_EXPIRES_IN', '30d');
  const refreshSeconds = durationSeconds(environment, 'REFRESH_TOKEN_EXPIRES_IN', '90d');
  // The current client renews only after an access-token 401. Its refresh token
  // must remain valid after the corresponding access token expires.
  if (refreshSeconds <= accessSeconds) {
    throw new Error('REFRESH_TOKEN_EXPIRES_IN must be longer than JWT_EXPIRES_IN');
  }
  return Object.freeze({ accessSeconds, refreshSeconds });
}
