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

// Pinned so these do not quietly start failing once the dates they name have
// passed — the generator drops days that are already over.
const BEFORE_ALL = new Date(2026, 0, 1, 8, 0);

const daysCovered = (startDate: string, endDate: string, availability: AvailabilityData[] = []) => {
  const slots = generateTimeSlots(startDate, endDate, members, availability, [], undefined, undefined, BEFORE_ALL);
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
    const slots = generateTimeSlots('2026-10-22', '2026-10-28', members, [], [], undefined, undefined, BEFORE_ALL);
    const days = slots.map((s) => s.date);
    expect(new Set(days).size).toBe(7);
  });
});

describe('generateTimeSlots — who counts as busy', () => {
  const DATE = '2026-09-01';

  it('calls a slot perfect when nobody is busy', () => {
    const slots = generateTimeSlots(DATE, DATE, members, [], [], undefined, undefined, BEFORE_ALL);

    expect(slots.every((s) => s.category === 'perfect')).toBe(true);
    expect(slots[0].totalMembers).toBe(2);
    expect(slots[0].freeMembers).toBe(2);
  });

  it('counts a busy member against the slot covering their hours', () => {
    const availability: AvailabilityData[] = [
      { memberId: '1', date: DATE, busyRanges: [{ start: '14:00', end: '16:00' }] },
    ];

    const slots = generateTimeSlots(DATE, DATE, members, availability, [], undefined, undefined, BEFORE_ALL);
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
    const slots = generateTimeSlots(DATE, DATE, members, availability, ['2'], undefined, undefined, BEFORE_ALL);

    expect(slots.every((s) => s.totalMembers === 1)).toBe(true);
    expect(slots.every((s) => s.category === 'perfect')).toBe(true);
  });
});

/**
 * Busy time used to be sampled at :00 and :30 and asked "is anyone busy at this
 * instant". Anything living between two grid points was invisible, and the
 * start of every range was in effect rounded up to the next point — both
 * pointing the same way, free when the person was busy. The buckets overlap
 * now, so busy time rounds outward instead.
 */
describe('generateTimeSlots — half-hour buckets', () => {
  const DATE = '2026-09-01';
  const slotAt = (slots: ReturnType<typeof generateTimeSlots>, time: string) =>
    slots.find((s) => s.startTime <= time && time < s.endTime);

  const withBusy = (start: string, end: string) =>
    generateTimeSlots(
      DATE, DATE, members,
      [{ memberId: '1', date: DATE, busyRanges: [{ start, end }] }],
      [], undefined, undefined, BEFORE_ALL
    );

  it('sees a busy range that falls entirely between two grid points', () => {
    const slots = withBusy('10:05', '10:25');

    expect(slots.every((s) => s.category === 'perfect')).toBe(false);
    expect(slotAt(slots, '10:10')!.freeMembers).toBe(1);
  });

  it('blocks from the start of the bucket a busy range begins in', () => {
    const slots = withBusy('10:20', '11:00');

    // 10:00–10:30 overlaps the busy time, so it may not be offered as free.
    expect(slotAt(slots, '10:00')!.freeMembers).toBe(1);
    expect(slotAt(slots, '11:00')!.freeMembers).toBe(2);
  });

  it('counts someone who becomes busy in the last half hour of the day', () => {
    const slots = withBusy('22:45', '23:15');

    expect(slotAt(slots, '22:45')!.freeMembers).toBe(1);
    expect(slots[slots.length - 1].endTime).toBe('23:00');
  });

  it('leaves the moment a busy range ends free', () => {
    const slots = withBusy('10:00', '11:00');

    expect(slotAt(slots, '10:30')!.freeMembers).toBe(1);
    expect(slotAt(slots, '11:00')!.freeMembers).toBe(2);
  });

  it('never runs a slot past the end of the working day', () => {
    const slots = withBusy('14:00', '16:00');

    expect(slots.every((s) => s.endTime <= '23:00')).toBe(true);
    expect(slots[0].startTime).toBe('09:00');
  });
});

/**
 * Nothing filtered by the clock at all before this: opening the planner in the
 * evening still offered the whole day from 09:00, and the slot was live — so a
 * tap walked the user into scheduling a rehearsal in a time that had passed.
 */
describe('generateTimeSlots — time already gone', () => {
  const DATE = '2026-09-01';
  const at = (h: number, m = 0) => new Date(2026, 8, 1, h, m); // local, 1 Sep

  const slotsNow = (now: Date, start = DATE, end = DATE) =>
    generateTimeSlots(start, end, members, [], [], undefined, undefined, now);

  it('starts today at the next half hour, not at the top of the day', () => {
    const slots = slotsNow(at(18, 5));

    expect(slots[0].startTime).toBe('18:30');
    expect(slots[slots.length - 1].endTime).toBe('23:00');
  });

  it('keeps a half hour that is starting exactly now', () => {
    expect(slotsNow(at(18, 0))[0].startTime).toBe('18:00');
  });

  it('offers the whole working day when the day has not started', () => {
    expect(slotsNow(at(6, 0))[0].startTime).toBe('09:00');
  });

  it('offers nothing once the working day is over', () => {
    expect(slotsNow(at(23, 30))).toHaveLength(0);
  });

  it('drops a day that is already past', () => {
    // Asked for 31 August while it is 1 September.
    expect(slotsNow(at(10, 0), '2026-08-31', '2026-08-31')).toHaveLength(0);
  });

  it('leaves later days whole', () => {
    const slots = slotsNow(at(18, 5), DATE, '2026-09-02');
    const tomorrow = slots.filter((s) => s.date === '2026-09-02');

    expect(tomorrow[0].startTime).toBe('09:00');
    expect(tomorrow[tomorrow.length - 1].endTime).toBe('23:00');
  });
});

describe('generateTimeSlots — member filter', () => {
  const DATE = '2026-09-01';

  it('measures against the selected members only, not the whole company (again)', () => {
    const availability: AvailabilityData[] = [
      { memberId: '1', date: DATE, busyRanges: [{ start: '14:00', end: '16:00' }] },
    ];

    // Only Boris is being planned for, and he is free all day.
    const slots = generateTimeSlots(DATE, DATE, members, availability, ['2'], undefined, undefined, BEFORE_ALL);

    expect(slots.every((s) => s.totalMembers === 1)).toBe(true);
    expect(slots.every((s) => s.category === 'perfect')).toBe(true);
  });
});
