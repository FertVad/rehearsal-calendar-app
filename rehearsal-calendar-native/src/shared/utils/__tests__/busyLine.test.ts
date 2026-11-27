/**
 * The line under the form's participants (T-261): the first one busy, by full
 * name as the Planner and the warning on save name them; their busy time, or
 * the whole day as the participants sheet says it; and how many more. It said
 * the surname alone, and "12:00 AM–11:59 PM" for someone busy all day.
 */
import { busyLine, busySpans, busySpansText, ConflictInfo } from '../conflictDetection';
import { busyText } from '../../components/ParticipantPicker';
import { translations } from '../../../i18n/translations';
import type { ProjectMember } from '../../types';
import type { TimeRange } from '../availability';

const member = (userId: string, firstName: string, lastName = ''): ProjectMember =>
  ({ id: userId, userId, firstName, lastName, role: 'member', status: 'active' });
const span = (start: string, end: string): TimeRange => ({ start, end, type: 'busy' } as TimeRange);
const spanOf = (range: TimeRange) => busySpans([range])[0];
const conflict = (first: [ProjectMember, TimeRange], more = 0): ConflictInfo => ({
  hasConflicts: true,
  busyMembers: [
    { member: first[0], conflictingSpans: [spanOf(first[1])] },
    ...Array.from({ length: more }, (_, i) => ({ member: member(`m${i}`, `M${i}`), conflictingSpans: [spanOf(span('10:00', '12:00'))] })),
  ],
});

const maya = member('1', 'Maya', 'Lopez');
const evening = span('18:00', '21:00');
const allDay = span('00:00', '23:59');

describe('in all four languages', () => {
  it('English', () => {
    const t = translations.en;
    expect(busyLine(conflict([maya, evening], 2), t, 'en-US', false)).toMatch(/^Busy: Maya Lopez \(6:00\sPM–9:00\sPM\) and 2 more$/);
    expect(busyLine(conflict([maya, evening], 1), t, 'en-US', true)).toBe('Busy: Maya Lopez (18:00–21:00) and 1 more');
    expect(busyLine(conflict([maya, evening]), t, 'en-US', true)).toBe('Busy: Maya Lopez (18:00–21:00)');
    expect(busyLine(conflict([maya, allDay], 2), t, 'en-US', false)).toBe('Busy: Maya Lopez (all day) and 2 more');
  });

  it('German', () => {
    const t = translations.de;
    const wang = member('2', 'Wang', 'Wasser');
    expect(busyLine(conflict([wang, span('10:00', '14:00')], 1), t, 'de-DE', true)).toBe('Beschäftigt: Wang Wasser (10:00–14:00) und 1 weiterer');
    expect(busyLine(conflict([wang, span('10:00', '14:00')], 3), t, 'de-DE', true)).toBe('Beschäftigt: Wang Wasser (10:00–14:00) und 3 weitere');
    expect(busyLine(conflict([wang, allDay]), t, 'de-DE', true)).toBe('Beschäftigt: Wang Wasser (ganztägig)');
  });

  it('Russian', () => {
    const t = translations.ru;
    const anna = member('3', 'Анна', 'Иванова');
    expect(busyLine(conflict([anna, span('10:00', '14:00')], 2), t, 'ru-RU', true)).toBe('Анна Иванова: занято 10:00–14:00 и ещё 2');
    expect(busyLine(conflict([anna, allDay]), t, 'ru-RU', true)).toBe('Анна Иванова: занято весь день');
  });

  it('Spanish', () => {
    const t = translations.es;
    const lucia = member('4', 'Lucía', 'Martín');
    expect(busyLine(conflict([lucia, span('10:00', '14:00')], 1), t, 'es-ES', true)).toBe('Lucía Martín: no disponible 10:00–14:00 y 1 más');
    expect(busyLine(conflict([lucia, allDay], 5), t, 'es-ES', true)).toBe('Lucía Martín: no disponible todo el día y 5 más');
  });
});

it('someone with no surname is named by the first name; nobody busy is no line', () => {
  const t = translations.en;
  expect(busyLine(conflict([member('5', 'Boris'), evening]), t, 'en-US', true)).toBe('Busy: Boris (18:00–21:00)');
  expect(busyLine({ hasConflicts: false, busyMembers: [] }, t, 'en-US', true)).toBeUndefined();
});

it('one rule for the whole day, in the line and in the sheet', () => {
  const t = translations.en;
  for (const day of [allDay, span('00:00', '24:00')]) {
    expect(busySpansText(busySpans([day]), t, 'en-US', false)).toBe('all day');
    expect(busyText([day], t, 'en-US', false)).toBe('all day');
  }
  expect(busySpansText(busySpans([span('00:00', '12:00')]), t, 'en-US', true)).toBe('00:00–12:00');
});
