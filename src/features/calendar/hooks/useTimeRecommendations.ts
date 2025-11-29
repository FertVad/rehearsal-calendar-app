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

export interface TimeSlot {
  startTime: string;
  endTime: string;
  duration: number;
  confidence: 'high' | 'medium';
}

const WORK_START = toMinutes(WORKDAY_START);
const WORK_END = toMinutes(WORKDAY_END);

export const useTimeRecommendations = (
  selectedDate: string,
  members: ProjectMember[],
  memberAvailability: Record<string, { timeRanges: TimeRange[] }>,
): TimeSlot[] => {
  const memberIds = useMemo(() => members.map(m => m.userId), [members]);

  const unionBusy = useMemo(() => {
    const ranges: TimeRange[] = [];

    memberIds.forEach(userId => {
      const availability = memberAvailability[userId];
      if (availability?.timeRanges) {
        ranges.push(...availability.timeRanges);
      }
    });

    return mergeBusyRanges(ranges);
  }, [memberIds, memberAvailability]);

  return useMemo(() => {
    if (!selectedDate || memberIds.length === 0) return [];

    const free = busyToFreeGaps(unionBusy);
    const slots = free
      .map(clampToWorkday)
      .filter((r): r is TimeRange => Boolean(r))
      .map(r => ({ start: toMinutes(r.start), end: toMinutes(r.end) }))
      .filter(r => r.end - r.start >= 60) // At least 1 hour
      .map(r => {
        const inWorkingHours = r.start >= WORK_START && r.end <= WORK_END;
        const hours = (r.end - r.start) / 60;
        const duration = Number.isInteger(hours)
          ? hours
          : Number(hours.toFixed(1));
        const confidence: 'high' | 'medium' =
          unionBusy.length === 0 && inWorkingHours ? 'high' : 'medium';
        return {
          startTime: toTimeString(r.start),
          endTime: toTimeString(r.end),
          duration,
          confidence,
        };
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    return slots;
  }, [selectedDate, memberIds, unionBusy]);
};
