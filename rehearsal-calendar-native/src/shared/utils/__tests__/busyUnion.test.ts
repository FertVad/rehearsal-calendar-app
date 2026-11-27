/**
 * A person's busy time on a day is the union of their busy ranges (T-421):
 * ranges that overlap or touch are one span, in the order of the day. The
 * sheet beside a name, the line under the form's participants and the warning
 * on save all say it so.
 *
 * Each row was said on its own. Valery's Friday had two rows, both right — a
 * trip imported from his phone's calendar and the weekend busy by default
 * (T-406) — and the sheet said "all day, all day"; 18:00–20:00 and 19:00–21:00
 * read as two spans, not as 18:00–21:00.
 */
import { busyLine, checkSchedulingConflicts } from '../conflictDetection';
import { busyText } from '../../components/ParticipantPicker';
import { translations } from '../../../i18n/translations';
import type { ProjectMember } from '../../types';
import type { TimeRange } from '../availability';

const t = translations.en;
const busy = (start: string, end: string): TimeRange => ({ start, end, type: 'busy' });
const sheet = (...ranges: TimeRange[]) => busyText(ranges, t, 'en-US', true);

const valery: ProjectMember = { id: 'v', userId: 'v', firstName: 'Valery', lastName: 'Zuev', role: 'member', status: 'active' };
const line = (
  availability: { timeRanges: TimeRange[]; nextDayRanges?: TimeRange[] },
  start: string,
  end: string,
) => busyLine(checkSchedulingConflicts([valery], { v: availability }, start, end), t, 'en-US', true);

describe('beside a name in the participants sheet', () => {
  it('says the whole day once for two rows that are each the whole day', () => {
    // The trip from the phone's calendar and the weekend's default.
    expect(sheet(busy('00:00', '23:59'), busy('00:00', '23:59'))).toBe('all day');
  });

  it('glues overlapping ranges into one span', () => {
    expect(sheet(busy('18:00', '20:00'), busy('19:00', '21:00'))).toBe('18:00–21:00');
  });

  it('glues ranges that touch into one span', () => {
    expect(sheet(busy('18:00', '19:00'), busy('19:00', '20:00'))).toBe('18:00–20:00');
  });

  it('glues a range inside another into the larger one, and the whole day over hours', () => {
    expect(sheet(busy('10:00', '18:00'), busy('12:00', '13:00'))).toBe('10:00–18:00');
    expect(sheet(busy('10:00', '12:00'), busy('00:00', '23:59'))).toBe('all day');
  });

  it('keeps spans apart where there is free time between them, in the order of the day', () => {
    expect(sheet(busy('18:00', '20:00'), busy('10:00', '12:00'))).toBe('10:00–12:00, 18:00–20:00');
  });

  it('counts only the busy rows', () => {
    expect(sheet(busy('10:00', '12:00'), { start: '11:00', end: '15:00', type: 'available' })).toBe('10:00–12:00');
  });

  it('keeps an evening to the end of the day as the server says it', () => {
    expect(sheet(busy('18:00', '23:59'), busy('20:00', '22:00'))).toBe('18:00–23:59');
  });
});

describe('in the line under the participants, as the warning on save finds it', () => {
  it('says the whole day once', () => {
    expect(line({ timeRanges: [busy('00:00', '23:59'), busy('00:00', '23:59')] }, '10:00', '13:00'))
      .toBe('Busy: Valery Zuev (all day)');
  });

  it('gives the glued span that clashes, not its first row', () => {
    expect(line({ timeRanges: [busy('18:00', '20:00'), busy('19:00', '21:00')] }, '19:30', '22:00'))
      .toBe('Busy: Valery Zuev (18:00–21:00)');
    expect(line({ timeRanges: [busy('18:00', '19:00'), busy('19:00', '20:00')] }, '18:30', '19:30'))
      .toBe('Busy: Valery Zuev (18:00–20:00)');
  });

  it('gives the span that clashes, not one earlier in the day', () => {
    expect(line({ timeRanges: [busy('10:00', '12:00'), busy('18:00', '20:00')] }, '19:00', '21:00'))
      .toBe('Busy: Valery Zuev (18:00–20:00)');
  });

  it('glues the evening and the next morning across midnight', () => {
    // 22:00 to the end of the day, and the next day from midnight to 02:00:
    // one span, 22:00–02:00, for a rehearsal 23:00–01:00 (cause fix 15).
    expect(line({ timeRanges: [busy('22:00', '23:59')], nextDayRanges: [busy('00:00', '02:00')] }, '23:00', '01:00'))
      .toBe('Busy: Valery Zuev (22:00–02:00)');
  });

  it('says the next morning alone when only it clashes', () => {
    expect(line({ timeRanges: [busy('10:00', '12:00')], nextDayRanges: [busy('00:00', '02:00')] }, '23:00', '01:00'))
      .toBe('Busy: Valery Zuev (00:00–02:00)');
  });

  it('says the whole day for a whole day running into the next morning', () => {
    expect(line({ timeRanges: [busy('00:00', '23:59')], nextDayRanges: [busy('00:00', '02:00')] }, '23:00', '01:00'))
      .toBe('Busy: Valery Zuev (all day)');
  });

  it('splits at midnight a span longer than a day, which one clock range cannot say', () => {
    expect(line({ timeRanges: [busy('10:00', '23:59')], nextDayRanges: [busy('00:00', '12:00')] }, '23:00', '01:00'))
      .toBe('Busy: Valery Zuev (10:00–23:59, 00:00–12:00)');
  });

  it('still finds nobody busy where nobody is', () => {
    expect(line({ timeRanges: [busy('18:00', '19:00'), busy('19:00', '20:00')] }, '20:00', '22:00')).toBeUndefined();
  });
});
