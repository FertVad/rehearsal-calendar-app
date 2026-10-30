# T-011: visible interface defects from the UX audit of 29.10.2026

Base: `71c3b41`. Simulator: iPhone 16 (393×852 pt), Honolulu. Each fix has
its own commit. Every red run below kept the fix's flow, test and seed and put
only the fix's own files back to `71c3b41`, then restored them from `HEAD`.

| # | Defect | Commit | Jest | Flow |
|---|---|---|---|---|
| 1 | Wrong invite code: "Try another code" black on #0d1117 | `5b614ad` | `JoinProjectScreen.test` | 08 |
| 2 | Conflict warning hard-coded in Russian | `55a0f01` | `conflictMessage.test` | 07 |
| 3 | Help without onPress; version "1.0.0" in code | `62dfb8e` | `ProfileScreen.about.test`, server `legalPageLanguage.test` | 44 |
| 4 | Onboarding examples were button labels, framed | `86c693b` | `NotificationsScreen.test` | 09 |
| 5 | Count badges over Fri/Sat/Sun | `4d26301` | `WeeklyCalendar.test` | 41 (screenshot) |
| 6 | Calendar 60 pt down after back from the planner | `c43b105` | `useRehearsals.test` | 07 |
| 7 | Honolulu "(UTC)"; static offsets | `d4738aa` | `timezones.test` | 23 |

## Causes

1. The typed-code path ended on the link's full-screen error, its button
   without `primaryButton`/`primaryButtonText`. A typed code now stays on its
   form: the error goes under the field and the code stays in it. The same
   code sent again is asked again, because the request no longer waits on a
   change of `code`. A link's error keeps its screen, with Close drawn as a
   button.
2. `formatConflictMessage` built the Russian text itself. It now takes the
   translations: `rehearsals.busyAtThisTime(names, count)` in all four
   languages, and `projects.member` for a member with no name.
3. The Help row had no `onPress`. It opens `/support?lang=<language>` on the
   server the API runs on (the site and API share one origin): rehearsly.me in
   production, the local server in e2e. `legal.js` read `?lang` nowhere. It now
   puts it first, as `i18n.js` on the landing page already did. The version
   comes from `expoConfig.version`.
4. The examples were `t.rehearsals.addRehearsal`/`updateRehearsal` shown in
   bordered, filled boxes. They are now `onboarding.notifications.exampleAdded`
   and `exampleTimeChanged` (4 languages), in a plain list.
5. The badge was `position: absolute`, top-right of a 42–46 pt cell. It now
   sits under the date, in a 16 pt slot that every cell keeps.
6. `useRehearsals` set `refreshing` (the RefreshControl's prop) for every load
   after the first, including the one on focus. Only a pull (`refresh()`) sets
   it now.
7. Offsets came from Intl `timeZoneName: 'shortOffset'`. Hermes answers that
   with "GMT", so labels read "(UTC)", and the curated rows had the offsets
   written into them. Only the cities are written now, and every offset is
   `getTimezoneOffset` (date-fns-tz) at the moment it is shown.

## Red before

```
# 1  JoinProjectScreen.tsx, joinProjectScreenStyles.ts, projects.ts at 71c3b41
npm run e2e -- e2e/flows/08-invite-before-sign-in.yaml
[Failed] Invite link before sign-in (1m 40s) (Element not found: Id matching regex: join-code-input)
  -- the old screen has no such form after a wrong code: it is the full-screen error
Jest: ✕ shows a wrong code's error under the field…  Unable to find testID join-code-input
      ✕ draws the button of a link's error as a button  Expected "#ffffff", Received undefined

# 2  conflictDetection.ts, useAddRehearsalSubmit.ts, calendar.ts at 71c3b41
npm run e2e -- e2e/flows/07-planner-project-switch.yaml
[Failed] Planner follows the project (2m 23s) (Assertion is false: "Grigory Smirnov is busy at this time[\s\S]*" is visible)
Jest: Expected "Grigory Smirnov is busy at this time", Received "Grigory Smirnov занят(а) в это время"

# 3  ProfileScreen.tsx at 71c3b41
npm run e2e -- e2e/flows/44-profile-language.yaml
[Failed] The profile's language, kept by the account (2m 34s) (No visible element found: id: profile-help)
Jest: ✕ opens the support page…  openURL: Number of calls: 0
      ✕ shows the version the app was built as  Unable to find an element with text: 2.4.1
server (legal.js at 71c3b41): ✕ shows the language the link asks for  (en shown for ?lang=ru)

# 4  NotificationsScreen.tsx at 71c3b41
npm run e2e -- e2e/flows/09-onboarding.yaml
[Failed] Onboarding to the end, nothing granted (1m 57s) (Assertion is false: "You were added to a rehearsal" is visible)
Jest: 3 failed ("Add Rehearsal" found; no example rows; no Russian example)

# 5  WeeklyCalendar.tsx at 71c3b41
npm run e2e -- e2e/flows/41-today-selects-today.yaml
[Passed] Today selects today (1m 29s)   -- see below
Jest: ✕ puts a day's count under its date  Unable to find testID calendar-day-count-2030-01-11

# 6  useRehearsals.ts, CalendarScreen.tsx at 71c3b41
npm run e2e -- e2e/flows/07-planner-project-switch.yaml
[Failed] Planner follows the project (2m 19s) (Assertion is false: ".*Three Sisters.*" is visible)
  -- screenshot 07-calendar-after-back: the filter at y≈380/2000 instead of ≈239, 60 pt down
Jest: ✕ is for a pull only  Expected false, Received true (refreshing during a forced load)

# 7  timezones.ts at 71c3b41
npm run e2e -- e2e/flows/23-profile-timezone.yaml
[Failed] The profile's timezone, not the device's (2m 9s) (Assertion is false: "Honolulu \(UTC-10\)" is visible)
Jest: Expected "Honolulu (UTC-10)", Received "Honolulu (UTC)"; Expected "New York (UTC-4)", Received "(UTC-5)"
```

Two of the red runs need explaining:

- **5, the badges.** Maestro sees a day cell as one element, with its name,
  date and count in one label ("Fri, 30, 1"). It cannot tell where the count
  sits in the cell, so flow 41 shows the strip in a screenshot
  (`41-week-strip-counts`). On the old code the "1" covers "Fri" and "Sat"
  (run `2026-10-30_071946`). With the fix it sits under 30 and 31 (run
  `2026-10-30_071447`). `WeeklyCalendar.test` holds the layout.
- **3, the language.** In e2e, Safari does not run `legal.js`. The server's CSP
  carries `upgrade-insecure-requests`, so the page's `/legal.css` and
  `/legal.js` are requested over https, which the local http server does not
  answer. The page shows the English in its markup. Flow 44 proves that Help
  opens the support page from the app's server. Jest covers the language on
  both sides: the URL carries `lang=ru`, and `legal.js` shows ru for it. The
  CSP is a server security header, outside this task, and is unchanged.

Jest's red for 2, 6 and 7 ran with the test calling the new signature through
a cast (an extra argument or `refresh`). That made the old code fail on
behaviour instead of a compile error. The cast was removed once the fix was in.

## Green after (`d4738aa`)

```
npx jest --selectProjects frontend --silent     105 suites, 912 tests passed
server: npx jest legalPageLanguage              3 passed
npm run type-check                              clean
npm run check:secrets                           pass

npm run e2e -- e2e/flows/08-invite-before-sign-in.yaml    [Passed] (1m 32s)
npm run e2e -- e2e/flows/07-planner-project-switch.yaml   [Passed] (2m 30s)
npm run e2e -- e2e/flows/44-profile-language.yaml         [Passed] (2m 54s)
npm run e2e -- e2e/flows/09-onboarding.yaml               [Passed] (2m 1s)
npm run e2e -- e2e/flows/41-today-selects-today.yaml      [Passed] (1m 3s)
npm run e2e -- e2e/flows/23-profile-timezone.yaml         [Passed] (2m 37s)
```

In one full frontend run, `useAvailabilityOffline.test` failed once under
load. It passed on its own and in the next full run, and this task does not
touch it. The server's full Jest run fails 8 tests of
`startup/runtimeStartup.test.js`, where child processes cannot import the
server here. They fail the same way with `legal.js` at `71c3b41`.

Screenshots: `08-wrong-code-under-the-field`, `07-conflict-in-english`,
`07-calendar-after-back`, `44-support-page`, `09-onboarding-notifications`,
`41-week-strip-counts`, `23-picker-device-in-honolulu`.

Flow notes: in 07, the alert's Cancel is matched `below: "Create Anyway"`,
because the form's close button is also labelled Cancel. Flow 23 matches Tel
Aviv at `UTC+[23]`, because its label now follows Israel's summer time.
