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

So the screenshots before and after, in Russian and Spanish, are still to be
taken: on the base, flow 89 shoots `89-month-open-ru` and flow 90
`90-month-open-es` right after the month opens and then fails on its first
check — the strip under the grid (89), the grid's own title (90) — the "before";
on 74d7d57 they and `89-september-ru`, `90-september-es`, `90-september-de`
are the "after".
