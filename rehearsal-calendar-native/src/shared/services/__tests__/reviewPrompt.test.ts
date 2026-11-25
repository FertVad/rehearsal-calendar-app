/**
 * When the app asks iOS for its rating window (T-410): after a save, when the
 * app was used on three different days on this device, past the onboarding,
 * not on the first launch, not yet in this version, and fourteen days or more
 * after the last ask. Each condition alone asks nothing; all of them, once.
 *
 * Each test is one device: its own storage and a fresh run of the app.
 */
type Device = {
  review: typeof import('../reviewPrompt');
  storage: typeof import('@react-native-async-storage/async-storage').default;
  store: { requestReview: jest.Mock; isAvailableAsync: jest.Mock };
  constants: { expoConfig: { version: string } };
};

const DAY_MS = 24 * 60 * 60 * 1000;
const NOON = new Date(2026, 10, 25, 12, 0, 0).getTime();

function device(): Device {
  let made: Device | undefined;
  jest.isolateModules(() => {
    made = {
      review: require('../reviewPrompt'),
      storage: require('@react-native-async-storage/async-storage').default,
      store: require('expo-store-review'),
      constants: require('expo-constants').default,
    };
  });
  return made!;
}

/** The device's date of an instant, as the app counts the days. */
const localDay = (ms: number) => {
  const at = new Date(ms);
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
};

const flush = async () => {
  for (let i = 0; i < 50; i += 1) await Promise.resolve();
};

/**
 * The app opened on each of these days, `daysAgo` before NOON: the earlier
 * ones by earlier runs, as they left the storage, and the last by this run.
 */
async function usedOn(d: Device, ...daysAgo: number[]) {
  const earlier = daysAgo.slice(0, -1);
  for (const ago of earlier) await d.storage.setItem(`review-day:${localDay(NOON - ago * DAY_MS)}`, '1');
  await d.review.noteUsageDay(new Date(NOON - daysAgo[daysAgo.length - 1] * DAY_MS));
}

/** A save, and the second after it, when the form has gone. */
async function save(d: Device, onboardingCompleted = true) {
  d.review.askForReviewAfterSave(onboardingCompleted);
  jest.advanceTimersByTime(1000);
  await flush();
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOON);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('asking for a rating after a save', () => {
  it('asks once when everything holds', async () => {
    const d = device();
    await usedOn(d, 2, 1, 0);
    await save(d);
    expect(d.store.requestReview).toHaveBeenCalledTimes(1);
  });

  it('waits for the form to go before it asks', async () => {
    const d = device();
    await usedOn(d, 2, 1, 0);
    d.review.askForReviewAfterSave(true);
    await flush();
    expect(d.store.requestReview).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    await flush();
    expect(d.store.requestReview).toHaveBeenCalledTimes(1);
  });

  it('does not ask before the third day of use', async () => {
    const d = device();
    // Two days, the second opened twice.
    await usedOn(d, 1, 0, 0);
    await save(d);
    expect(d.store.requestReview).not.toHaveBeenCalled();
  });

  it('does not ask in the onboarding', async () => {
    const d = device();
    await usedOn(d, 2, 1, 0);
    await save(d, false);
    expect(d.store.requestReview).not.toHaveBeenCalled();
  });

  it('does not ask on the first launch', async () => {
    const d = device();
    // This run found no day of use before it; the earlier days came after.
    await usedOn(d, 0);
    await d.storage.multiSet([
      [`review-day:${localDay(NOON - 2 * DAY_MS)}`, '1'],
      [`review-day:${localDay(NOON - DAY_MS)}`, '1'],
    ]);
    await save(d);
    expect(d.store.requestReview).not.toHaveBeenCalled();
  });

  it('does not ask twice in one version, however long after', async () => {
    const d = device();
    await usedOn(d, 2, 1, 0);
    await save(d);
    await save(d);
    jest.setSystemTime(NOON + 60 * DAY_MS);
    await save(d);
    expect(d.store.requestReview).toHaveBeenCalledTimes(1);
  });

  it('asks in the next version only fourteen days after the last ask', async () => {
    const d = device();
    await usedOn(d, 2, 1, 0);
    await save(d);
    const shipped = d.constants.expoConfig.version;
    try {
      d.constants.expoConfig.version = `${shipped}.next`;
      jest.setSystemTime(NOON + 13 * DAY_MS);
      await save(d);
      expect(d.store.requestReview).toHaveBeenCalledTimes(1);
      jest.setSystemTime(NOON + 14 * DAY_MS);
      await save(d);
      expect(d.store.requestReview).toHaveBeenCalledTimes(2);
    } finally {
      d.constants.expoConfig.version = shipped;
    }
  });

  it('asks once for two saves in a row', async () => {
    const d = device();
    await usedOn(d, 2, 1, 0);
    d.review.askForReviewAfterSave(true);
    d.review.askForReviewAfterSave(true);
    jest.advanceTimersByTime(1000);
    await flush();
    expect(d.store.requestReview).toHaveBeenCalledTimes(1);
  });

  it('keeps only the latest three days, on the phone', async () => {
    const d = device();
    await usedOn(d, 10, 9, 8, 7, 0);
    const keys = (await d.storage.getAllKeys()).filter((key) => key.startsWith('review-day:'));
    expect(keys.sort()).toEqual([
      `review-day:${localDay(NOON - 8 * DAY_MS)}`,
      `review-day:${localDay(NOON - 7 * DAY_MS)}`,
      `review-day:${localDay(NOON)}`,
    ]);
  });
});
