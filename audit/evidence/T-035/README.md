# T-035 — the day strip as a time wheel

Fix: `afe9083` (base `22933e1`). Files: `WeeklyCalendar.tsx`, `haptics.ts`
(`hapticSelection`), `WeeklyCalendar.test.tsx`, `e2e/flows/74-day-strip-wheel.yaml`.

## Red before
- `jest-red-before.txt` — 6 new tests fail on the old component: no ticks
  (0 of 3), a medium thump on tap and "Today", an interrupted scroll's stop
  taken as the day (13th instead of the tapped 14th), no frame.
- `e2e-74-red-before.txt` — flow 74 on the old code: `calendar-strip-frame is
  visible` is false. `step-045-assertCondition-calendar-strip-frame-before.png`
  is the screen then: the fill on the picked cell, chips on every day, no frame.

## Green after
- `jest-green-after.txt` — 17/17 in the strip's suite; the frontend project
  1217/1217; `tsc --noEmit` clean.
- Flow 74 passed (twice, before and after the commit); flows 57, 41, 49 —
  which walk the strip — passed one by one on `afe9083`. A first run of 57
  failed at sign-in with "No connection to the server" just after a run cut
  off by the 10-minute tool limit; it passed when run again.
- `74-strip-today-after.png`, `74-tapped-day-in-frame-after.png`,
  `74-swipe-stopped-after.png` — the frame in the middle with the day in it;
  `74-strip-wheel-after.mp4` — the flow's recording: a tap, "Today", a swipe.
- `collect.mjs` copied these from `e2e/out/artifacts`.

## Review 1 (`1f38405`)
Two points: a tap, "Today" and the month handed their day to the list at
once, while the frame still had the day before; and one scroll event jumping
several days gave one tick. Now the animation's target is kept apart from the
choice: the day is handed on only where the strip stops on it (Today as today
to follow), and the centre ticks once for every day crossed.
- `review-1-jest-red-before.txt` — the new and amended tests on the
  component of `20424cc`: 4 of 20 fail, on both points.
- `review-1-green-after.txt` — 20/20, the frontend 1220/1220, type-check;
  flows 74, 41, 57 passed. On the device flow 74's tap reaches the list only
  through the stop of the animated scroll (`onMomentumScrollEnd`), so its
  pass is the check that the stop does come. The list's state mid-motion is
  not seen by Maestro, which reads the screen only at rest; Jest holds it, and
  no red e2e is possible for it.

Not reproducible in the simulator: the haptic ticks themselves (Jest holds
them), and the strip mid-motion (Maestro reads the screen only at rest; the
recording shows it).
