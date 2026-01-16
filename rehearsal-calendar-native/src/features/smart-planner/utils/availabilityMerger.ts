import type { Rehearsal } from '../../../shared/types';
import type { TimeRange } from '../../../shared/utils/availability';
import { mergeBusyRanges } from '../../../shared/utils/availability';
import type { AvailabilityData, Member } from '../types';
import { logger } from '../../../shared/utils/logger';

export interface MemberAvailability {
  userId: string;
  firstName: string;
  lastName?: string;
  dates: Array<{
    date: string;
    timeRanges: TimeRange[];
  }>;
}

/**
 * Merges manual availability and rehearsals for members
 *
 * @param members - List of members with basic info
 * @param memberAvailability - Manual availability data from API
 * @param rehearsals - List of all rehearsals
 * @returns Array of merged availability entries (memberId, date, busyRanges)
 */
export function mergeAvailabilityWithRehearsals(
  members: Member[],
  memberAvailability: MemberAvailability[],
  rehearsals: Rehearsal[]
): AvailabilityData[] {
  const result: AvailabilityData[] = [];

  // Build a map of rehearsals by member ID and date for O(1) lookup
  // Map structure: memberId -> date -> TimeRange[]
  const rehearsalMap = new Map<string, Map<string, TimeRange[]>>();

  for (const rehearsal of rehearsals) {
    if (!rehearsal.date || !rehearsal.time) continue;

    // Parse time range
    const timeRange: TimeRange = {
      start: rehearsal.time,
      end: rehearsal.endTime || rehearsal.time,
    };

    // In native app, all members of the project are assumed to be invited to the rehearsal
    // Add to map for each member
    for (const member of members) {
      let dateMap = rehearsalMap.get(member.id);
      if (!dateMap) {
        dateMap = new Map();
        rehearsalMap.set(member.id, dateMap);
      }

      let ranges = dateMap.get(rehearsal.date);
      if (!ranges) {
        ranges = [];
        dateMap.set(rehearsal.date, ranges);
      }

      ranges.push(timeRange);
    }
  }

  // Process each member
  for (const member of members) {
    // Find this member's availability data
    const availData = memberAvailability.find(
      a => a.userId === member.id
    );

    // Get all dates from member's manual availability
    const manualDates = availData?.dates.map(d => d.date) || [];

    // Get all dates from rehearsals for this member
    const memberRehearsalDates = rehearsalMap.get(member.id);
    const rehearsalDates = memberRehearsalDates
      ? Array.from(memberRehearsalDates.keys())
      : [];

    // Combine all unique dates
    const allDates = [...new Set([...manualDates, ...rehearsalDates])];

    for (const date of allDates) {
      // Get manual availability for this date (busy and tentative ranges)
      const dateAvail = availData?.dates.find(d => d.date === date);

      logger.debug(`[Availability Merger] Member ${member.id}, Date ${date}, Raw timeRanges:`, dateAvail?.timeRanges);

      const manualRanges =
        dateAvail?.timeRanges.filter(r => r.type === 'busy' || r.type === 'tentative') || [];

      logger.debug(`[Availability Merger] Member ${member.id}, Date ${date}, Filtered busy ranges:`, manualRanges);

      // Get rehearsal ranges for this date (O(1) lookup)
      const rehearsalRanges = memberRehearsalDates?.get(date) || [];

      // Merge ranges
      const mergedRanges = mergeBusyRanges([
        ...manualRanges,
        ...rehearsalRanges,
      ]);

      result.push({
        memberId: member.id,
        date,
        busyRanges: mergedRanges,
      });
    }
  }

  return result;
}
