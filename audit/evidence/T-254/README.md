# T-254 — the month opens out of the strip

Fix: 74d7d57. Base: 8110068.

## Jest

`jest-red-before.txt`: the seven tests of "The month opened out of the strip"
fail on the base's WeeklyCalendar, DayCalendar and translations (the strip
stays under the grid, no arrows in the header), the 22 older ones pass; on
74d7d57 all 29 pass, and the frontend project's 1416.

## e2e — not run by the developer

Flows 89 (Russian) and 90 (Spanish, German) are new, 57 has one more check.
They were not run here, red or green: both attempts
(`npm run e2e -- e2e/flows/89-… e2e/flows/90-…`) were stopped at the tool's
10 minutes inside the runner's own preparation, before any flow. The stand
was regenerating `e2e/.native` (`inputs.sha256` absent), and `pod install`
was downloading React Native's prebuilt core, 78.5 MB at about 90 KB/s —
some 15 minutes on its own (`e2e/out/prepare.log`: "Invalid `Podfile` file:
SIGTERM" at 26 % both times), with the Debug build still to come. That is
the machine, not the change; the supervisor's checks run these flows.

## The supervisor's checks on 1726cf4: 57 and 89 red

Both failed at `calendar-day-2026-11-25 selected`: a day picked in the month
folded the grid back, but the strip stayed on the day selected before. The
strip is mounted again, and the scroll to the day picked was asked for in its
mount's effect; VirtualizedList (RN 0.81, `_maybeScrollToInitialScrollIndex`)
goes to `initialScrollIndex` only later, unanimated, when its content is laid
out, and undid it. Jest's FlatList mock did not do that, so Jest was green.

Fix be69d57: the day picked waits for the strip's `onContentSizeChange`,
which the list calls after its own scroll. The mock now goes to
`initialScrollIndex` as React Native does.

- `jest-red-before-pick.txt`: two tests red on 1726cf4, all 29 green after.
- e2e flow 89 on 1726cf4's WeeklyCalendar.tsx (`git restore --source=1726cf4`):
  `[Failed] … calendar-day-2026-11-25, selected is visible` —
  `89-day-in-strip-ru-before.png`: Ноябрь, the strip on 13 (today), not 25.
- On be69d57: 89 and 57 `2/2 Flows Passed` — `89-day-in-strip-ru-after.png`
  (25 under the frame), `89-month-open-ru-after.png`, `89-september-ru-after.png`.
- Spanish and German, from the supervisor's run on 74d7d57 (flow 90 passed;
  be69d57 does not touch the header): `90-month-open-es-after.png`,
  `90-september-es-after.png`, `90-september-de-after.png`.

- The base (8110068's WeeklyCalendar, DayCalendar, translations restored, then
  back to HEAD): 89 `[Failed] calendar-strip is not visible`, 90
  `[Failed] calendar-month-grid.header … 20[0-9][0-9] is not visible` —
  `89-month-open-ru-before.png`, `90-month-open-es-before.png`: the name twice,
  the strip under the grid as a seventh row. Against `…-after.png`: one name,
  arrows in the card's header, no strip.

The plan for those screenshots, as written before they were taken: on the base, flow 89 shoots `89-month-open-ru` and flow 90
`90-month-open-es` right after the month opens and then fails on its first
check — the strip under the grid (89), the grid's own title (90) — the "before";
on 74d7d57 they and `89-september-ru`, `90-september-es`, `90-september-de`
are the "after".
