// The wordings below are the ones the installed CLIs produce: Claude Code
// 2.1.74 (cli.js: XP6/Qj6) and Codex 0.160.1 (UsageLimitExceeded).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  limitFromText, limitFromClaudeEvents, limitFromCodexEvents, waitFor, waitOver, FALLBACK_MS, MARGIN_MS, MEMORY,
} from '../lib/limits.mjs';

// 8 October 2026, 14:20 local time.
const NOW = new Date(2026, 9, 8, 14, 20);
const local = (...parts) => new Date(...parts).getTime();

test('Claude: a session limit that resets later today', () => {
  const found = limitFromText("You've hit your session limit · resets 5pm (Asia/Jerusalem)", NOW);
  assert.deepEqual([found.limited, found.known], [true, true]);
  assert.equal(found.at.getTime(), local(2026, 9, 8, 17, 0));
});

test('Claude: minutes, and a time already past today means tomorrow', () => {
  assert.equal(limitFromText("You've hit your usage limit · resets 5:30pm (Asia/Jerusalem)", NOW).at.getTime(),
    local(2026, 9, 8, 17, 30));
  assert.equal(limitFromText("You've hit your session limit · resets 9am (Asia/Jerusalem)", NOW).at.getTime(),
    local(2026, 9, 9, 9, 0));
});

test('Claude: a weekly limit more than a day away carries its date', () => {
  assert.equal(limitFromText("You've hit your weekly limit · resets Oct 13, 3pm (Asia/Jerusalem)", NOW).at.getTime(),
    local(2026, 9, 13, 15, 0));
  assert.equal(limitFromText("You've hit your weekly limit · resets Jan 2, 2027, 10am (Asia/Jerusalem)", NOW).at.getTime(),
    local(2027, 0, 2, 10, 0));
});

test('Claude: the older "limit reached|<epoch>" form', () => {
  const found = limitFromText('Claude AI usage limit reached|1791118800', NOW);
  assert.equal(found.at.getTime(), 1791118800 * 1000);
});

test('Claude: the structured rate_limit_event wins over the text', () => {
  const events = [
    { type: 'system', subtype: 'init', session_id: 's1' },
    { type: 'rate_limit_event', rate_limit_info: { status: 'allowed_warning', resetsAt: 1 } },
    { type: 'rate_limit_event', rate_limit_info: { status: 'rejected', resetsAt: 1791118800, rateLimitType: 'five_hour' } },
    { type: 'result', is_error: true, result: "You've hit your session limit · resets 5pm (Asia/Jerusalem)" },
  ];
  const found = limitFromClaudeEvents(events, NOW);
  assert.equal(found.at.getTime(), 1791118800 * 1000);
});

test('Claude: an ordinary failure is not a limit', () => {
  assert.deepEqual(limitFromClaudeEvents([{ type: 'result', is_error: true, result: 'Tool use failed' }], NOW), { limited: false });
  assert.deepEqual(limitFromClaudeEvents([{ type: 'result', is_error: false, result: 'Done' }], NOW), { limited: false });
  // The conversation outgrowing its window is not a limit to wait out.
  assert.deepEqual(limitFromText('Context limit reached · /compact or /clear to continue', NOW), { limited: false });
});

test('Codex: try again at a time', () => {
  const text = "You've hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at 5:04 PM.";
  assert.equal(limitFromText(text, NOW).at.getTime(), local(2026, 9, 8, 17, 4));
});

test('Codex: try again at a dated time', () => {
  const text = "You've hit your usage limit. Try again at Oct 9th, 2026 8:15 AM.";
  assert.equal(limitFromText(text, NOW).at.getTime(), local(2026, 9, 9, 8, 15));
});

test('Codex: try again in a duration', () => {
  assert.equal(limitFromText("You've hit your usage limit. Try again in 2 hours 13 minutes.", NOW).at.getTime(),
    NOW.getTime() + (2 * 60 + 13) * 60 * 1000);
  assert.equal(limitFromText('Rate limit reached. Please try again in 20s.', NOW).at.getTime(), NOW.getTime() + 20000);
});

test('Codex: resets_at on the failure is preferred', () => {
  const events = [
    { type: 'thread.started', thread_id: 't1' },
    { type: 'turn.failed', error: { message: "You've hit your usage limit. Try again at 5:04 PM.", resets_at: 1791118800 } },
  ];
  assert.equal(limitFromCodexEvents(events, NOW).at.getTime(), 1791118800 * 1000);
});

test('Codex: a limit with no readable time is still a limit', () => {
  const found = limitFromCodexEvents([{ type: 'error', message: "You've hit your usage limit." }], NOW);
  assert.deepEqual(found, { limited: true, known: false });
  assert.equal(waitFor(found, NOW), FALLBACK_MS);
});

test('Codex: other failures are not limits', () => {
  assert.deepEqual(limitFromCodexEvents([{ type: 'turn.failed', error: { message: 'stream disconnected' } }], NOW), { limited: false });
});

test('waiting: until the reset plus a margin, never negative', () => {
  const soon = { limited: true, known: true, at: new Date(NOW.getTime() + 60000) };
  assert.equal(waitFor(soon, NOW), 60000 + MARGIN_MS);
  const past = { limited: true, known: true, at: new Date(NOW.getTime() - 60000) };
  assert.equal(waitFor(past, NOW), MARGIN_MS);
  assert.equal(waitFor({ limited: false }, NOW), 0);
});

test('a wait for memory ends when the pressure is normal, not at its hour', () => {
  const now = NOW.getTime();
  const memory = { waitUntil: now + 60 * 60 * 1000, waitingFor: MEMORY };
  assert.equal(waitOver(memory, now, () => 1), true);
  assert.equal(waitOver(memory, now, () => 2), false);
  assert.equal(waitOver(memory, now, () => 4), false);
  assert.equal(waitOver(memory, memory.waitUntil, () => 2), true);
});

test('a limit or an e2e machine waits for its hour whatever the memory', () => {
  const now = NOW.getTime();
  for (const waitingFor of ['Claude', 'Codex', 'e2e']) {
    const wait = { waitUntil: now + 60000, waitingFor };
    assert.equal(waitOver(wait, now, () => 1), false, waitingFor);
    assert.equal(waitOver(wait, now + 60000, () => 1), true, waitingFor);
  }
  assert.equal(waitOver({ waitUntil: null, waitingFor: null }, now, () => 4), true);
});
