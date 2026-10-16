/**
 * One zone in the app: the one the person chose (cause fix 14, the owner's
 * decision of 16.10.2026; HP04, DF01).
 *
 * "If I chose Tel Aviv at registration, everything is in Tel Aviv, even when I
 * have flown somewhere." These tests run in New York (jest.config.js) with
 * Tel Aviv — Asia/Jerusalem — chosen in the profile, the way AuthContext sets
 * it with the user.
 *
 * The app used to date rehearsals in the profile's zone and take "today", the
 * form's clock and the calendar event's zone from the device: a rehearsal over
 * in Tel Aviv counted as upcoming in New York, an edit saved unchanged moved
 * the rehearsal by the difference, and the phone's calendar was told the
 * device's zone.
 */
import * as Calendar from 'expo-calendar';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useNow, useToday } from '../../hooks/useClock';
import { useAddRehearsalForm } from '../../../features/calendar/hooks/useAddRehearsalForm';
import { rehearsalsAPI } from '../../services/api';
import { syncRehearsalToCalendar } from '../../services/calendar/export';
import { checkCalendarPermissions } from '../../services/calendar/permissions';
import {
  dateTimeToISOInTimezone,
  deviceTimezone,
  formatDateToString,
  formatDateToTimeString,
  appTimezone,
  setProfileTimezone,
} from '../time';

jest.mock('../../services/api');
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));
jest.mock('../../../contexts/I18nContext', () => ({
  useI18n: () => ({ language: 'en', setLanguage: jest.fn(), t: jest.requireActual('../../../i18n/translations').en }),
}));
jest.mock('../../services/calendar/permissions', () => ({ checkCalendarPermissions: jest.fn() }));
jest.mock('../calendarMappings', () => ({
  getEventMapping: jest.fn().mockResolvedValue(null),
  saveEventMapping: jest.fn().mockResolvedValue(undefined),
  removeEventMapping: jest.fn().mockResolvedValue(undefined),
}));

const TEL_AVIV = 'Asia/Jerusalem';

let flight: jest.SpyInstance | null = null;

/** The phone lands in `zone`: what Intl reports as the device's zone from now on. */
function fly(zone: string) {
  const resolved = Intl.DateTimeFormat.prototype.resolvedOptions;
  flight = jest.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (this: Intl.DateTimeFormat) {
    const options = resolved.call(this);
    return options.timeZone === 'America/New_York' ? { ...options, timeZone: zone } : options;
  });
}

beforeEach(() => {
  setProfileTimezone(TEL_AVIV);
});

afterEach(() => {
  jest.useRealTimers();
  flight?.mockRestore();
  flight = null;
});

describe('"today"', () => {
  // 22:30 UTC on 16 October: still the 16th in New York, already the 17th in
  // Tel Aviv.
  const evening = new Date('2026-10-16T22:30:00Z');

  it('is the profile\'s, not the device\'s', () => {
    jest.useFakeTimers({ now: evening });
    const { result } = renderHook(() => useToday());

    expect(result.current).toBe('2026-10-17');
  });

  it('follows the zone chosen in the profile at once', () => {
    jest.useFakeTimers({ now: evening });
    const { result } = renderHook(() => useToday());

    act(() => setProfileTimezone('America/Los_Angeles'));

    expect(result.current).toBe('2026-10-16');
  });

  it('reads the hour on the profile\'s clock', () => {
    jest.useFakeTimers({ now: evening });
    const { result } = renderHook(() => useNow());

    expect(formatDateToTimeString(result.current)).toBe('01:30');
  });
});

describe('Editing a rehearsal (DF01)', () => {
  // 18:00 in Tel Aviv on 20 October; 11:00 in New York.
  const rehearsal = { id: 'r1', startsAt: '2026-10-20T15:00:00.000Z', endsAt: '2026-10-20T18:00:00.000Z' };
  // One list for every render, as the context hands it.
  const projects = [{ id: 'p1', name: 'Hamlet', is_admin: true }] as any;
  const route = { projectId: 'p1', rehearsalId: 'r1' };
  const choose = jest.fn();

  const openEdit = async () => {
    (rehearsalsAPI.getById as jest.Mock).mockResolvedValue({ data: { rehearsal } });
    (rehearsalsAPI.getResponses as jest.Mock).mockResolvedValue({ data: { allParticipants: [] } });
    const view = renderHook(() => useAddRehearsalForm({
      projects,
      selectedProject: null,
      setSelectedProject: choose,
      routeParams: route,
    }));
    await waitFor(() => expect(view.result.current.loadingRehearsal).toBe(false));
    await waitFor(() => expect(formatDateToString(view.result.current.date)).toBe('2026-10-20'));
    return view.result;
  };

  it('opens on the rehearsal\'s time in the profile\'s zone', async () => {
    const form = await openEdit();

    expect(formatDateToTimeString(form.current.startTime)).toBe('18:00');
    expect(formatDateToTimeString(form.current.endTime)).toBe('21:00');
  });

  it('saved unchanged, keeps the rehearsal where it was', async () => {
    const form = await openEdit();
    // What useAddRehearsalSubmit sends: the form's fields, in the app's zone.
    const day = formatDateToString(form.current.date);

    expect(dateTimeToISOInTimezone(day, formatDateToTimeString(form.current.startTime), appTimezone()))
      .toBe(rehearsal.startsAt);
    expect(dateTimeToISOInTimezone(day, formatDateToTimeString(form.current.endTime), appTimezone()))
      .toBe(rehearsal.endsAt);
  });
});

describe('The phone\'s calendar', () => {
  // The device's calendar, as far as the export sees it.
  let events: Record<string, any>;
  let made: number;
  const rehearsal = {
    id: '42', projectId: 'p1', projectName: 'Hamlet',
    startsAt: '2026-10-20T15:00:00.000Z', endsAt: '2026-10-20T18:00:00.000Z',
  } as any;

  beforeEach(() => {
    events = {};
    made = 0;
    (checkCalendarPermissions as jest.Mock).mockResolvedValue(true);
    (Calendar.getEventsAsync as jest.Mock).mockImplementation(async () => Object.values(events));
    (Calendar.createEventAsync as jest.Mock).mockImplementation(async (calendarId: string, details: any) => {
      made += 1;
      const id = `event-${made}`;
      events[id] = { ...details, id, calendarId };
      return id;
    });
    (Calendar.getEventAsync as jest.Mock).mockImplementation(async (id: string) => events[id] ?? null);
    (Calendar.updateEventAsync as jest.Mock).mockImplementation(async (id: string, details: any) => {
      events[id] = { ...events[id], ...details };
    });
  });

  it('is told the profile\'s zone, not the device\'s', async () => {
    await syncRehearsalToCalendar(rehearsal, 'cal-1');

    expect(Object.values(events)).toHaveLength(1);
    expect(events['event-1'].timeZone).toBe(TEL_AVIV);
  });

  it('keeps one event when the device has flown elsewhere', async () => {
    await syncRehearsalToCalendar(rehearsal, 'cal-1');

    fly('Asia/Tokyo');
    expect(deviceTimezone()).toBe('Asia/Tokyo');
    await syncRehearsalToCalendar(rehearsal, 'cal-1', { eventId: 'event-1', calendarId: 'cal-1' });

    expect(made).toBe(1);
    expect(Object.values(events)).toHaveLength(1);
    expect(events['event-1'].timeZone).toBe(TEL_AVIV);
  });

  it('moves the same event to a zone the profile changes to', async () => {
    await syncRehearsalToCalendar(rehearsal, 'cal-1');

    setProfileTimezone('Asia/Tokyo');
    await syncRehearsalToCalendar(rehearsal, 'cal-1', { eventId: 'event-1', calendarId: 'cal-1' });

    expect(made).toBe(1);
    expect(Calendar.updateEventAsync).toHaveBeenCalledWith('event-1', expect.objectContaining({ timeZone: 'Asia/Tokyo' }));
    expect(Object.values(events)).toHaveLength(1);
    expect(new Date(events['event-1'].startDate).toISOString()).toBe(rehearsal.startsAt);
  });

  it('finds its own event again by the rehearsal, not the time, with the mapping lost', async () => {
    // Re-exported from scratch after a move: the duplicate search adopts the
    // event that names the rehearsal rather than writing a second one.
    await syncRehearsalToCalendar(rehearsal, 'cal-1');
    fly('Asia/Tokyo');

    await syncRehearsalToCalendar(rehearsal, 'cal-1', null);

    expect(made).toBe(1);
    expect(Object.values(events)).toHaveLength(1);
  });
});
