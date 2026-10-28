import limits from '../../shared/contracts/memberAvailabilityLimits.json' with { type: 'json' };

const DAY_MS = 86400000;
export { limits };

export function availabilityBudgetError() {
  return Object.assign(new Error('Availability request is too large; select fewer days or members'), {
    status: 422, code: 'AVAILABILITY_BUDGET_EXCEEDED',
  });
}

function invalid(message) {
  throw Object.assign(new Error(message), { status: 400 });
}

function civilDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) {
    invalid('Dates must be real calendar dates in YYYY-MM-DD format');
  }
  const ms = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) {
    invalid('Dates must be real calendar dates in YYYY-MM-DD format');
  }
  return ms;
}

export function positiveId(value) {
  // These identifiers are PostgreSQL INTEGER/SERIAL, not JavaScript floats.
  if (typeof value !== 'string' || value.length > 10 || !/^[1-9]\d*$/.test(value) ||
      Number(value) > 2147483647) invalid('Identifiers must be positive 32-bit integers');
  return Number(value);
}

// Constant work for dates; bounded work for an explicitly supplied member list.
// Deliberately does not create the dates array: authorization comes first.
export function parseMemberAvailabilityQuery(query) {
  const { date, startDate, endDate, userIds, excludeRehearsalId } = query;
  if (date !== undefined && (startDate !== undefined || endDate !== undefined)) {
    invalid('Use either date or startDate and endDate');
  }
  if (date === undefined && (startDate === undefined || endDate === undefined)) {
    invalid('Either date or both startDate and endDate are required');
  }
  const first = date ?? startDate;
  const last = date ?? endDate;
  const startMs = civilDate(first);
  const endMs = civilDate(last);
  const dayCount = (endMs - startMs) / DAY_MS + 1;
  if (dayCount < 1 || dayCount > limits.maxDays) {
    invalid(`Date range must contain 1 to ${limits.maxDays} days`);
  }
  let requestedIds;
  if (userIds !== undefined) {
    if (typeof userIds !== 'string' || userIds.length > limits.maxMembers * 17) {
      invalid(`Select at most ${limits.maxMembers} members`);
    }
    const parts = userIds.split(',');
    if (parts.length > limits.maxMembers) invalid(`Select at most ${limits.maxMembers} members`);
    requestedIds = [...new Set(parts.map(part => positiveId(part.trim())))];
  }
  const excludedId = excludeRehearsalId === undefined ? undefined : positiveId(excludeRehearsalId);
  return { first, last, startMs, dayCount, requestedIds, excludedId };
}

export function expandMemberAvailabilityDates({ startMs, dayCount }) {
  return Array.from({ length: dayCount }, (_, i) => new Date(startMs + i * DAY_MS).toISOString().slice(0, 10));
}
