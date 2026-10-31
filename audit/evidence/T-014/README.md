# T-014: touch targets at least 44×44 pt

UX audit 29.10.2026; owner 30.10: "make it 44". HIG accessibility: 44×44 pt on
iOS, and spacing between controls as important as size.

## Cause

There was no rule. Every screen drew its own icon button and its own small
text buttons, each with its own padding: back arrows 24×24 with none, crosses
24–32, the inbox's actions 38×38, the projects' "+" 36×37; "Today" 53×24,
"+ Add" 63×29, the planner's periods 35 tall, the eye 57×33, days of the week
42 wide, the tabs 43 tall.

## Fix (724a80f)

- `TouchTarget = 44` in `shared/constants/spacing.ts` — the one number.
- `shared/components/IconButton.tsx`: the icon at its size, the target at
  least 44 a side whatever style is passed (the size style is applied last;
  `minSize` may raise it, never lower it), `accessibilityLabel` a required
  prop, `accessibilityRole="button"`. All 27 icon buttons go through it, the
  bell too (its count is a child).
- `iconButtonLabels.test.ts` now also refuses a touchable with an icon and no
  text made anywhere but `IconButton`, and an `IconButton` without a label.
- Text and other targets measured where they stand and raised to
  `minHeight: TouchTarget`: "Today" (pill inside a 44 pt target), the week's
  days (the whole seventh is the target, the gap drawn inside: 46 wide), eye,
  "+ Add", periods, slot times, filter/picker/language/timezone rows, time
  picker Cancel/Done, participants Done (was a hitSlop past its header),
  "Show older"/retry, project section toggles, invite/share/code rows, edit
  profile, sync and onboarding buttons, form inputs, tabs (bar height =
  paddings + 44). Headers whose padding the 44 made redundant give it back.
- Neighbours side by side, no overlapping hitSlop: the card's delete and edit
  stand in a row with 4 pt between them; the inbox actions 4 pt apart.
- The rehearsal sheet: iOS draws it at ~0.955 while at 3/4 height; its 44 pt
  cross measured 42 on the glass, so it asks for 47 (45 measured).

## Red before / green after

`red-before.txt`: the new Jest tests and flow 49 on the base code — 27
hand-made icon buttons listed, no `IconButton`; the flow stops at "Today"
53×23. `green-after.txt`: the same green, and 21 flows the change reaches.
`measurements.txt`: every target before and after, from Maestro's hierarchy.

## Not changed

VoiceOver: no new labels or checks (owner, 30.10). The system UISwitch on the
profile (63×28 frame) and the sheet grabber are iOS's own.
