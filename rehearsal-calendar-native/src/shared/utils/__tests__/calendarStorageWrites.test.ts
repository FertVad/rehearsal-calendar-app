/**
 * Saving many records at once without losing all but one.
 *
 * Each of these keys holds a map, and every writer read it, changed one entry
 * and wrote the whole thing back. Fine one at a time — but the export saves ten
 * in parallel, all reading the same starting state and each writing its own
 * version over the last. Roughly one survived.
 *
 * The per-event import record that used to be written here the same way is
 * gone: the server reconciles imports and reports the count (R7).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveEventMapping,
  removeEventMapping,
  setImportedEventsCount,
  getImportedEventsCount,
  clearAllImportedEvents,
} from '../calendarStorage';

beforeEach(async () => {
  await AsyncStorage.multiRemove(['calendar-export-mappings', 'calendar-import-count', 'calendar-import-tracking']);
});

const mappings = async () =>
  JSON.parse((await AsyncStorage.getItem('calendar-export-mappings')) || '{}');

describe('Fifty exports saved at once', () => {
  it('keeps every one of them', async () => {
    await Promise.all(
      Array.from({ length: 50 }, (_, i) => saveEventMapping(`${i}`, `evt-${i}`, 'cal-1'))
    );

    expect(Object.keys(await mappings())).toHaveLength(50);
  });

  it('keeps what each of them said', async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => saveEventMapping(`${i}`, `evt-${i}`, 'cal-1'))
    );

    const stored = await mappings();
    expect(stored['0'].eventId).toBe('evt-0');
    expect(stored['19'].eventId).toBe('evt-19');
  });
});

describe('Removing while others are being written', () => {
  it('takes out the one asked for and leaves the rest', async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_, i) => saveEventMapping(`${i}`, `evt-${i}`, 'cal-1'))
    );

    await Promise.all([
      removeEventMapping('3'),
      saveEventMapping('99', 'evt-99', 'cal-1'),
    ]);

    const stored = await mappings();
    expect(stored['3']).toBeUndefined();
    expect(stored['99']).toBeDefined();
    expect(Object.keys(stored)).toHaveLength(10);
  });
});

describe('The imported count the sync screen shows', () => {
  it('is what the server reported on the last sync', async () => {
    await setImportedEventsCount(12);

    expect(await getImportedEventsCount()).toBe(12);
  });

  it('before this device\'s first such sync, is the size of the old per-event record', async () => {
    await AsyncStorage.setItem('calendar-import-tracking', JSON.stringify({ a: {}, b: {}, c: {} }));

    expect(await getImportedEventsCount()).toBe(3);
  });

  it('is forgotten with the old record when everything imported is removed', async () => {
    await setImportedEventsCount(12);
    await AsyncStorage.setItem('calendar-import-tracking', JSON.stringify({ a: {} }));

    await clearAllImportedEvents();

    expect(await getImportedEventsCount()).toBe(0);
  });

  it('that cannot be read is an error, not none', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(getImportedEventsCount()).rejects.toThrow('storage unavailable');
  });
});
