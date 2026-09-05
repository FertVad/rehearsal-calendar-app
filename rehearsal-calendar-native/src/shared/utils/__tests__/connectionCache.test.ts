/**
 * The cached calendar connection, and whose it is.
 *
 * The cache remembers which connection belongs to which device calendar, and
 * nothing about which account. So when a second person signs in on the same
 * phone without the app being killed and picks the same calendar, they get the
 * first person's connection id. The server checks ownership and rejects every
 * mapping posted with it — silently, because saveEventMapping swallows
 * failures. Their exported rehearsals end up recorded nowhere: invisible on a
 * second device, duplicated after a reinstall, and re-imported as somebody
 * else's busy time.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOrCreateConnection, resetConnectionCache, getAllMappings } from '../calendarMappings';
import { calendarSyncAPI } from '../../services/api';

jest.mock('../../services/api', () => ({
  calendarSyncAPI: {
    getConnections: jest.fn(),
    createOrUpdateConnection: jest.fn(),
    getMappings: jest.fn(),
  },
}));

const connectionFor = (id: number) => ({
  data: { connections: [{ id, device_calendar_id: 'personal' }] },
});

beforeEach(() => {
  jest.clearAllMocks();
  resetConnectionCache();
});

describe('Asking for the connection', () => {
  it('asks the server the first time', async () => {
    (calendarSyncAPI.getConnections as jest.Mock).mockResolvedValue(connectionFor(42));

    expect(await getOrCreateConnection('personal')).toBe(42);
    expect(calendarSyncAPI.getConnections).toHaveBeenCalledTimes(1);
  });

  it('does not ask again for the same calendar', async () => {
    // The reason the cache exists: every mapping saved would otherwise cost a
    // request for the same answer.
    (calendarSyncAPI.getConnections as jest.Mock).mockResolvedValue(connectionFor(42));

    await getOrCreateConnection('personal');
    await getOrCreateConnection('personal');

    expect(calendarSyncAPI.getConnections).toHaveBeenCalledTimes(1);
  });

  it('asks again for a different calendar', async () => {
    (calendarSyncAPI.getConnections as jest.Mock).mockResolvedValue(connectionFor(42));

    await getOrCreateConnection('personal');
    await getOrCreateConnection('work');

    expect(calendarSyncAPI.getConnections).toHaveBeenCalledTimes(2);
  });
});

describe('When the device changes hands', () => {
  it('forgets the connection, so the next person gets their own', async () => {
    (calendarSyncAPI.getConnections as jest.Mock).mockResolvedValue(connectionFor(42));
    expect(await getOrCreateConnection('personal')).toBe(42);

    // Somebody else signs in. AuthContext calls this when the owner changes.
    resetConnectionCache();
    (calendarSyncAPI.getConnections as jest.Mock).mockResolvedValue(connectionFor(77));

    expect(await getOrCreateConnection('personal')).toBe(77);
  });

  it('would otherwise hand out the previous account\'s id', async () => {
    // Without the reset — the shape of the defect, kept so the reason for the
    // call is visible from here.
    (calendarSyncAPI.getConnections as jest.Mock).mockResolvedValue(connectionFor(42));
    await getOrCreateConnection('personal');

    (calendarSyncAPI.getConnections as jest.Mock).mockResolvedValue(connectionFor(77));

    expect(await getOrCreateConnection('personal')).toBe(42);
  });
});

describe('Asking for all the mappings', () => {
  // The import uses this list to leave our own exported rehearsals alone.
  // Handed an empty one it takes every rehearsal it put in the calendar and
  // stores it back as busy time — for a rehearsal the person is already on,
  // counted twice, and with nothing able to tell the two apart afterwards.
  //
  // So "nothing exported" and "I could not find out" must not look the same.
  const mappingRow = {
    internal_event_id: '42',
    external_event_id: 'evt-42',
    device_calendar_id: 'personal',
    last_sync_at: '2026-09-05',
  };

  beforeEach(async () => {
    await AsyncStorage.removeItem('calendar-export-mappings');
  });

  it('answers from the server when it can', async () => {
    (calendarSyncAPI.getMappings as jest.Mock).mockResolvedValue({ data: { mappings: [mappingRow] } });

    const all = await getAllMappings();

    expect(all['42'].eventId).toBe('evt-42');
  });

  it('answers an empty list when the server says there is nothing', async () => {
    // A new account really has none. That is an answer, not a failure.
    (calendarSyncAPI.getMappings as jest.Mock).mockResolvedValue({ data: { mappings: [] } });

    await expect(getAllMappings()).resolves.toEqual({});
  });

  it('falls back to what is cached when the server cannot be reached', async () => {
    await AsyncStorage.setItem(
      'calendar-export-mappings',
      JSON.stringify({ '42': { eventId: 'evt-42', calendarId: 'personal', lastSynced: '' } })
    );
    (calendarSyncAPI.getMappings as jest.Mock).mockRejectedValue(new Error('offline'));

    const all = await getAllMappings();

    expect(all['42'].eventId).toBe('evt-42');
  });

  it('refuses to answer when neither can tell it anything', async () => {
    // A fresh install, or straight after a user switch, when the cache is empty
    // by design. One failed request is all it takes.
    (calendarSyncAPI.getMappings as jest.Mock).mockRejectedValue(new Error('offline'));

    await expect(getAllMappings()).rejects.toThrow(/unavailable/i);
  });
});
