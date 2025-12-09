import { TimeRange } from './availability';
import { ProjectMember } from '../types';
import { timeToMinutes } from './time';

export interface ConflictInfo {
  hasConflicts: boolean;
  busyMembers: Array<{
    member: ProjectMember;
    conflictingSlots: TimeRange[];
  }>;
}

/**
 * Check if two time ranges overlap
 */
function timeRangesOverlap(
  range1Start: string,
  range1End: string,
  range2Start: string,
  range2End: string
): boolean {
  const start1 = timeToMinutes(range1Start);
  const end1 = timeToMinutes(range1End);
  const start2 = timeToMinutes(range2Start);
  const end2 = timeToMinutes(range2End);

  // Ranges overlap if one starts before the other ends
  return start1 < end2 && end1 > start2;
}

/**
 * Check for scheduling conflicts with busy participants
 *
 * @param selectedMembers - Members selected for the rehearsal
 * @param memberAvailability - Availability data for each member (busy/available slots)
 * @param rehearsalStart - Rehearsal start time (HH:MM)
 * @param rehearsalEnd - Rehearsal end time (HH:MM)
 * @returns Conflict information including which members are busy
 */
export function checkSchedulingConflicts(
  selectedMembers: ProjectMember[],
  memberAvailability: Record<string, { timeRanges: TimeRange[] }>,
  rehearsalStart: string,
  rehearsalEnd: string
): ConflictInfo {
  const busyMembers: ConflictInfo['busyMembers'] = [];

  for (const member of selectedMembers) {
    const availability = memberAvailability[member.userId];
    if (!availability || !availability.timeRanges) {
      continue;
    }

    // Find conflicting busy slots
    const conflictingSlots = availability.timeRanges.filter(slot => {
      // Only check 'busy' slots (ignore 'available' or 'tentative')
      if (slot.type !== 'busy') {
        return false;
      }

      return timeRangesOverlap(rehearsalStart, rehearsalEnd, slot.start, slot.end);
    });

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
