import * as fixture from './entrypointFixture.mjs';

// A startup test spends at most one start, the stalled /api/ready request
// (6.5 s, the longest bounded request), one more request and a forced close in
// the fixture's own waits. Jest must allow all of them, otherwise a slow cold
// spawn under a full-suite load is cut off by Jest's default 5 s instead.
test('the startup test budget covers the fixture\'s own bounded waits', () => {
  const { fixtureStartTimeoutMs, fixtureRequestTimeoutMs, fixtureCloseTimeoutMs, fixtureTestTimeoutMs } = fixture;
  for (const budget of [fixtureStartTimeoutMs, fixtureRequestTimeoutMs, fixtureCloseTimeoutMs, fixtureTestTimeoutMs]) {
    expect(Number.isFinite(budget) && budget > 0).toBe(true);
  }
  const jestDefaultMs = 5000;
  expect(fixtureTestTimeoutMs).toBeGreaterThan(jestDefaultMs);
  expect(fixtureTestTimeoutMs).toBeGreaterThan(fixtureStartTimeoutMs + 6500 + fixtureRequestTimeoutMs + fixtureCloseTimeoutMs);
});
