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
});
