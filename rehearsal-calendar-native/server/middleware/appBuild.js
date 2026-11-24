/**
 * The oldest app build the API still answers (T-265).
 *
 * Every request of the app names its build in `X-App-Build` (api.ts). When
 * `MIN_IOS_BUILD` is a whole number above 0, a request of an older build — or
 * of none: TestFlight builds 1–5 send no header — is refused with 426
 * `UPDATE_REQUIRED` before anything else is done, and the app shows its "update
 * the app" screen instead of the navigator. Unset or 0, nobody is refused.
 *
 * The minimum is read on every request, not once at start: a deployment has
 * one value for its life anyway, and the e2e server raises it for one flow
 * (e2e/server-with-mailbox.mjs, flow 97).
 *
 * Raise it only once the build it names is in the App Store (CLAUDE.md,
 * "Forcing an update").
 */
import { logger } from '../utils/logger.js';

const WHOLE_NUMBER = /^\d+$/;

let reportedValue = null;

/**
 * MIN_IOS_BUILD as a number; 0 when unset. A value that is not a whole number
 * refuses nobody and is logged once: a typo must not lock every phone out of
 * the API, and it must not pass unseen either.
 */
export function minimumIosBuild(value = process.env.MIN_IOS_BUILD) {
  const text = String(value ?? '').trim();
  if (!text) return 0;
  if (WHOLE_NUMBER.test(text)) return Number(text);
  if (reportedValue !== text) {
    reportedValue = text;
    logger.error(`MIN_IOS_BUILD is not a whole number (${JSON.stringify(text)}): no app build is refused`);
  }
  return 0;
}

/**
 * The build a request names in `X-App-Build`; null when it names none or
 * something that is not a whole number. One reading for the refusal below and
 * for the build the session check records with the day (T-294).
 */
export function appBuildOf(req) {
  const text = String(req.get('X-App-Build') ?? '').trim();
  return WHOLE_NUMBER.test(text) ? Number(text) : null;
}

/** Mounted on /api/native and /api/auth before the database is woken (app.js). */
export function requireAppBuild(req, res, next) {
  const minimum = minimumIosBuild();
  // A request that names no build is build 0: TestFlight 1–5 send none.
  if (minimum > 0 && (appBuildOf(req) ?? 0) < minimum) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(426).json({ error: 'Update required', code: 'UPDATE_REQUIRED' });
  }
  return next();
}

/**
 * GET /api/native/app-version: asked by the app on launch and on every return
 * to the foreground, signed in or not, so it learns of the minimum before
 * anything else. Reached only past requireAppBuild, so its 200 says this build
 * is still answered.
 */
export function appVersion(_req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ minIosBuild: minimumIosBuild() });
}
