# T-022 — onboarding

Base `78065ae`. Fix `1d848f8`, flows `c44bf88` and the commit after it.

| Point | What changed | Proved by |
|---|---|---|
| 1 Greeting | `WelcomeScreen`: the step's title is `welcome.greeting(firstName)`, "Welcome, Nina!"; the "Nina!" and "Rehearsly" lines under it are gone | `WelcomeScreen.test.tsx`, flow 09 |
| 2 No week-start step | `WeekStartScreen`, `WeekPreview` and the `weekStart` texts removed. `phoneWeekStart()` (`hooks/useWeekStart.ts`): `getCalendars()[0].firstWeekday === 1` → Sunday, else Monday; written by the last step's button, where the old step wrote it, then onboarding ends. The profile changes it as before | `WhatWhereScreen.test.tsx`, flow 09 (Profile: Sunday on en_US) |
| 3 Calendar step | Description of two sentences carries the privacy promise; the privacy box, the pick hint and the outcome box are gone. The card: Grant Access, or the calendars. "Set up later" is a 44 pt glass button (goes on to Notifications) with "… Profile → Calendar Sync" under it, built from `nav.profile` and `calendarSync.title`; shown only while no calendar is connected. "No calendars found", "Setting up calendar sync…" translated. The card's id is `onboarding-calendar-connected` once a calendar is saved (HP05, flow 32 reads it instead of the outcome text) | `CalendarSyncScreen.test.tsx`, flows 09, 32 |
| 4 One bar | `OnboardingStep`: `secondaryAction` ends the content (with an optional `note`), never the footer; "Skip" and "Next" are `t.onboarding.skip`/`next` | `OnboardingStep.test.tsx`, flow 09 ("Not now" above `onboarding-footer`) |
| 5 What's where | `WhatWhereScreen`: four rows — `actionSheet.createProject` + `nav.projects` → `projects.haveInvite`; `actionSheet.createRehearsal`, for admins; `actionSheet.markBusy`; `smartPlanner.title` under the calendar. "+" icon (`add-circle`) for the three behind the + tab, `bulb` as on the planner's button. "Get Started" | `WhatWhereScreen.test.tsx` (all four languages), flow 09 |

No VoiceOver work. `skipMessage` (the Skip alert) is unchanged.

## Red before, green after

- `jest-red-before.txt`: the base's source under the new tests — 10 fail, and
  three suites do not compile against the base (no `note`, no `WhatWhere`, no
  `phoneWeekStart`).
- `e2e-red-before.txt`: flow 09 on the base fails at "Welcome, Nina!".
- `green-after.txt`: the tests, type-check, flows 09 and 32.
- `push-test-red-green.txt`: the supervisor's run failed on
  `useNotifications.push.test.tsx`, which still expected the removed
  `WeekStart` step after Notifications; it now expects `WhatWhere`. Red on the
  base's onboarding, green on HEAD.
