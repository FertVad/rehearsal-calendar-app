// src/shared/utils/availability.ts
var WORKDAY_START = "09:00";
var WORKDAY_END = "23:00";
var DAY_END = 23 * 60 + 59;
var toMinutes = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
var toTimeString = (m) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};
var minTime = (a, b) => toMinutes(a) < toMinutes(b) ? a : b;
var maxTime = (a, b) => toMinutes(a) > toMinutes(b) ? a : b;
var timeLt = (a, b) => toMinutes(a) < toMinutes(b);
function clampToWorkday(range) {
  const start = maxTime(range.start, WORKDAY_START);
  const end = minTime(range.end, WORKDAY_END);
  return timeLt(start, end) ? { start, end } : null;
}
var mergeBusyRanges = (ranges) => {
  const cleaned = ranges.filter((r) => r && typeof r.start === "string" && typeof r.end === "string").map((r) => ({ start: toMinutes(r.start), end: toMinutes(r.end) })).filter((r) => !isNaN(r.start) && !isNaN(r.end) && r.start < r.end);
  if (cleaned.length === 0) return [];
  cleaned.sort((a, b) => a.start - b.start);
  const merged = [cleaned[0]];
  for (const cur of cleaned.slice(1)) {
    const last = merged[merged.length - 1];
    if (cur.start <= last.end + 1) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged.map((r) => ({ start: toTimeString(r.start), end: toTimeString(r.end) }));
};
function subtractRanges(ranges = [], toSubtract) {
  if (!toSubtract) return ranges;
  const subStart = toMinutes(toSubtract.start);
  const subEnd = toMinutes(toSubtract.end);
  const result = [];
  for (const r of ranges) {
    const start = toMinutes(r.start);
    const end = toMinutes(r.end);
    if (subEnd <= start || subStart >= end) {
      result.push(r);
      continue;
    }
    if (subStart > start) {
      result.push({ start: toTimeString(start), end: toTimeString(Math.min(subStart, end)) });
    }
    if (subEnd < end) {
      result.push({ start: toTimeString(Math.max(subEnd, start)), end: toTimeString(end) });
    }
  }
  return result;
}
var isDayFullyBusy = (ranges) => ranges.length === 1 && ranges[0].start === "00:00" && ranges[0].end === "23:59";
function classifyDayByRanges(ranges) {
  const rs = Array.isArray(ranges) ? ranges : [];
  if (rs.length === 0) return "free";
  const first = rs[0];
  const last = rs[rs.length - 1];
  return toMinutes(first.start) <= 0 && toMinutes(last.end) >= DAY_END ? "busy" : "partial";
}
var busyToFreeGaps = (ranges) => {
  const merged = mergeBusyRanges(ranges).map(clampToWorkday).filter((r) => Boolean(r));
  if (merged.length === 0) return [{ start: WORKDAY_START, end: WORKDAY_END }];
  const result = [];
  let prevEnd = toMinutes(WORKDAY_START);
  merged.forEach((r) => {
    const start = toMinutes(r.start);
    if (start > prevEnd) {
      result.push({ start: toTimeString(prevEnd), end: toTimeString(start) });
    }
    prevEnd = Math.max(prevEnd, toMinutes(r.end));
  });
  const workdayEnd = toMinutes(WORKDAY_END);
  if (prevEnd < workdayEnd) {
    result.push({ start: toTimeString(prevEnd), end: toTimeString(workdayEnd) });
  }
  return result.filter((r) => timeLt(r.start, r.end));
};
export {
  WORKDAY_END,
  WORKDAY_START,
  busyToFreeGaps,
  clampToWorkday,
  classifyDayByRanges,
  isDayFullyBusy,
  mergeBusyRanges,
  subtractRanges,
  toMinutes,
  toTimeString
};
