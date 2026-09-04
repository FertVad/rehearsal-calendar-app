import type { TimeSlot, SlotCategory, BusyMember, Member, AvailabilityData } from '../types';
import { timeToMinutes, formatDateToString } from '../../../shared/utils/time';
import { WORKDAY_START, WORKDAY_END } from '../../../shared/utils/availability';
import { logger } from '../../../shared/utils/logger';

const SLOT_INTERVAL_MINUTES = 30;

/**
 * Generates time slots in 30-minute intervals
 * Cache intervals by work hours range
 */
const intervalCache = new Map<string, string[]>();

function generateTimeIntervals(workHoursStart: string = WORKDAY_START, workHoursEnd: string = WORKDAY_END): string[] {
  const cacheKey = `${workHoursStart}-${workHoursEnd}`;

  if (intervalCache.has(cacheKey)) {
    return intervalCache.get(cacheKey)!;
  }

  // The *start* of each half-hour bucket, so the last one is 22:30 rather than
  // 23:00 — the end of the working day bounds the final bucket, it is not a
  // bucket of its own.
  //
  // Stepped in plain minutes. Carrying hours and dropping the remainder gave an
  // irregular grid for any start not on the hour (09:15 → 09:15, 09:45, 10:00),
  // which is harmless at the current constants and a trap the day per-project
  // working hours arrive.
  const startMinutes = timeToMinutes(workHoursStart);
  const endMinutes = timeToMinutes(workHoursEnd);

  const intervals: string[] = [];
  for (let m = startMinutes; m < endMinutes; m += SLOT_INTERVAL_MINUTES) {
    intervals.push(
      `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    );
  }

  intervalCache.set(cacheKey, intervals);
  return intervals;
}

/**
 * Is anyone busy during the half hour that starts here?
 *
 * The question used to be "is anyone busy *at* this instant", asked only at
 * :00 and :30. Anything between two grid points was therefore invisible —
 * 10:05–10:25 blocked nothing at all and the whole day read Perfect — and the
 * start of every busy range was in effect rounded up to the next grid point,
 * under-blocking by as much as 29 minutes. Both errors pointed the same way:
 * free when the person was busy.
 *
 * Overlapping the bucket rounds busy time outward instead, so the worst case
 * is now under half an hour of over-blocking, which is the harmless direction.
 */
function isSlotBusy(time: string, busyRanges: Array<{ start: string; end: string }>): boolean {
  const slotStart = timeToMinutes(time);
  const slotEnd = slotStart + SLOT_INTERVAL_MINUTES;

  for (const range of busyRanges) {
    const rangeStart = timeToMinutes(range.start);
    const rangeEnd = timeToMinutes(range.end);

    // A range whose end is not after its start does not describe a slice of
    // this day — it wrapped past midnight. The endpoint cuts every record into
    // one range per day so this should not arrive, but the comparison below
    // answers "free" for it, silently and in the dangerous direction. Treat it
    // as busy from its start to the end of the day instead: over-blocking is
    // recoverable, telling someone a busy evening is free is not.
    //
    // Strictly less-than: an empty range, start equal to end, describes no time
    // at all and blocks nothing.
    if (rangeEnd < rangeStart) {
      if (rangeStart < slotEnd) return true;
      continue;
    }

    // Half-open on both sides: busy 10:00–11:00 leaves 11:00 free.
    if (rangeStart < slotEnd && rangeEnd > slotStart) {
      return true;
    }
  }

  return false;
}

/**
 * Finds continuous free slots for a specific date
 */
function findFreeSlots(
  date: string,
  members: Member[],
  availabilityData: AvailabilityData[],
  selectedMemberIds: string[],
  workHoursStart: string,
  workHoursEnd: string,
  notBefore: string | null = null
): TimeSlot[] {
  const allIntervals = generateTimeIntervals(workHoursStart, workHoursEnd);
  const slots: TimeSlot[] = [];

  // On today's card, drop the half-hours that have already begun. Nothing
  // filtered by the clock at all before this, so opening the planner in the
  // evening still offered the whole day from 09:00 — and the slot was live, so
  // tapping it walked you into scheduling a rehearsal in the past.
  const intervals = notBefore
    ? allIntervals.filter((t) => timeToMinutes(t) >= timeToMinutes(notBefore))
    : allIntervals;

  if (intervals.length === 0) return slots;

  // Filter members by selection - if empty array, use all members
  const relevantMembers = selectedMemberIds.length === 0
    ? members
    : members.filter(m => selectedMemberIds.includes(m.id));

  // Build availability map for this date
  const availabilityMap = new Map<string, Array<{ start: string; end: string }>>();
  for (const avail of availabilityData) {
    if (avail.date === date) {
      availabilityMap.set(avail.memberId, avail.busyRanges);
      if (__DEV__) {
        logger.debug(`[Slot Generator] Date ${date}, Member ${avail.memberId}, Busy ranges:`, avail.busyRanges);
      }
    }
  }

  // Walk the buckets, merging consecutive ones with the same busy set into one
  // slot. A slot ends where the bucket that broke it begins, and the last runs
  // to the end of the working day.
  //
  // The old loop closed the final slot with the *previous* bucket's busy set,
  // so anyone who became busy in the last half hour was dropped from it — and
  // the end of the day is exactly when a theatre rehearses.
  let slotStart: string | null = null;
  let slotBusyMembers: BusyMember[] = [];

  const closeSlot = (endTime: string) => {
    if (slotStart === null) return;

    slots.push({
      date,
      startTime: slotStart,
      endTime,
      category: categorizeSlot(slotBusyMembers.length, relevantMembers.length),
      totalMembers: relevantMembers.length,
      freeMembers: relevantMembers.length - slotBusyMembers.length,
      busyMembers: slotBusyMembers,
    });
  };

  for (const time of intervals) {
    const currentBusyMembers: BusyMember[] = [];

    for (const member of relevantMembers) {
      const busyRanges = availabilityMap.get(member.id) || [];
      if (isSlotBusy(time, busyRanges)) {
        currentBusyMembers.push({
          id: member.id,
          name: member.name,
          busyRanges,
        });
      }
    }

    const unchanged =
      slotStart !== null &&
      currentBusyMembers.length === slotBusyMembers.length &&
      currentBusyMembers.every(a => slotBusyMembers.some(b => b.id === a.id));

    if (!unchanged) {
      closeSlot(time);
      slotStart = time;
      slotBusyMembers = currentBusyMembers;
    }
  }

  closeSlot(workHoursEnd);

  return slots;
}

/**
 * Categorizes slot based on percentage of busy members
 * - perfect: 0% busy
 * - good: up to 25% busy
 * - ok: up to 50% busy
 * - bad: more than 50% busy
 */
function categorizeSlot(busyCount: number, totalMembers: number): SlotCategory {
  if (busyCount === 0) {
    return 'perfect';
  }
  const busyRatio = busyCount / totalMembers;
  if (busyRatio <= 0.25) {
    return 'good';
  }
  if (busyRatio <= 0.5) {
    return 'ok';
  }
  return 'bad';
}

/**
 * Generates all time slots for a date range
 */
export function generateTimeSlots(
  startDate: string,
  endDate: string,
  members: Member[],
  availabilityData: AvailabilityData[],
  selectedMemberIds: string[] = [],
  workHoursStart: string = WORKDAY_START,
  workHoursEnd: string = WORKDAY_END,
  now: Date = new Date()
): TimeSlot[] {
  const slots: TimeSlot[] = [];

  // Today and the time of day, in the reader's own clock — the same clock the
  // availability arrives in. A day already over contributes nothing, and today
  // starts from the next half-hour rather than from the top of the working day.
  const today = formatDateToString(now);
  const timeNow = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Walked in UTC. These are calendar dates with no zone meaning, so UTC is
  // both correct and the only arithmetic that behaves the same everywhere.
  //
  // It used to anchor on `new Date(startDate)` — UTC midnight — read the day
  // back with toISOString(), and advance with setDate(), which moves the local
  // components. They agree until a clock change: coming off summer time the
  // step is 25 hours, so the cursor drifted past midnight UTC and overshot the
  // end a day early, planning a week as six days with the last silently absent.
  // Walking local midnights instead fixed that but broke Santiago and Havana,
  // where the clocks change *at* midnight, so that instant does not exist and
  // the cursor lands at 01:00 and drifts the same way.
  const end = new Date(`${endDate}T00:00:00Z`);
  const currentDate = new Date(`${startDate}T00:00:00Z`);

  while (currentDate <= end) {
    const dateStr = currentDate.toISOString().split('T')[0];

    if (dateStr >= today) {
      const dateSlots = findFreeSlots(
        dateStr,
        members,
        availabilityData,
        selectedMemberIds,
        workHoursStart,
        workHoursEnd,
        dateStr === today ? timeNow : null
      );
      slots.push(...dateSlots);
    }

    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  // Slots are already added in chronological order
  return slots;
}

/**
 * Filters slots by selected categories
 */
export function filterSlotsByCategory(
  slots: TimeSlot[],
  selectedCategories: SlotCategory[]
): TimeSlot[] {
  if (selectedCategories.length === 0) {
    return slots;
  }
  return slots.filter(slot => selectedCategories.includes(slot.category));
}

/**
 * Counts slots by category
 * Optimized to single pass instead of 4 filters
 */
export function countSlotsByCategory(slots: TimeSlot[]): Record<SlotCategory, number> {
  const counts = {
    perfect: 0,
    good: 0,
    ok: 0,
    bad: 0,
  };

  for (const slot of slots) {
    counts[slot.category]++;
  }

  return counts;
}

/**
 * Groups slots by date
 */
export function groupSlotsByDate(slots: TimeSlot[]): Map<string, TimeSlot[]> {
  const grouped = new Map<string, TimeSlot[]>();

  for (const slot of slots) {
    const existing = grouped.get(slot.date);
    if (existing) {
      existing.push(slot);
    } else {
      grouped.set(slot.date, [slot]);
    }
  }

  return grouped;
}
