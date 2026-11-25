/**
 * Asking for a rating (T-410).
 *
 * Only Apple's own request, SKStoreReviewController through expo-store-review:
 * App Review 5.6.1 forbids a window of our own and any "do you like the app?"
 * that sends only the happy ones on to the App Store. iOS decides whether its
 * window is shown at all — three times in 365 days at most, never in
 * TestFlight, every time in a Debug build.
 *
 * When, by the Human Interface Guidelines ("Ratings and reviews"): after
 * something done, in a pause — a rehearsal or one's own busy days saved, the
 * form or the "Mark Busy" screen already closed — never on the first launch,
 * never in the onboarding, and not again soon. All of it at once
 * (`reviewDue`):
 *
 * - the app used on this device on at least three different days;
 * - past the onboarding, and not the first launch;
 * - not asked yet in this version of the app;
 * - fourteen days or more since the last ask.
 *
 * What it counts stays on the phone, in AsyncStorage: a key per day of use
 * (the latest three kept) and the version and time of the last ask. Nothing
 * of it goes to the server.
 *
 * The profile's "Rate Rehearsly" is not this: it opens the App Store's review
 * page whenever it is tapped (`APP_STORE_REVIEW_URL`).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as StoreReview from 'expo-store-review';
import { APP_STORE_URL } from './appUpdate';
import { formatDateToString } from '../utils/time';
import { logger } from '../utils/logger';

/** The App Store's page for writing a review of Rehearsly (the profile's row). */
export const APP_STORE_REVIEW_URL = `${APP_STORE_URL}?action=write-review`;

/**
 * One key per local day the app was opened on, `review-day:2026-11-25`. A key
 * each, not one list, so a write never reads first: e2e/device's stand-in for
 * expo-store-review writes past days under the same prefix when a flow asks.
 */
const DAY_KEY_PREFIX = 'review-day:';
/** `{ version, at }` of the last ask. */
const ASKED_KEY = 'review-asked';

const MIN_DAYS = 3;
const MIN_GAP_MS = 14 * 24 * 60 * 60 * 1000;
/** The form's or the "Mark Busy" screen's way off, before Apple's window comes up. */
const AFTER_CLOSE_MS = 1000;

interface LastAsk {
  version: string;
  at: number;
}

interface ReviewFacts {
  /** Different days the app was used on this device. */
  usageDays: number;
  onboardingCompleted: boolean;
  /** This run of the app is the first on this device (no day of use before it). */
  firstLaunch: boolean;
  /** This build's version, "1.0.1"; unknown asks nothing. */
  version: string | null;
  lastAsk: LastAsk | null;
  now: number;
}

/** Every condition at once; any one of them missing asks nothing. */
function reviewDue(facts: ReviewFacts): boolean {
  if (facts.usageDays < MIN_DAYS) return false;
  if (!facts.onboardingCompleted || facts.firstLaunch) return false;
  if (!facts.version) return false;
  if (facts.lastAsk) {
    if (facts.lastAsk.version === facts.version) return false;
    if (facts.now - facts.lastAsk.at < MIN_GAP_MS) return false;
  }
  return true;
}

// Whether this run is the first, known once the days were first read; until
// then it counts as the first, which asks nothing.
let firstLaunch: boolean | null = null;

async function dayKeys(): Promise<string[]> {
  const keys = await AsyncStorage.getAllKeys();
  return keys.filter((key) => key.startsWith(DAY_KEY_PREFIX)).sort();
}

/**
 * Today, the device's, counted as a day of use: on launch and on every return
 * to the foreground (useUsageDays). The latest three are kept.
 */
export async function noteUsageDay(now: Date = new Date()): Promise<void> {
  try {
    const before = await dayKeys();
    if (firstLaunch === null) firstLaunch = before.length === 0;
    const today = `${DAY_KEY_PREFIX}${formatDateToString(now)}`;
    if (!before.includes(today)) await AsyncStorage.setItem(today, '1');
    const kept = [...new Set([...before, today])].sort();
    const old = kept.slice(0, Math.max(0, kept.length - MIN_DAYS));
    if (old.length > 0) await AsyncStorage.multiRemove(old);
  } catch (error) {
    // Not counted this time: a day too few asks later, never wrongly.
    logger.warn('[review] could not count the day of use', error);
  }
}

async function lastAsk(): Promise<LastAsk | null> {
  const stored = await AsyncStorage.getItem(ASKED_KEY);
  if (!stored) return null;
  const parsed = JSON.parse(stored);
  return typeof parsed?.version === 'string' && typeof parsed?.at === 'number' ? parsed : null;
}

// One ask at a time: two saves in a row would read the same "not asked yet".
let queue: Promise<unknown> = Promise.resolve();

/**
 * Asks iOS for its rating window when everything in `reviewDue` holds, and
 * notes the ask. Apple's window may still not come — iOS keeps its own count —
 * which counts as asked all the same.
 */
function askIfDue(onboardingCompleted: boolean): Promise<void> {
  const ask = queue.then(async () => {
    try {
      const now = Date.now();
      const version = Constants.expoConfig?.version ?? null;
      const due = reviewDue({
        usageDays: (await dayKeys()).length,
        onboardingCompleted,
        firstLaunch: firstLaunch !== false,
        version,
        lastAsk: await lastAsk(),
        now,
      });
      if (!due || !(await StoreReview.isAvailableAsync())) return;
      await AsyncStorage.setItem(ASKED_KEY, JSON.stringify({ version, at: now }));
      await StoreReview.requestReview();
    } catch (error) {
      logger.warn('[review] could not ask for a rating', error);
    }
  });
  queue = ask;
  return ask;
}

/**
 * After a save, once the screen it was made on has gone: the rehearsal form
 * closed after its "OK" (useAddRehearsalSubmit), "Mark Busy" closed by the
 * person after at least one save in that visit (AvailabilityScreen, T-414).
 * Whether to ask is decided then, not now.
 */
export function askForReviewAfterSave(onboardingCompleted: boolean): void {
  setTimeout(() => {
    askIfDue(onboardingCompleted).catch(() => undefined);
  }, AFTER_CLOSE_MS);
}
