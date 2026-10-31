# T-017 — times on the phone's 12 or 24 hours, one way to write an interval

Base `286a058` (auto/main with `88c62a6`, expo-localization ~17.0.9). Fix
`f3b92ce`, flows `9b8b8ae`.

| Point | What changed | Proved by |
|---|---|---|
| 1 12/24 hours | `shared/utils/clockFormat.ts`: `formatClock` reads `getCalendars()[0].uses24hourClock` on every call; 24 h shows the stored "HH:MM", 12 h formats it with Intl in the app's language ("6:00 PM"). Every time on the screens goes through it: cards, details, the project page (`rehearsalTimeLabel`), the form's start and end, recommendations, planner slots, participants' busy hours, the availability editor and its overlap error, the delete confirmation. The wheel gets `timePickerLocale`: the app's language with `@hours=h23`/`h12` (iOS ignores `is24Hour`); Android gets `is24Hour` | `clockFormat.test.ts`, `PickerModal.test.tsx`, flow 53 |
| 2 Five minutes | `minuteInterval={5}` on the time wheel. A value off the step (10:07) opens as it is and goes back unchanged on Done unless the wheel is turned: the draft is the owner's value until then | `PickerModal.test.tsx` |
| 3 One interval | `formatRange('time')` "18:00–21:00", `formatRange('date')` "Oct 29 – Nov 4"; a rehearsal ending on another day has a date in it: "23:00 – Sep 11, 01:00". The planner's period is `formatDateRange` (no more "29-31 Oct" / "29 Oct - 4 Nov") | `clockFormat.test.ts`, the updated screen tests, flows 05, 07, 23, 24, 26, 39 |

Unchanged: storage and requests ("HH:MM", ISO), server notification texts,
testIDs (`planner-add-<date>-<HH:MM>`). No VoiceOver work.

## How the two formats are shown on the simulator

The e2e simulator is en_US (run.mjs), so 12-hour, as such a phone is. Flow 53
signs in as it comes and reads 12-hour times and an AM/PM wheel; then launches
again with `arguments: { AppleICUForce24HourTime: "<true/>" }` — the key
Settings → 24-Hour Time writes, which iOS reads among the user defaults — and
reads "18:00–21:00" and a wheel without AM/PM (screenshots `53-*`). With `"YES"`
the app stayed 12-hour: a launch argument is parsed as a property list, and
"YES" is a string. The other flows that read times now read the 12-hour form
("6:00.PM", "." for ICU's narrow space); the seed's `WATCH_TOKYO_TIME`,
`WEEK_CHOSEN_LABEL` and `next-hour.js` give patterns of that form.

## Red before, green after

- `jest-red-before.txt`: the base's eleven source files under the new tests:
  11 fail in 9 files (`clockFormat.ts` itself kept, so the red is the screens',
  not a missing import).
- `e2e-red-before.txt`: flow 53 on those files fails at the 12-hour card.
- `jest-green-after.txt`, `e2e-green-after.txt`: the task's tests, and every
  flow it changed (05, 07, 10, 23, 24, 25, 26, 27, 39, 45, 51, 52, 53).

## Review r1 (fix `f833150`, flow `3204da7`)

| Remark | Cause and change | Proved by |
|---|---|---|
| 10:07 shown as 10:05 on the wheel | UIKit rounds the wheel to `minuteInterval` (`roundsToMinuteInterval`, not exposed by the module); the draft kept 10:07, the wheel showed 10:05. `wheelMinuteInterval`: five for a time on the step, one for a time off it | `PickerModal.test.tsx`; flow 54 (Storm scene at 10:07: wheel "07 minutes", saved 10:07; a new one's next row is "05 minutes") |
| An open form mixes two formats after the setting changes | The setting was read by a default argument in each render: nothing rendered again on the phone's change, and the form's memoized busy and conflict lines kept the old format. `usePhoneUses24HourClock` (expo-localization's `useCalendars`, which renders again on the phone's calendar event) in every screen that shows a time, passed on to the helpers and into the memos' deps; `busyText` and `rehearsalTimeLabel` take it. `phoneUses24HourClock` stays for alerts, written once at the tap | `AddRehearsalScreen.test.tsx` and `PickerModal.test.tsx` with the mock firing the listener |

The change while the app is open is proved in Jest, not on the simulator: the
only way a flow sets 24-hour time is a launch argument (flow 53), which needs a
relaunch, and Maestro cannot open Settings → General → Date & Time. On the
phone, `useCalendars` listens to `NSLocale.currentLocaleDidChangeNotification`
(expo-localization's `LocalizationModule.swift`), which iOS posts when that
switch is turned.

Files: `r1-jest-red-before.txt`, `r1-e2e-red-before.txt`, `r1-green-after.txt`.

## node_modules

An `npm install expo-localization` in the first session of this task (before
the owner's commit) left this tree's node_modules short of 1 044 files in 27
packages (`@react-navigation/*` declarations and sources, `hermes-parser`, …):
type-check and two navigation tests failed, Metro could not bundle. They were
copied back from the main tree's copy of the same versions (no file
overwritten; afterwards no package here differs from the main tree's).
package.json and the lock were not touched.
