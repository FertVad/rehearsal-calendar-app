# T-014 review 1 (Astra): three P2, fixed in ba3413e, flow in 51a0313

## 1. The period picker's days were 38×34

Cause: `DateRangePicker` draws the library's `PeriodDay`, which takes the tap
on what it draws — 38×34 — and has no hit area of its own. On a 320 pt screen
its column was 39 wide as well (sheet margin 16 + calendar padding 5).

Fix: the library's `stylesheet.day.period` theme pads the day's container to
44×44 around the same 38×34 drawing (the period band set down by the same
padding, so it stays behind the day); the week's vertical margin 7 → 2 gives the padding back, so a month
is as tall as before and rows keep 4 pt between targets. The calendar runs to
the sheet's edges and the sheet's side margin is
`min(16, (screen − 7·44) / 2)` — 16 on every phone but 320 pt, 6 there.

Red / green, flow 49 (Maestro hierarchy, iPhone 393 pt):

| day                       | before (71a50f8) | after          |
|---------------------------|------------------|----------------|
| Oct 3 (unmarked)          | 38×34            | 44×44 (passed) |
| Oct 31 (today, marked)    | 51×34            | 51×44 (passed) |

`red-review-1.txt` — the flow fails at `date-range-calendar.day_2026-10-31`
with the old picker; `green-review-1.txt` — it passes with the fix.

## 2. A week did not fit seven days of 44 on a 320 pt screen

Cause: the strip's page and step were a guess from the screen's width
(`screen − 64`), six points off what the list was laid out at (`screen − 58`),
with 2 pt more padding inside the page; and `minWidth: 44` on a day made seven
days ask 308 of 252, so the ends left their page.

Fix: the page and the step (`getItemLayout`, the scroll's index) are the
list's measured width (`onLayout`; before layout, the same sum). A day is a
seventh of the page, no `minWidth`, no padding around the days. The card's
side padding is 4, and where the screen's 20 pt margin leaves less than 308
for the days the card reaches into it (`cardReach`): on 320 pt by 19, the
strip 308, a day 44. On 393 pt nothing reaches; a day is 49.

Red / green: `WeeklyCalendar.test` "fits seven days of 44 pt on a 320 pt
screen": before — the strip 262 (< 308); after — the strip 308, the page and
the step both 308.

## 3. The eye was a hand-made Pressable, and the rule let it by

Cause: `iconButtonLabels.test` took any `<Text` in a touchable as text; the
eye's count is `{seenLabel && <Text>}`, absent until someone has seen it, and
then the button is an icon alone.

Fix: text under a condition of its own (a brace group with text and no icon)
no longer counts; text in the same branch as the icon still does (four
"spinner or icon+text" buttons stay accepted). The eye is an `IconButton`
with its count as a child. `TodayRehearsals.test` found the eye by type
`Pressable` (and passed silently when it found none); it finds it by
`seen-toggle` now.

Red / green: before — `features/calendar/components/RehearsalCard.tsx:153`
refused; after — none.

## Not changed

VoiceOver (owner, 30.10). The library's month arrows already take the tap
past 44 with their own `hitSlop` of 20 and have no neighbour under it.
