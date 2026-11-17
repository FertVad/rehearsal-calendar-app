/**
 * The phone calendar's event speaks the app's language (T-276).
 *
 * A rehearsal without a name of its own went into the calendar as
 * "Rehearsal: <project>", with "Project: …\n\nCreated via Rehearsly" in the
 * notes, whatever language the person had chosen in Rehearsly — the App Store
 * page promises four. Now the title and the notes come from the dictionaries,
 * in the language chosen in the app now (not the phone's), and the event is
 * found again by its mark, so a change of language rewrites the same event.
 * Events from before the mark are still known by their English signature.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Calendar from 'expo-calendar';
import { createCalendarEvent, syncRehearsalToCalendar } from '../export';
import { checkCalendarPermissions } from '../permissions';
import { translations } from '../../../../i18n/translations';

jest.mock('../permissions', () => ({ checkCalendarPermissions: jest.fn() }));
jest.mock('../../../utils/calendarMappings', () => ({
  saveEventMapping: jest.fn().mockResolvedValue(undefined),
  getEventMapping: jest.fn().mockResolvedValue(null),
  removeEventMapping: jest.fn().mockResolvedValue(undefined),
}));

const rehearsal = (over: Record<string, unknown> = {}) => ({
  id: '42',
  projectId: 'p1',
  projectName: 'Гамлет',
  startsAt: '2026-10-01T17:00:00.000Z',
  endsAt: '2026-10-01T19:00:00.000Z',
  location: null,
  ...over,
}) as any;

/** What each language writes for an unnamed rehearsal of «Гамлет». */
const EXPECTED = {
  en: { title: 'Rehearsal: Гамлет', notes: 'Project: Гамлет\n\nCreated via Rehearsly' },
  ru: { title: 'Репетиция: Гамлет', notes: 'Проект: Гамлет\n\nСоздано в Rehearsly' },
  es: { title: 'Ensayo: Гамлет', notes: 'Proyecto: Гамлет\n\nCreado con Rehearsly' },
  de: { title: 'Probe: Гамлет', notes: 'Projekt: Гамлет\n\nErstellt mit Rehearsly' },
} as const;

/** The language chosen in Rehearsly, where the app keeps it. */
const chooseLanguage = (language: string) => AsyncStorage.setItem('userLanguage', language);

/** An event the export wrote in English, carrying the mark. */
const writtenInEnglish = (over: Record<string, unknown> = {}) => ({
  id: 'event-1',
  title: EXPECTED.en.title,
  notes: EXPECTED.en.notes,
  url: 'rehearsalapp://rehearsal/42',
  startDate: '2026-10-01T17:00:00.000Z',
  endDate: '2026-10-01T19:00:00.000Z',
  location: null,
  ...over,
});

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  (checkCalendarPermissions as jest.Mock).mockResolvedValue(true);
  (Calendar.getEventsAsync as jest.Mock).mockResolvedValue([]);
  (Calendar.getEventAsync as jest.Mock).mockResolvedValue(null);
  (Calendar.createEventAsync as jest.Mock).mockResolvedValue('new-event');
  (Calendar.updateEventAsync as jest.Mock).mockResolvedValue(undefined);
});

describe('A new event', () => {
  it.each(Object.keys(EXPECTED) as (keyof typeof EXPECTED)[])(
    'is titled and noted in %s when that is the app\'s language',
    async (language) => {
      await chooseLanguage(language);

      await createCalendarEvent(rehearsal(), 'cal-1');

      const [, details] = (Calendar.createEventAsync as jest.Mock).mock.calls[0];
      expect(details.title).toBe(EXPECTED[language].title);
      expect(details.notes).toBe(EXPECTED[language].notes);
      // The word for a rehearsal is the one the app's own screens use.
      expect(details.title.startsWith(`${translations[language].calendar.rehearsal}: `)).toBe(true);
    }
  );

  it('is in English when no language has been chosen yet', async () => {
    await createCalendarEvent(rehearsal(), 'cal-1');

    const [, details] = (Calendar.createEventAsync as jest.Mock).mock.calls[0];
    expect(details.title).toBe(EXPECTED.en.title);
  });

  it('keeps the name the organiser gave the rehearsal, untranslated', async () => {
    await chooseLanguage('de');

    await createCalendarEvent(rehearsal({ title: 'Durchlauf 2. Akt' }), 'cal-1');

    const [, details] = (Calendar.createEventAsync as jest.Mock).mock.calls[0];
    expect(details.title).toBe('Durchlauf 2. Akt');
    expect(details.notes).toBe(EXPECTED.de.notes);
  });
});

describe('An event from before the mark, in English', () => {
  const legacy = {
    id: 'legacy-event',
    title: EXPECTED.en.title,
    notes: EXPECTED.en.notes,
    startDate: '2026-10-01T17:00:00.000Z',
    endDate: '2026-10-01T19:00:00.000Z',
    location: null,
  };

  it.each(['ru', 'es', 'de'])('is still ours with the app in %s, and is rewritten, not doubled', async (language) => {
    await chooseLanguage(language);
    (Calendar.getEventsAsync as jest.Mock).mockResolvedValue([legacy]);

    const id = await createCalendarEvent(rehearsal(), 'cal-1');

    expect(id).toBe('legacy-event');
    expect(Calendar.createEventAsync).not.toHaveBeenCalled();
    expect(Calendar.updateEventAsync).toHaveBeenCalledWith(
      'legacy-event',
      expect.objectContaining({
        title: EXPECTED[language as keyof typeof EXPECTED].title,
        notes: EXPECTED[language as keyof typeof EXPECTED].notes,
        url: 'rehearsalapp://rehearsal/42',
      })
    );
  });
});

describe('A change of language in the app', () => {
  it('rewrites the event already exported, in place, at the next sync', async () => {
    await chooseLanguage('ru');
    (Calendar.getEventAsync as jest.Mock).mockResolvedValue(writtenInEnglish());

    await syncRehearsalToCalendar(rehearsal(), 'cal-1', { eventId: 'event-1', calendarId: 'cal-1' });

    expect(Calendar.createEventAsync).not.toHaveBeenCalled();
    expect(Calendar.updateEventAsync).toHaveBeenCalledTimes(1);
    expect(Calendar.updateEventAsync).toHaveBeenCalledWith(
      'event-1',
      expect.objectContaining({ title: EXPECTED.ru.title, notes: EXPECTED.ru.notes })
    );
  });

  it('rewrites the notes of a named rehearsal too, whose title stays', async () => {
    await chooseLanguage('es');
    (Calendar.getEventAsync as jest.Mock).mockResolvedValue(writtenInEnglish({ title: 'Ensayo general' }));

    await syncRehearsalToCalendar(rehearsal({ title: 'Ensayo general' }), 'cal-1', {
      eventId: 'event-1',
      calendarId: 'cal-1',
    });

    expect(Calendar.createEventAsync).not.toHaveBeenCalled();
    expect(Calendar.updateEventAsync).toHaveBeenCalledWith(
      'event-1',
      expect.objectContaining({ title: 'Ensayo general', notes: EXPECTED.es.notes })
    );
  });

  it('rewrites the event another device wrote, found by its mark', async () => {
    await chooseLanguage('de');
    (Calendar.getEventsAsync as jest.Mock).mockResolvedValue([writtenInEnglish({ id: 'from-icloud' })]);

    const id = await createCalendarEvent(rehearsal(), 'cal-1');

    expect(id).toBe('from-icloud');
    expect(Calendar.createEventAsync).not.toHaveBeenCalled();
    expect(Calendar.updateEventAsync).toHaveBeenCalledWith(
      'from-icloud',
      expect.objectContaining({ title: EXPECTED.de.title, notes: EXPECTED.de.notes })
    );
  });

  it('leaves alone an event already in the app\'s language', async () => {
    await chooseLanguage('ru');
    (Calendar.getEventAsync as jest.Mock).mockResolvedValue(
      writtenInEnglish({ title: EXPECTED.ru.title, notes: EXPECTED.ru.notes })
    );

    await syncRehearsalToCalendar(rehearsal(), 'cal-1', { eventId: 'event-1', calendarId: 'cal-1' });

    expect(Calendar.updateEventAsync).not.toHaveBeenCalled();
    expect(Calendar.createEventAsync).not.toHaveBeenCalled();
  });
});
