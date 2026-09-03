/**
 * The recommendation engine. It had no tests at all until now.
 *
 * The day loop used to start from `new Date(startDate)` — UTC midnight — read
 * the day back with toISOString(), and advance it with setDate(), which moves
 * the *local* components. Those agree until a clock change: coming off summer
 * time one step is 25 hours, so the cursor drifted past midnight UTC and the
 * loop overshot its end a day early. A week containing the October change was
 * planned as six days.
 *
 * The day-coverage assertions below are true in every timezone; they only
 * *discriminate* in one that observes a transition, which is where the app's
 * users are (Asia/Jerusalem, changing at 02:00 in late March and late October).
 */
import { generateTimeSlots } from '../slotGenerator';
import type { Member, AvailabilityData } from '../../types';

const members: Member[] = [
  { id: '1', name: 'Аня' },
  { id: '2', name: 'Борис' },
];

const daysCovered = (startDate: string, endDate: string, availability: AvailabilityData[] = []) => {
  const slots = generateTimeSlots(startDate, endDate, members, availability);
  return [...new Set(slots.map((s) => s.date))].sort();
};

const spanInDays = (startDate: string, endDate: string) => {
  const [ys, ms, ds] = startDate.split('-').map(Number);
  const [ye, me, de] = endDate.split('-').map(Number);
  return Math.round((Date.UTC(ye, me - 1, de) - Date.UTC(ys, ms - 1, ds)) / 86400000) + 1;
};

describe('generateTimeSlots — day coverage', () => {
  it.each([
    ['обычная неделя', '2026-09-01', '2026-09-07'],
    ['неделя с весенним переходом', '2026-03-24', '2026-03-30'],
    ['неделя с осенним переходом', '2026-10-22', '2026-10-28'],
    ['месяц через осенний переход', '2026-10-10', '2026-11-08'],
    ['один день, он же день перехода', '2026-10-25', '2026-10-25'],
  ])('covers every day of %s', (_label, start, end) => {
    const days = daysCovered(start, end);

    expect(days).toHaveLength(spanInDays(start, end));
    expect(days[0]).toBe(start);
    expect(days[days.length - 1]).toBe(end);
  });

  it('never repeats a day', () => {
    const slots = generateTimeSlots('2026-10-22', '2026-10-28', members, []);
    const days = slots.map((s) => s.date);
    expect(new Set(days).size).toBe(7);
  });
});

describe('generateTimeSlots — who counts as busy', () => {
  const DATE = '2026-09-01';

  it('calls a slot perfect when nobody is busy', () => {
    const slots = generateTimeSlots(DATE, DATE, members, []);

    expect(slots.every((s) => s.category === 'perfect')).toBe(true);
    expect(slots[0].totalMembers).toBe(2);
    expect(slots[0].freeMembers).toBe(2);
  });

  it('counts a busy member against the slot covering their hours', () => {
    const availability: AvailabilityData[] = [
      { memberId: '1', date: DATE, busyRanges: [{ start: '14:00', end: '16:00' }] },
    ];

    const slots = generateTimeSlots(DATE, DATE, members, availability);
    const during = slots.find((s) => s.startTime >= '14:00' && s.startTime < '16:00');

    expect(during).toBeDefined();
    expect(during!.freeMembers).toBe(1);
    expect(during!.busyMembers.map((m) => m.id)).toEqual(['1']);
  });

  it('measures against the selected members only, not the whole company', () => {
    const availability: AvailabilityData[] = [
      { memberId: '1', date: DATE, busyRanges: [{ start: '14:00', end: '16:00' }] },
    ];

    // Only Boris is being planned for, and he is free all day.
    const slots = generateTimeSlots(DATE, DATE, members, availability, ['2']);

    expect(slots.every((s) => s.totalMembers === 1)).toBe(true);
    expect(slots.every((s) => s.category === 'perfect')).toBe(true);
  });
});
