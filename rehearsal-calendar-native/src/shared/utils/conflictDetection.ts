import { TimeRange } from './availability';
import { ProjectMember } from '../types';
import type { Translations } from '../../i18n/translations';
import { clockRangeMinutes, minuteRangesOverlap, minutesToTime } from './time';
import { formatTimeRange } from './clockFormat';

const DAY_MINUTES = 24 * 60;

/**
 * Busy time as minutes from the day's midnight, [start, end): the next
 * morning past 24:00, as clockRangeMinutes puts it (cause fix 15).
 */
export type BusySpan = [number, number];

export interface ConflictInfo {
  hasConflicts: boolean;
  busyMembers: Array<{
    member: ProjectMember;
    /** Their busy spans (busySpans) that share time with the rehearsal. */
    conflictingSpans: BusySpan[];
  }>;
}

/**
 * Someone's busy time on a day, the one rule for everything that shows or names
 * it (T-421): the union of their busy rows. Rows that overlap or touch are one
 * span, and the spans come in the order of the day. The next morning's rows
 * (`nextDayRanges`) sit on the same axis a day on, so an evening to midnight and
 * a morning from it are one span too.
 *
 * Each row was said on its own: a trip imported from the phone's calendar and
 * the weekend busy by default (T-406) — two rows of one Friday, both right — read
 * "all day, all day", and 18:00–20:00 with 19:00–21:00 read as two spans.
 *
 * Only rows of type 'busy' count (not 'available' or 'tentative'). The server
 * ends a day at 23:59 (routes/native/members.js), so that end is midnight here.
 */
export function busySpans(ranges: TimeRange[] | undefined, nextDayRanges?: TimeRange[]): BusySpan[] {
  const onAxis = (rows: TimeRange[] | undefined, dayOffset: number): BusySpan[] =>
    (rows ?? [])
      .filter(r => r.type === 'busy')
      .map(r => clockRangeMinutes(r.start, r.end === '23:59' ? '24:00' : r.end, dayOffset))
      .filter(([from, to]) => from < to);
  const all = [...onAxis(ranges, 0), ...onAxis(nextDayRanges, 1)].sort((a, b) => a[0] - b[0]);
  const union: BusySpan[] = [];
  for (const [from, to] of all) {
    const last = union[union.length - 1];
    if (last && from <= last[1]) last[1] = Math.max(last[1], to);
    else union.push([from, to]);
  }
  return union;
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

    // Their busy time glued (busySpans): a span clashes where any row in it does.
    const conflictingSpans = busySpans(availability.timeRanges, availability.nextDayRanges)
      .filter(span => minuteRangesOverlap(rehearsal, span));

    if (conflictingSpans.length > 0) {
      busyMembers.push({
        member,
        conflictingSpans,
      });
    }
  }

  return {
    hasConflicts: busyMembers.length > 0,
    busyMembers,
  };
}

/**
 * Format conflict information into a user-friendly message, in the app's
 * language.
 */
export function formatConflictMessage(conflictInfo: ConflictInfo, t: Translations): string {
  if (!conflictInfo.hasConflicts) {
    return '';
  }

  const memberNames = conflictInfo.busyMembers
    .map(({ member }) => memberFullName(member, t))
    .join(', ');

  return t.rehearsals.busyAtThisTime(memberNames, conflictInfo.busyMembers.length);
}

/** Someone busy, by full name, as the warning on save and the Planner name them. */
function memberFullName(member: ProjectMember, t: Translations): string {
  return `${member.firstName || t.projects.member} ${member.lastName || ''}`.trim();
}

/** A minute of the axis on the clock: midnight ending a day as the server says it, 23:59. */
const clockAt = (minute: number, isEnd: boolean): string =>
  isEnd && minute % DAY_MINUTES === 0 ? '23:59' : minutesToTime(minute % DAY_MINUTES);

/**
 * One busy span in words: its times, or the whole day for one covering a day.
 * The participants sheet and the line under the form's participants both say
 * it so; the line showed "12:00 AM–11:59 PM" for someone busy all day (T-261).
 * A span longer than a day, from an evening to the morning after next, is no
 * one clock range: it is said in its two days' parts.
 */
function busySpanText([from, to]: BusySpan, t: Translations, locale: string, uses24: boolean): string {
  const coversDay = (day: number) => from <= day * DAY_MINUTES && to >= (day + 1) * DAY_MINUTES;
  if (coversDay(0) || coversDay(1)) return t.rehearsals.wholeDay;
  if (to - from >= DAY_MINUTES) {
    return [busySpanText([from, DAY_MINUTES], t, locale, uses24), busySpanText([DAY_MINUTES, to], t, locale, uses24)].join(', ');
  }
  return formatTimeRange(clockAt(from, false), clockAt(to, true), locale, uses24);
}

/** Busy spans in words, in the order of the day; nothing for none. */
export function busySpansText(spans: BusySpan[], t: Translations, locale: string, uses24: boolean): string | undefined {
  if (spans.length === 0) return undefined;
  return spans.map(span => busySpanText(span, t, locale, uses24)).join(', ');
}

/**
 * The line under the form's participants: the first one busy, by full name,
 * with the span that clashes, and how many more — "Busy: Maya Lopez (6:00
 * PM–9:00 PM) and 2 more". Only the surname was given (T-261).
 */
export function busyLine(conflictInfo: ConflictInfo, t: Translations, locale: string, uses24: boolean): string | undefined {
  const [first, ...rest] = conflictInfo.busyMembers;
  if (!first) return undefined;
  const line = t.rehearsals.busyAt(memberFullName(first.member, t), busySpanText(first.conflictingSpans[0], t, locale, uses24));
  return rest.length ? `${line} ${t.rehearsals.andMore(rest.length)}` : line;
}
