import type { TimeSlot, SlotCategory, BusyMember, Member, AvailabilityData } from '../types';
import { timeToMinutes } from '../../../shared/utils/time';
import { logger } from '../../../shared/utils/logger';

const SLOT_INTERVAL_MINUTES = 30;

/**
 * Generates time slots in 30-minute intervals
 * Cache intervals by work hours range
 */
const intervalCache = new Map<string, string[]>();

function generateTimeIntervals(workHoursStart: string = '09:00', workHoursEnd: string = '23:00'): string[] {
  const cacheKey = `${workHoursStart}-${workHoursEnd}`;

  if (intervalCache.has(cacheKey)) {
    return intervalCache.get(cacheKey)!;
  }

  const [startHour, startMin] = workHoursStart.split(':').map(Number);
  const [endHour, endMin] = workHoursEnd.split(':').map(Number);

  const intervals: string[] = [];
  let currentHour = startHour;
  let currentMinute = startMin;

  while (currentHour < endHour || (currentHour === endHour && currentMinute <= endMin)) {
    const time = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
    intervals.push(time);

    currentMinute += SLOT_INTERVAL_MINUTES;
    if (currentMinute >= 60) {
      currentHour += 1;
      currentMinute = 0;
    }

    // Break if we've exceeded end time
    if (currentHour > endHour || (currentHour === endHour && currentMinute > endMin)) {
      break;
    }
  }

  intervalCache.set(cacheKey, intervals);
  return intervals;
}

/**
 * Checks if a time falls within a busy range
 */
function isTimeBusy(time: string, busyRanges: Array<{ start: string; end: string }>): boolean {
  const timeMinutes = timeToMinutes(time);

  for (const range of busyRanges) {
    const startMinutes = timeToMinutes(range.start);
    const endMinutes = timeToMinutes(range.end);

    // Use <= for end time to include the end minute (e.g., 23:59 in range 00:00-23:59)
    if (timeMinutes >= startMinutes && timeMinutes <= endMinutes) {
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
  workHoursEnd: string
): TimeSlot[] {
  const intervals = generateTimeIntervals(workHoursStart, workHoursEnd);
  const slots: TimeSlot[] = [];

  // Filter members by selection - if empty array, use all members
  const relevantMembers = selectedMemberIds.length === 0
    ? members
    : members.filter(m => selectedMemberIds.includes(m.id));

  // Build availability map for this date
  const availabilityMap = new Map<string, Array<{ start: string; end: string }>>();
  for (const avail of availabilityData) {
    if (avail.date === date) {
      availabilityMap.set(avail.memberId, avail.busyRanges);
      logger.debug(`[Slot Generator] Date ${date}, Member ${avail.memberId}, Busy ranges:`, avail.busyRanges);
    }
  }

  // Track current slot being built
  let slotStart: string | null = null;
  let slotBusyMembers: BusyMember[] = [];

  for (let i = 0; i < intervals.length; i++) {
    const time = intervals[i];
    const currentBusyMembers: BusyMember[] = [];

    // Check which members are busy at this time
    for (const member of relevantMembers) {
      const busyRanges = availabilityMap.get(member.id) || [];
      if (isTimeBusy(time, busyRanges)) {
        currentBusyMembers.push({
          id: member.id,
          name: member.name,
          busyRanges,
        });
      }
    }

    // If we're starting a new slot
    if (slotStart === null) {
      slotStart = time;
      slotBusyMembers = currentBusyMembers;
      continue;
    }

    // Check if the busy members changed (slot boundary)
    const busyMembersChanged =
      currentBusyMembers.length !== slotBusyMembers.length ||
      !currentBusyMembers.every(a => slotBusyMembers.some(b => b.id === a.id));

    // If members changed or we reached the end, finalize the slot
    if (busyMembersChanged || i === intervals.length - 1) {
      const endTime = i === intervals.length - 1 ? workHoursEnd : time;

      slots.push({
        date,
        startTime: slotStart,
        endTime,
        category: categorizeSlot(slotBusyMembers.length, relevantMembers.length),
        totalMembers: relevantMembers.length,
        freeMembers: relevantMembers.length - slotBusyMembers.length,
        busyMembers: slotBusyMembers,
      });

      // Start new slot
      slotStart = time;
      slotBusyMembers = currentBusyMembers;
    }
  }

  return slots;
}

/**
 * Categorizes slot based on number of busy members
 */
function categorizeSlot(busyCount: number, totalMembers: number): SlotCategory {
  if (busyCount === 0) {
    return 'perfect';
  }
  if (busyCount <= 2) {
    return 'good';
  }
  if (busyCount <= 4) {
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
  workHoursStart: string = '09:00',
  workHoursEnd: string = '23:00'
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  let currentDate = new Date(start);

  while (currentDate <= end) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const dateSlots = findFreeSlots(dateStr, members, availabilityData, selectedMemberIds, workHoursStart, workHoursEnd);
    slots.push(...dateSlots);

    currentDate.setDate(currentDate.getDate() + 1);
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
