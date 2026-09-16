/**
 * Saving many records at once without losing all but one.
 *
 * Each of these keys holds a map, and every writer read it, changed one entry
 * and wrote the whole thing back. Fine one at a time — but the import saves
 * fifty in parallel and the export ten, all reading the same starting state and
 * each writing its own version over the last. Roughly one survived.
 *
 * The damage is quiet: the local record of what had been imported was mostly
 * fiction, and that record is what the sync screen counts and what the import
 * consults before deciding an event is new.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveImportedEvent, saveEventMapping, removeImportedEvent } from '../calendarStorage';

beforeEach(async () => {
  await AsyncStorage.removeItem('calendar-import-tracking');
  await AsyncStorage.removeItem('calendar-export-mappings');
});

const tracking = async () =>
  JSON.parse((await AsyncStorage.getItem('calendar-import-tracking')) || '{}');

const mappings = async () =>
  JSON.parse((await AsyncStorage.getItem('calendar-export-mappings')) || '{}');

describe('Fifty imports saved at once', () => {
  it('keeps every one of them', async () => {
    await Promise.all(
      Array.from({ length: 50 }, (_, i) => saveImportedEvent(`evt-${i}`, `slot-${i}`, 'cal-1'))
    );

    expect(Object.keys(await tracking())).toHaveLength(50);
  });

  it('keeps what each of them said', async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => saveImportedEvent(`evt-${i}`, `slot-${i}`, 'cal-1'))
    );

    const stored = await tracking();
    expect(stored['evt-0'].availabilitySlotId).toBe('slot-0');
    expect(stored['evt-19'].availabilitySlotId).toBe('slot-19');
  });
});

describe('Ten exports saved at once', () => {
  it('keeps every one of them', async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_, i) => saveEventMapping(`${i}`, `evt-${i}`, 'cal-1'))
    );

    expect(Object.keys(await mappings())).toHaveLength(10);
  });
});

describe('Removing while others are being written', () => {
  it('takes out the one asked for and leaves the rest', async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_, i) => saveImportedEvent(`evt-${i}`, `slot-${i}`, 'cal-1'))
    );

    await Promise.all([
      removeImportedEvent('evt-3'),
      saveImportedEvent('evt-99', 'slot-99', 'cal-1'),
    ]);

    const stored = await tracking();
    expect(stored['evt-3']).toBeUndefined();
    expect(stored['evt-99']).toBeDefined();
    expect(Object.keys(stored)).toHaveLength(10);
  });
});
