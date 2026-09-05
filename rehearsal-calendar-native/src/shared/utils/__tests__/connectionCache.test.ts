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
import { getOrCreateConnection, resetConnectionCache } from '../calendarMappings';
import { calendarSyncAPI } from '../../services/api';

jest.mock('../../services/api', () => ({
  calendarSyncAPI: {
    getConnections: jest.fn(),
    createOrUpdateConnection: jest.fn(),
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
