# T-036 — rehearsal as a row of 88 pt with a date column (choice B)

Fix: `26302f4` on base `22933e1`. Owner 04.11, audit 29.10 s04-1.

## Before / after (iPhone 16, 393×852, the same seed — Juliet, flow 74)

- `before/74-calendar.png` — app files of `22933e1`: card of 203 pt with
  "Tomorrow" and "Admin" badges; one rehearsal whole on the screen.
- `after/74-calendar.png` — rows of 88 pt: three tomorrow's whole ("FRI 6"
  on the first only, the third without a title), the fourth beginning.
- `after/74-calendar-day-after.png` — the day after, its own "SAT 7", the
  long title cut on one line, the row still 88.
- `after/74-day-picked.png` — tomorrow picked: its three under "Tomorrow",
  no date column; the upcoming list below.

## Red before (app files `git restore --source=22933e1`, flow and seed new)

```
[Failed] The calendar's rehearsals are rows with a date column (2m 13s)
(Assertion is false: "(?s).*Masked ball.*", Size: nullx88(tolerance: 1) is visible)
```

Jest on the same old files (`RehearsalList TodayRehearsals dateFormat.test`):

```
FAIL frontend src/shared/utils/__tests__/dateFormat.test.ts        (no weekdayShort)
FAIL frontend src/features/calendar/components/__tests__/RehearsalList.test.tsx   11 of 11
FAIL frontend src/features/calendar/components/__tests__/TodayRehearsals.test.tsx
  ● should render all rehearsals  ● has no date column under the day's heading
  ● parts a rehearsal begun the evening before …  ● draws no admin badge on an admin's row
Tests:       16 failed, 52 passed, 68 total
```

## Green after (`26302f4`)

- Flow 74: `[Passed] The calendar's rehearsals are rows with a date column (2m 56s)`
  — row 88±1 (titled and untitled), eye 44×44±1 `rightOf` its row, the day
  in the first row of a day only, "10:00 AM–11:00 AM,  · Great chamber",
  no "Tomorrow"/"Admin" in the row, the day list without the column, a tap
  opens the details.
- Flows changed for the row, each passed on `26302f4`: 04, 14, 24, 26, 40,
  65, 71, 73. Run as well, unchanged: 49 (eye ≥ 44), 51 (swipe), 53 (time
  format), 57 (strip).
- `npx tsc --noEmit` clean; `npx jest --selectProjects frontend`: 132 suites,
  1248 tests passed; `npm run check:secrets`: pass.

## Flows changed, and why (not weaker)

- 04, 14, 40, 71, 73 — `seen-toggle below: "<card>"` → `rightOf: "<card>"`:
  the eye is now at the row's right, not under the card. Still the eye of
  that row: flow 74 shows `rightOf` picks the row's own eye (44×44).
- 24, 26 — `".*11:00.PM – .*, 1:00.AM.*<title>.*"` → lookaheads
  `(?=.*<title>)(?=.*11:00.PM – .*, 1:00.AM)`: the title now comes before
  the time in the row's label; both are still required.
- 65 — it checked the card's date badge "Чт, 6 нояб.". The row's date is
  now the column, "ВС, 8" (Intl's short weekday in capitals by the owner's
  choice, over the day): the flow now requires exactly the weekday and day
  of EDGE_DAY, the Samovar's — a stricter check than the case rule.

## Review (Astra) — 2 fixes

1. The palette held lime `#A3E635`, a green: ΔE from the status green said
   nothing about it being one. The test now names the families — red
   345–15°, yellow 35–70°, green 70–180°, blue 195–255°, purple 255–300°
   (HSL hue; a colour of CIELAB chroma under 15 is a grey, of none) — checks
   that each taken colour falls in its own, that lime, teal, rose and orchid
   fall in theirs, and that no palette colour does. The same rule caught
   salmon `#FDA4AF` (hue 353, a rose: red) — replaced too. New palette: pink
   `#F472B6`, cyan `#22D3EE`, copper `#B4693C`, sand `#D6B38A`, stone
   `#78716C`, silver `#E2E8F0`; all ≥ 3:1 on `bg.secondary` (lowest stone
   3.61), ≥ ΔE 25 from the taken and from each other (closest copper–sand 32).
2. In the day picked the line within a day was inset 16, not 64. Now one
   inset, `SEPARATOR_INSET` = 64, in both lists. Flow 74 checks it on the day
   picked: `rehearsal-separator-day` 289 wide (353 ground − 64), and none 337
   (the old 16).

Red before (fix files `git restore --source=HEAD` = `c06cc4a`, tests and flow new):

```
FAIL frontend src/shared/utils/__tests__/projectColor.test.ts
  ● the palette › #A3E635 is of none of those families   Received: "green"
  ● the palette › #FDA4AF is of none of those families   Received: "red"
FAIL frontend src/features/calendar/components/__tests__/RehearsalList.test.tsx
  ● the lines between rows › are inset 64 in a day’s own list too, where there is no date column
    Expected: 64   Received: 16

[Failed] The calendar's rehearsals are rows with a date column (2m 27s)
(Assertion is false: id: rehearsal-separator-day, Size: 289xnull(tolerance: 1) is visible)
```

Green after: flow 74 `[Passed] (2m 12s)`; `after/*.png` retaken from that
run (the day picked shows the line 64 in).

## Notes

- Palette (`shared/utils/projectColor.ts`): see the review above. Orange
  `#FB923C` was tried and dropped: CIELAB ΔE 18 from the status yellow.
- Separators: within a day 64 pt in, in both lists.
- The count under the eye is hidden from VoiceOver (it was inside the button,
  which says it as its value) — VoiceOver hears the same as before.
- `copy-shots.mjs` copies the latest run's screenshots here.
