# T-214: flow 49 "Touch targets are 44 pt" was flaky

Red run: the nightly full e2e on auto/main 209d0f3, 2026-11-01 03:48
(e2e/out/failed/full-e2e-209d0f3-2026-11-01T01-40-48-912Z, not in git).
Failed step: `assertVisible "Back" 50x50` on a project. A rerun passed.

## Cause

Not a flake: the order of the flows, the same failure as T-213 review 1, and
already fixed by 4563c0c, a commit after 209d0f3.

- The red run's maestro.log: `Tap on point (25%,23%)`, the flow as it was at
  209d0f3. The screenshot at the failure (`step-129-assertCondition-Back.png`)
  shows iOS's share sheet, "Join the project "Macbeth" in the Rehe...", and
  Macbeth's Invite button spinning.
- Flow 03 ran before 49 in the full run. It makes the director "Macbeth", which
  has no description and is listed first, so its card is a line shorter and 23%
  of the screen is its Invite button, not its name. The tap shared an invite,
  and no "Back" came up. Flow 49 run alone, which is how the rerun went, has the
  seed's first card with a description, so 23% hits the name and the flow passes.
- 4563c0c (T-213) taps at 25%,18%. That is the card's first row (the name and
  the admin badge), which leads every card whether or not it has a description
  or an invite code. Of the flows that touch the project form, only 03 makes a
  project for the director, the user flow 49 signs in as: 02 only opens the
  form, 13 makes Dunsinane for Macduff, and 46 makes Inverness for Banquo. So
  03 then 49 is the order that gives 49 the short first card.

Nothing is changed in this task: the fix is already on auto/main.

## Red before

`red-before.txt`: flow 49 as it was at 209d0f3
(`git restore --source=209d0f3 -- e2e/flows/49-touch-targets.yaml`), after
flow 03. It fails on the same assertion as the night run.

## Green after

`green-after.txt`, on HEAD d013046:
- 03 then 49 ("Macbeth", with no description, first for the director):
  passed. This is the run that checks the fix.
- 46 then 49: passed. It does not check the short card: 46 makes Inverness for
  Banquo, and 49 signs in as the director, so it sees the seed's first card, as
  in a run of 49 alone.

The bug flow 49 guards (T-014: every target is at least 44 pt) has not come
back. In both green runs every size assertion passed: "Today", a day of the
strip, the eye, the tabs, the inbox's Back / Mark all read / Clear all, the
crosses, Mark Busy's Clear, "+" over the projects, Back on a project and in
the planner, the planner's periods, the period picker's days, and "+ Add".
