import { useMemo } from 'react';
import { ProjectMember } from '../../../shared/types';
import {
  mergeBusyRanges,
  busyToFreeGaps,
  clampToWorkday,
  toMinutes,
  toTimeString,
  WORKDAY_START,
  WORKDAY_END,
  TimeRange,
} from '../../../shared/utils/availability';

/**
 * A window in which everyone picked is free. A tap on it starts the rehearsal
 * there and ends it the usual length on, or where the window ends if that is
 * sooner (useAddRehearsalForm, T-238). Each window is free time, so they are
 * all alike: the 'high'/'medium' they once had said only whether anyone was
 * busy at some time of the day, and painted nearly every window yellow, the
 * phone calendar's colour (T-238).
 */
export interface FreeWindow {
  startTime: string;
  /** Where the free time ends: the first of the people picked is busy, or the working day is over. */
  endTime: string;
  duration: number;
}

interface TimeRecommendationsResult {
  /**
   * Nobody picked is busy at any time of the working day. There is no window
   * to offer then: 09:00–23:00 is not a rehearsal, and the time is the
   * form's own (T-238).
   */
  freeAllDay: boolean;
  windows: FreeWindow[];
}

const NONE: TimeRecommendationsResult = { freeAllDay: false, windows: [] };

export const useTimeRecommendations = (
  selectedDate: string,
  members: ProjectMember[],
  memberAvailability: Record<string, { timeRanges: TimeRange[] }>,
): TimeRecommendationsResult => {
  const memberIds = useMemo(() => members.map(m => m.userId), [members]);

  const unionBusy = useMemo(() => {
    const ranges: TimeRange[] = [];

    memberIds.forEach(userId => {
      const availability = memberAvailability[userId];
      if (availability?.timeRanges) {
        // Only consider 'busy' and 'tentative' ranges as conflicts
        const busyRanges = availability.timeRanges.filter(
          r => r.type === 'busy' || r.type === 'tentative'
        );
        ranges.push(...busyRanges);
      }
    });

    return mergeBusyRanges(ranges);
  }, [memberIds, memberAvailability]);

  return useMemo(() => {
    if (!selectedDate || memberIds.length === 0) return NONE;

    const free = busyToFreeGaps(unionBusy)
      .map(clampToWorkday)
      .filter((r): r is TimeRange => Boolean(r));
    if (free.length === 1 && free[0].start === WORKDAY_START && free[0].end === WORKDAY_END) {
      return { freeAllDay: true, windows: [] };
    }

    const windows = free
      .map(r => ({ start: toMinutes(r.start), end: toMinutes(r.end) }))
      .filter(r => r.end - r.start >= 60) // At least 1 hour
      .map(r => {
        const hours = (r.end - r.start) / 60;
        const duration = Number.isInteger(hours)
          ? hours
          : Number(hours.toFixed(1));
        return {
          startTime: toTimeString(r.start),
          endTime: toTimeString(r.end),
          duration,
        };
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    return { freeAllDay: false, windows };
  }, [selectedDate, memberIds, unionBusy]);
};
