/**
 * The words a reminder uses for when the rehearsal starts (R8: GR04).
 *
 * They used to be fixed — "Rehearsal tomorrow", "Rehearsal in 1 hour" — while
 * the windows they go out in are deliberately wide, so a day-before reminder
 * thirteen hours ahead called this evening "tomorrow", and a late hour-before
 * one ten minutes ahead still said "in 1 hour". The words now come from the
 * start, in the reader's zone and language.
 */
import { reminderWhen } from '../../services/notifications/reminderText.js';
import { t } from '../../i18n/pushNotifications.js';

// Intl separates "7:00" from "PM" with a narrow no-break space.
const plain = (text) => text.replace(/\s/g, ' ');
const when = (...args) => plain(reminderWhen(...args));

describe('Today and tomorrow are the reader\'s, not the server\'s', () => {
  it('thirteen hours ahead, the same evening is "today", not "tomorrow" (GR04)', () => {
    // 09:00 in Jerusalem; the rehearsal is at 22:00 the same day.
    expect(when('ru', '2026-10-05T19:00:00Z', new Date('2026-10-05T06:00:00Z'), 'Asia/Jerusalem')).toBe('сегодня в 22:00');
  });

  it('the next morning is "tomorrow"', () => {
    expect(when('ru', '2026-10-06T07:00:00Z', new Date('2026-10-05T06:00:00Z'), 'Asia/Jerusalem')).toBe('завтра в 10:00');
  });

  it('behind UTC: late evening in New York, tomorrow there is the same UTC date', () => {
    // 22:00 on 5 October in New York is 02:00 on the 6th in UTC.
    expect(when('en', '2026-10-06T14:00:00Z', new Date('2026-10-06T02:00:00Z'), 'America/New_York')).toBe('tomorrow at 10:00 AM');
  });

  it('ahead of UTC: after midnight in Tokyo, today there is the next UTC date', () => {
    expect(when('en', '2026-10-06T10:00:00Z', new Date('2026-10-05T16:00:00Z'), 'Asia/Tokyo')).toBe('today at 7:00 PM');
  });

  it('further out, the date', () => {
    expect(when('de', '2026-10-07T17:00:00Z', new Date('2026-10-05T06:00:00Z'), 'Europe/Berlin')).toBe('am Mi., 7. Okt. um 19:00');
  });

  it('in Spanish too', () => {
    expect(when('es', '2026-10-06T08:00:00Z', new Date('2026-10-05T06:00:00Z'), 'Europe/Madrid')).toBe('mañana a las 10:00');
  });
});

describe('A time that is not the reader\'s local time says so', () => {
  it('a reader whose zone was never synced reads UTC, marked', () => {
    expect(when('en', '2026-10-05T19:00:00Z', new Date('2026-10-05T06:00:00Z'), 'UTC')).toBe('today at 7:00 PM UTC');
  });

  it('a stored zone that is not one reads as UTC, marked', () => {
    expect(when('ru', '2026-10-05T19:00:00Z', new Date('2026-10-05T06:00:00Z'), 'Mars/Olympus')).toBe('сегодня в 19:00 UTC');
  });

  it('an unknown language reads English', () => {
    expect(when('fr', '2026-10-05T19:00:00Z', new Date('2026-10-05T06:00:00Z'), 'UTC')).toBe('today at 7:00 PM UTC');
  });
});

describe('The titles', () => {
  it('the hour-before reminder caught ten minutes ahead says when, not "in 1 hour" (GR04)', () => {
    const phrase = reminderWhen('ru', '2026-10-05T19:00:00Z', new Date('2026-10-05T18:50:00Z'), 'Asia/Jerusalem');

    expect(plain(t('ru', 'rehearsal1h').title({ when: phrase }))).toBe('Скоро репетиция: сегодня в 22:00');
  });

  it.each(['ru', 'en', 'es', 'de'])('every language words both reminders from the time (%s)', (locale) => {
    const phrase = reminderWhen(locale, '2026-10-06T07:00:00Z', new Date('2026-10-05T06:00:00Z'), 'Asia/Jerusalem');

    for (const key of ['rehearsal24h', 'rehearsal1h']) {
      const title = t(locale, key).title({ when: phrase });
      expect(title).toContain(phrase);
      expect(title).toMatch(/10[.:]00/);
    }
  });
});
