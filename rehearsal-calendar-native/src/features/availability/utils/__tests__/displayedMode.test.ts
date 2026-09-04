/**
 * The mode the screen shows, which is not always the one that was tapped.
 *
 * Found by hand on a device, after the first attempt at this only half worked:
 * the rule was applied when availability was loaded from the server, so the
 * screen told the truth until the first tap and then stopped. Tapping "free"
 * writes the declaration straight into state, and nothing recomputed it — so a
 * day with an Apple Calendar event on it went back to reading "free all day",
 * which is the exact lie this was meant to end.
 *
 * Hence derived, not stored. `mode` stays the declaration and is what a save
 * writes; this decides only what is drawn.
 */
import { displayedMode, getDayStatus } from '../calendarUtils';

const event = [{ start: '19:00', end: '20:00', source: 'apple_calendar' }];

describe('displayedMode', () => {
  it('leaves a plain free day free', () => {
    expect(displayedMode({ mode: 'free', importedSlots: [] })).toBe('free');
    expect(displayedMode({ mode: 'free' })).toBe('free');
  });

  it('will not call a day free while the phone calendar has an event on it', () => {
    expect(displayedMode({ mode: 'free', importedSlots: event })).toBe('custom');
  });

  it('leaves a day declared busy declared busy', () => {
    // Busy all day already covers the event; nothing is being hidden.
    expect(displayedMode({ mode: 'busy', importedSlots: event })).toBe('busy');
  });

  it('leaves custom hours alone', () => {
    expect(displayedMode({ mode: 'custom', importedSlots: event })).toBe('custom');
  });

  it('says nothing about a day it was given nothing for', () => {
    expect(displayedMode(undefined)).toBeUndefined();
  });

  // A day in the middle of a multi-day calendar event arrives as 00:00–23:59.
  // Drawn as custom hours it read "partly busy, midnight to midnight" — true
  // and useless. Nothing is free, so the day is busy.
  const wholeDay = [{ start: '00:00', end: '23:59', source: 'apple_calendar' }];
  const wholeDayFlagged = [{ start: '00:00', end: '23:59', isAllDay: true }];

  it('calls a day busy when a calendar event takes all of it', () => {
    expect(displayedMode({ mode: 'custom', importedSlots: wholeDay })).toBe('busy');
    expect(displayedMode({ mode: 'custom', importedSlots: wholeDayFlagged })).toBe('busy');
  });

  it('calls it busy even where the user declared themselves free', () => {
    expect(displayedMode({ mode: 'free', importedSlots: wholeDay })).toBe('busy');
  });

  it('still says partial when the event leaves part of the day open', () => {
    expect(displayedMode({ mode: 'custom', importedSlots: event })).toBe('custom');
    expect(
      displayedMode({ mode: 'custom', importedSlots: [{ start: '00:00', end: '18:00' }] })
    ).toBe('custom');
  });
});

describe('the dot on the calendar grid', () => {
  it('shows partial for a day declared free with an event on it', () => {
    // The grid and the editor have to agree, or the day looks free from the
    // month view and partial once opened.
    const availability = { '2026-09-08': { mode: 'free', importedSlots: event } };

    expect(getDayStatus('2026-09-08', availability)).toBe('partial');
  });

  it('still shows free for a day with nothing on it', () => {
    expect(getDayStatus('2026-09-08', { '2026-09-08': { mode: 'free' } })).toBe('free');
  });

  it('still shows busy for a day declared busy', () => {
    const availability = { '2026-09-08': { mode: 'busy', importedSlots: event } };

    expect(getDayStatus('2026-09-08', availability)).toBe('busy');
  });

  it('says nothing for a day with no entry', () => {
    expect(getDayStatus('2026-09-08', {})).toBe('none');
  });

  it('shows busy for a day a multi-day event runs straight through', () => {
    const availability = {
      '2026-09-05': {
        mode: 'custom',
        importedSlots: [{ start: '00:00', end: '23:59', source: 'apple_calendar' as const }],
      },
    };

    expect(getDayStatus('2026-09-05', availability)).toBe('busy');
  });
});
