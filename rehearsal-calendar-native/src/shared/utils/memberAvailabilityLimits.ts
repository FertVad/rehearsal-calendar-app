import limits from '../../../shared/contracts/memberAvailabilityLimits.json';

export const memberAvailabilityLimits = limits;

// Calendar dates have no local offset. Count them without walking the range,
// and reject JavaScript's normalization of dates such as February 30.
export function calendarRangeDays(startDate: string, endDate: string): number | null {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return null;
    const timestamp = Date.parse(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return null;
    return timestamp;
  };
  const start = parse(startDate);
  const end = parse(endDate);
  if (start === null || end === null || start > end) return null;
  return (end - start) / 86_400_000 + 1;
}
