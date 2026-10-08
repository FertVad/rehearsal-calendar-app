/**
 * When a subscription limit lifts, read from what Claude Code or Codex said
 * when it refused.
 *
 * Both CLIs report the moment, in two ways. Structured: Claude's stream-json
 * emits {type:"rate_limit_event", rate_limit_info:{status:"rejected",
 * resetsAt}}, Codex's events carry `resets_at` — seconds since the epoch. And
 * as text: Claude "You've hit your session limit · resets 5pm (Asia/Jerusalem)"
 * or "… · resets Oct 9, 3pm (…)"; Codex "You've hit your usage limit. … Try
 * again at 5:04 PM." or "try again in 2 hours 13 minutes". Times in the text
 * are the machine's local time, which is where this runs.
 *
 * Nothing here guesses silently: a limit whose end cannot be read comes back
 * with `known: false`, and the caller checks again after FALLBACK_MS.
 */

export const FALLBACK_MS = 20 * 60 * 1000;
/** Resume a little after the reset, not at the stroke of it. */
export const MARGIN_MS = 2 * 60 * 1000;

// Subscription and rate limits only. "Context limit reached" is the
// conversation outgrowing its window: waiting does not lift it.
const LIMIT_TEXT = /hit your (?:session |weekly |usage |opus |sonnet |fast )?limit|(?:usage|rate) limit (?:reached|exceeded)|out of extra usage|try again (?:at|in)\b/i;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Seconds or milliseconds since the epoch, as a Date; anything else, null. */
function epoch(value) {
  const n = typeof value === 'string' && /^\d+(\.\d+)?$/.test(value) ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
  return new Date(n > 1e12 ? n : n * 1000);
}

/** "5pm", "5:30pm", "5:04 PM" → [hours, minutes] on a 24-hour clock, or null. */
function clock(text) {
  const m = /(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?/i.exec(text) || /\b(\d{1,2}):(\d{2})\b/.exec(text);
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = m[2] ? Number(m[2]) : 0;
  if (m[3]) {
    const pm = m[3].toLowerCase() === 'p';
    if (hours === 12) hours = pm ? 12 : 0;
    else if (pm) hours += 12;
  }
  if (hours > 23 || minutes > 59) return null;
  return [hours, minutes];
}

/** The moment named after "resets" / "try again at", relative to `now`. */
function when(phrase, now) {
  const time = clock(phrase);
  if (!time) return null;
  const date = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/i.exec(phrase);
  if (date) {
    const month = MONTHS.indexOf(date[1].toLowerCase());
    const year = date[3] ? Number(date[3]) : now.getFullYear();
    const at = new Date(year, month, Number(date[2]), time[0], time[1]);
    // "Jan 2" read in late December without a year is next year's.
    if (!date[3] && at < now) at.setFullYear(year + 1);
    return at;
  }
  // A time alone is the next time the clock shows it.
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), time[0], time[1]);
  if (at <= now) at.setDate(at.getDate() + 1);
  return at;
}

/** "2 hours 13 minutes", "45s", "1h 5m" → milliseconds, or null. */
function duration(phrase) {
  const units = { d: 86400, h: 3600, m: 60, s: 1, ms: 0.001 };
  let seconds = 0;
  let found = false;
  for (const m of phrase.matchAll(/(\d+(?:\.\d+)?)\s*(ms|milliseconds?|s|secs?|seconds?|m|mins?|minutes?|h|hrs?|hours?|d|days?)\b/gi)) {
    const unit = m[2].toLowerCase();
    const key = unit.startsWith('ms') || unit.startsWith('milli') ? 'ms' : unit[0];
    seconds += Number(m[1]) * units[key];
    found = true;
  }
  return found ? seconds * 1000 : null;
}

/**
 * Whether `text` is a refusal for a limit, and when it lifts.
 * @returns {{limited: boolean, known?: boolean, at?: Date}}
 */
export function limitFromText(text, now = new Date()) {
  if (typeof text !== 'string' || !LIMIT_TEXT.test(text)) return { limited: false };
  const pipe = /limit reached\|(\d{10,13})/i.exec(text);
  if (pipe) return { limited: true, known: true, at: epoch(pipe[1]) };
  const resets = /\bresets?\s+(?:at\s+)?([^·\n]+?)(?:\s*\(|\s*·|$)/i.exec(text);
  const at = /\btry again at\s+([^\n]+?)(?:\.\s|\.$|$)/i.exec(text);
  const phrase = (resets && resets[1]) || (at && at[1]);
  if (phrase) {
    const moment = when(phrase, now);
    if (moment) return { limited: true, known: true, at: moment };
  }
  const inPhrase = /\btry again in\s+([^\n.]+)/i.exec(text) || /\bresets in\s+([^\n.·]+)/i.exec(text);
  if (inPhrase) {
    const ms = duration(inPhrase[1]);
    if (ms != null) return { limited: true, known: true, at: new Date(now.getTime() + ms) };
  }
  return { limited: true, known: false };
}

/**
 * Claude Code stream-json events: a rejected rate_limit_event, or a result
 * whose text is a limit refusal.
 */
export function limitFromClaudeEvents(events, now = new Date()) {
  let structured = null;
  for (const event of events) {
    const info = event && event.type === 'rate_limit_event' ? event.rate_limit_info : null;
    if (info && info.status === 'rejected') {
      const at = epoch(info.resetsAt);
      structured = { limited: true, known: Boolean(at), ...(at && { at }) };
    }
  }
  if (structured) return structured;
  const result = [...events].reverse().find((event) => event && event.type === 'result');
  if (result && result.is_error) return limitFromText(String(result.result ?? ''), now);
  return { limited: false };
}

/**
 * Codex --json events: an error or failed turn whose message is a limit
 * refusal; `resets_at` anywhere on it is preferred over the wording.
 */
export function limitFromCodexEvents(events, now = new Date()) {
  for (const event of [...events].reverse()) {
    if (!event) continue;
    const failure = event.type === 'error' || event.type === 'turn.failed' ? event : null;
    if (!failure) continue;
    const message = String(failure.message ?? failure.error?.message ?? '');
    const found = limitFromText(message, now);
    const resetsAt = epoch(failure.resets_at ?? failure.error?.resets_at);
    if (resetsAt && (found.limited || /usage_limit|rate_limit/i.test(JSON.stringify(failure)))) {
      return { limited: true, known: true, at: resetsAt };
    }
    if (found.limited) return found;
  }
  return { limited: false };
}

/** How long to wait before trying again, never negative. */
export function waitFor(limit, now = new Date()) {
  if (!limit.limited) return 0;
  if (!limit.known) return FALLBACK_MS;
  return Math.max(0, limit.at.getTime() - now.getTime()) + MARGIN_MS;
}
