import type { TimeRange } from '../../../shared/utils/availability';
import { mergeBusyRanges } from '../../../shared/utils/availability';
import type { AvailabilityData, Member } from '../types';
import { logger } from '../../../shared/utils/logger';

export interface MemberAvailability {
  userId: string;
  firstName: string;
  lastName?: string;
  /**
   * Whether this member has ever recorded any availability. Absent rows are
   * treated as free, so without this the planner cannot tell someone who has
   * declared themselves open from someone who has never opened the screen.
   */
  hasData?: boolean;
  dates: Array<{
    date: string;
    timeRanges: TimeRange[];
  }>;
}

/**
 * Collapses each member's busy and tentative ranges into merged busy ranges —
 * one entry per member per date.
 *
 * Rehearsals are deliberately not read here. `slotService` writes one
 * `source='rehearsal'` busy row per participant, and the endpoint the planner
 * calls returns `native_user_availability` with no source filter, so those
 * hours already arrive as busy ranges for exactly the people who were called.
 * This function used to push every rehearsal's time range onto every member of
 * the project, on the assumption that the whole company attends everything —
 * which stopped being true once rehearsals got their own rosters. A rehearsal
 * for three then blocked that slot for everyone, so the planner refused times
 * that were genuinely free.
 *
 * @param members - List of members with basic info
 * @param memberAvailability - Availability data from the API
 * @returns One entry per member per date, with overlapping ranges merged
 */
export function mergeMemberAvailability(
  members: Member[],
  memberAvailability: MemberAvailability[]
): AvailabilityData[] {
  const result: AvailabilityData[] = [];

  for (const member of members) {
    const availData = memberAvailability.find(a => a.userId === member.id);
    const dates = [...new Set(availData?.dates.map(d => d.date) || [])];

    for (const date of dates) {
      const dateAvail = availData?.dates.find(d => d.date === date);

      if (__DEV__) {
        logger.debug(`[Availability Merger] Member ${member.id}, Date ${date}, Raw timeRanges:`, dateAvail?.timeRanges);
      }

      const busyRanges =
        dateAvail?.timeRanges.filter(r => r.type === 'busy' || r.type === 'tentative') || [];

      if (__DEV__) {
        logger.debug(`[Availability Merger] Member ${member.id}, Date ${date}, Filtered busy ranges:`, busyRanges);
      }

      result.push({
        memberId: member.id,
        date,
        busyRanges: mergeBusyRanges(busyRanges),
      });
    }
  }

  return result;
}
