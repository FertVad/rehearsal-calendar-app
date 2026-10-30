# T-012: time and roles in the Smart Planner and the rehearsal form

Base: `ad8d513`. Simulator: iPhone 16, Honolulu; profiles in Asia/Jerusalem
(the machine). Runs on 30.10.2026 between 10:30 and 11:50 IST, when the phone
was still on the 29th and the profile on the 30th.

| # | Defect | Commit | Jest | Flow |
|---|---|---|---|---|
| 1 | "All day" slot / "Recommended Time" gave a 09:00–23:00 rehearsal | `cb6dd03` | `useAddRehearsalForm.test`, `SmartPlannerScreen.test` | 07 |
| 2 | New rehearsal at 07:00 when it was 07:02 | `cb6dd03` | `useAddRehearsalForm.test` | 26 |
| 3a | Period picker began weeks on Sunday | `a1b0d33` | `DateRangePicker.test` | 41 |
| 3b | Cancel left "Select Dates" selected | `cb6dd03` | `SmartPlannerScreen.test` | 41 |
| 3c | Picker marked the phone's today; `generateTimeSlots` defaulted to the phone's clock | `a1b0d33` | `DateRangePicker.test`, `slotGenerator.test` | 41 |
| 4 | Non-admins saw "+ Add", "Create Rehearsal", long press | `cb6dd03` | `rehearsalRights.test`, `SmartPlannerScreen.test` | 41 |

Flows and seed: `5e9dd8d`.

## Causes

1. The planner passed the slot's `startTime` and `endTime` to the form, and
   the "Recommended Time" chip passed its window to `handleTimeSelect`. Free
   time is not a rehearsal. Both now give only the start. The form keeps the
   end it was given (`chosenEnd`). If there is none, the end is the start
   plus the project's usual length (`rehearsalDefaults.ts`): the length of
   the rehearsal created last in the project, or 180 minutes if the project
   has none or its rehearsals could not be read. `useUsualDuration` reads it.
   A start moved past a chosen end makes the end follow the start again. It
   used to jump to start + 2 h.
2. The form started at `setMinutesToZero(now)`, the hour already begun. Now
   it starts at `nextRoundHour(now)`, and its date moves with it, so after
   23:00 the form opens on tomorrow at 00:00. `resetForm` uses the same rule.
3. a. `<Calendar>` had no `firstDay`. It now comes from `useWeekStart`.
   b. `handleCustomPeriodClick` set `'custom'` before any date was picked.
   The period now changes on Done. The segments carry
   `accessibilityState.selected` and ids.
   c. react-native-calendars takes "today" from the device (`XDate.today()`)
   and has no prop to change it. A day's `marking.today` overrides it, so
   `withToday` handles both days. The phone's date is unmarked, and before
   `minDate` it is disabled; the old code drew it purple and as enabled. The
   profile's date (`useToday`) is marked and gets the VoiceOver label
   "Today". The library's own "Today" word is emptied in `LocaleConfig`. The
   calendar opens on the profile's month. `generateTimeSlots` lost its
   `now = new Date()` default, and a call without `now` throws.
4. `rehearsalRights.ts` (`canScheduleIn`, `canScheduleAny`) is the client's
   copy of the server's rule: only a project admin may create a rehearsal.
   "+ Add" asks it for the planner's project. The "+" sheet and the long
   press ask whether the person is admin of any project. An action someone
   cannot take is left out (`onCreateRehearsal`/`onDayLongPress` undefined),
   not dimmed. On iOS the sheet's options are built from what is passed.

## Red before

```
# 3c  DateRangePicker.tsx at ad8d513 (+ testID date-range-calendar, date-range-cancel only)
npm run e2e -- e2e/flows/41-today-selects-today.yaml
[Failed] Today selects today (3m 23s) (Assertion is false: ".*Today.*", id: date-range-calendar.day_2026-10-30 is visible)
  -- run 2026-10-30_104621, step-089: the 29th (the phone's) drawn in the today colour,
     columns S M T W T F S
Jest (DateRangePicker.tsx at ad8d513): 5 failed - firstDay (monday, sunday), today is the
  profile's, today inside a period, opens on the profile's month

# 4   navigation/index.tsx, CalendarScreen.tsx, WeeklyCalendar.tsx, CreateActionSheet.tsx at ad8d513
[Failed] Today selects today (1m 50s) (Assertion is false: "Add Rehearsal" is not visible)
#     navigation/index.tsx alone at ad8d513
[Failed] Today selects today (1m 53s) (Assertion is false: "Create Rehearsal" is not visible)
#     SlotItem.tsx, DayCard.tsx at ad8d513
[Failed] Today selects today (2m 5s) (Assertion is false: "\+ Add" is not visible)
Jest: rehearsalRights.test does not compile at ad8d513 - TS2322 '(() => void) | undefined'
  is not assignable to '() => void' (the sheet cannot leave the action out);
  SmartPlannerScreen.test: "is shown only to an admin of the project" fails

# 3b  SmartPlannerScreen.tsx at HEAD with only setSelectedPeriod('custom') back in the tap
[Failed] Today selects today (3m 10s) (Assertion is false: id: planner-period-week, selected is visible)
Jest: ✕ Cancel in "Select Dates" › leaves the period it was

# 1, 2  useAddRehearsalForm.ts, SmartPlannerScreen.tsx, navigation/types.ts,
#       TimeRecommendations.tsx at ad8d513
npm run e2e -- e2e/flows/07-planner-project-switch.yaml e2e/flows/26-past-midnight-form.yaml
[Failed] Planner follows the project (2m 42s) (Assertion is false: ".*13:00.*", id: rehearsal-end-time is visible)
[Failed] A rehearsal made from 23:00 to 01:00 ends the next morning (1m 27s) (Assertion is false: ".*(12:00|13:00).*", id: rehearsal-start-time is visible)
Jest (useAddRehearsalForm.test): 7 failed - start 07:00 for 08:00 at 07:02, 23:00 for
  00:00 at 23:30, end 07:00 for 12:00, end 1 for 2 and 3 for 4 past midnight, the slot's
  end, the recommendation's end
  SmartPlannerScreen.test: ✕ gives the form the slot's start, and no end

# 3c  slotGenerator.ts at ad8d513
Jest: slotGenerator.test does not compile - TS2578 unused '@ts-expect-error' (now was optional)
```

The Jest red for `handleTimeSelect` called the new one-argument signature
through `as any`, so the old code failed on behaviour, not on a compile
error. The cast was removed afterwards.

## Green after (`5e9dd8d`)

```
npx jest --selectProjects frontend --silent     106 suites, 935 tests passed
npm run type-check                              clean
npm run check:secrets                           pass

npm run e2e -- e2e/flows/41-today-selects-today.yaml      [Passed] (2m 32s)  run 2026-10-30_105443:
                                                           Monday first, the 30th marked, 29th plain
npm run e2e -- e2e/flows/07-planner-project-switch.yaml   [Passed] (2m 28s)
npm run e2e -- e2e/flows/26-past-midnight-form.yaml       [Passed] (3m 5s)
npm run e2e -- e2e/flows/06-planner-to-rehearsal.yaml     [Passed] (2m 8s)
```

## Notes

- **Flow 41 and the phone's date.** Flow 41 tells the profile's today from
  the phone's only while their dates differ. In Jerusalem against Honolulu
  that is from 00:00 to 12:00. At other hours the "Today" check passes on
  the old code as well, and `DateRangePicker.test` holds the rule.
- **The "+" sheet has no Cancel.** On this iOS the action sheet shows no
  Cancel button. Flow 41 closes it with a tap beside it.
- **Long press for a non-admin.** For someone who cannot schedule, a long
  press on a day no longer opens anything. React Native's TouchableOpacity
  then takes the long press as a tap, so it picks the day.
- **Default end.** The bare form's default end was 2 hours. It is now the
  usual length, the same rule as a slot, so the two ways in agree.
- **Not run here.** The server is unchanged. `npm test` runs the server
  suites as well and was left to the supervisor's checks.
