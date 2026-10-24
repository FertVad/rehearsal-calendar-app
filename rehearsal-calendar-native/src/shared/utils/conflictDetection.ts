import { TimeRange } from './availability';
import { ProjectMember } from '../types';
import { clockRangeMinutes, minuteRangesOverlap } from './time';

export interface ConflictInfo {
  hasConflicts: boolean;
  busyMembers: Array<{
    member: ProjectMember;
    conflictingSlots: TimeRange[];
  }>;
}

/**
 * Check for scheduling conflicts with busy participants
 *
 * The rehearsal is a clock range on its day, and one ending before it starts
 * runs into the next morning (cause fix 15) — so it is checked against that
 * morning's busy time too, `nextDayRanges`. Compared as HH:mm alone, 23:00–01:00
 * overlapped nothing at all.
 *
 * @param selectedMembers - Members selected for the rehearsal
 * @param memberAvailability - Each member's busy ranges on the day, and on the next
 * @param rehearsalStart - Rehearsal start time (HH:MM)
 * @param rehearsalEnd - Rehearsal end time (HH:MM), the next day when before the start
 * @returns Conflict information including which members are busy
 */
export function checkSchedulingConflicts(
  selectedMembers: ProjectMember[],
  memberAvailability: Record<string, { timeRanges: TimeRange[]; nextDayRanges?: TimeRange[] }>,
  rehearsalStart: string,
  rehearsalEnd: string
): ConflictInfo {
  const busyMembers: ConflictInfo['busyMembers'] = [];
  const rehearsal = clockRangeMinutes(rehearsalStart, rehearsalEnd);

  for (const member of selectedMembers) {
    const availability = memberAvailability[member.userId];
    if (!availability || !availability.timeRanges) {
      continue;
    }

    // Only 'busy' slots count (not 'available' or 'tentative').
    const busyOn = (ranges: TimeRange[] | undefined, dayOffset: number) =>
      (ranges ?? []).filter(slot =>
        slot.type === 'busy' &&
        minuteRangesOverlap(rehearsal, clockRangeMinutes(slot.start, slot.end, dayOffset)));

    const conflictingSlots = [
      ...busyOn(availability.timeRanges, 0),
      ...busyOn(availability.nextDayRanges, 1),
    ];

    if (conflictingSlots.length > 0) {
      busyMembers.push({
        member,
        conflictingSlots,
      });
    }
  }

  return {
    hasConflicts: busyMembers.length > 0,
    busyMembers,
  };
}

/**
 * Format conflict information into a user-friendly message
 */
export function formatConflictMessage(conflictInfo: ConflictInfo): string {
  if (!conflictInfo.hasConflicts) {
    return '';
  }

  const memberNames = conflictInfo.busyMembers
    .map(({ member }) => {
      const firstName = member.firstName || 'Участник';
      const lastName = member.lastName || '';
      return `${firstName} ${lastName}`.trim();
    })
    .join(', ');

  if (conflictInfo.busyMembers.length === 1) {
    return `${memberNames} занят(а) в это время`;
  }

  return `${memberNames} заняты в это время`;
}
