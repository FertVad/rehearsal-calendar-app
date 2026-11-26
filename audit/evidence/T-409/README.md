# T-409 — deleting the account removes the exported rehearsals from this iPhone's calendar

Base: 1d3d6bd. Fix: 1d52a05 (client), the privacy commit after it, the flow commit after that.

## Red before

- Jest, `src/contexts/__tests__/AuthContext.deleteAccountCalendar.test.tsx`, app files back on the base:
  7 of 7 red (the removal never ran; no count returned). See `jest-red-before.txt`.
- Server Jest, `__tests__/routes/privacyPage.test.js`, `public/privacy.html` back on the base:
  `Tests: 4 failed, 132 passed, 136 total` — the new sentence missing in en, ru, es and de.
- e2e `e2e/flows/106-delete-account-clears-calendar.yaml`, app files back on the base
  (AuthContext.tsx, calendarSync.ts, ProfileScreen.tsx, CalendarSyncSettingsScreen.tsx, profile.ts):

```
[Failed] Deleting the account takes the exported rehearsals out of the calendar (2m 9s) (Assertion is false: "Rehearsals the app added to this iPhone’s calendar will be removed from it\. On your other devices they will stay\.", id: delete-account-calendar is visible)
1/1 Flow Failed
```

The first run of 106 on the fix failed on the flow itself: the alert's message is one
element holding both paragraphs (the deleted project and the event left), and the
regex has to match the whole. Fixed in the flow with `(?s).*…*`. The app was right
(screenshot of that run: "Account deleted" / "1 project …" / "1 rehearsal could not be removed …").

## Green after (on the fix, files restored from HEAD)

- Jest client, the whole frontend project: `Tests: 1751 passed, 1751 total`.
- Server: `privacyPage` + `utils/privacy*`: `Tests: 188 passed, 188 total`.
- `npm run type-check`: clean. `npm run lint`: 0 errors (674 warnings, as before). `npm run check:dead`: clean.
- e2e 106:

```
[Passed] Deleting the account takes the exported rehearsals out of the calendar (2m 28s)
1/1 Flow Passed in 2m 29s
```

Screenshots of the green run are here: `106-exported.png`, `106-question.png`,
`106-deleted.png` (taken from the round-1 run below, on the round-1 fix).

## Review round 1, remark 1 — DELETE /me fails after the removal

Cause: `removeExportedBeforeDeletion` saved `SYNC_OFF` and nothing put the settings
back when `DELETE /me` then failed (no network, server error). The account lived on
with Auto Sync silently off and its events gone. Now the helper remembers the four
fields `SYNC_OFF` changes before saving it and hands back `restoreSync`; `deleteAccount`
calls it when `deleteMe` rejects, before the error goes to the screen. The next run
exports the events again. Only `deleteMe`'s own failure restores: once the server has
deleted the account, the settings stay off.

- Red before: the new test "puts Auto Sync back as it was when DELETE /me fails after
  the removal", with AuthContext.tsx and calendarSync.ts at f92edd2:
  `Tests: 1 failed, 7 passed, 8 total` (settings received off). See `round1-red-before-jest.txt`.
- Green after: that file 8 of 8; the whole frontend project `Tests: 1752 passed, 1752 total`;
  `tsc --noEmit` clean; ESLint on the changed files 0 errors.
- e2e 106 on the fix:

```
[Passed] Deleting the account takes the exported rehearsals out of the calendar (1m 56s)
1/1 Flow Passed in 1m 57s
```

## Not run

- Flow 89, round 1: run again alone, cut off again at 10 minutes (`Exit code 143`).
  It needs the supervisor's run before acceptance.

- Flow 89 (which also deletes an account) was cut off by the 10-minute limit on commands:
  `Exit code 143`. Left for the supervisor's night run. Kabanikha never turns sync on in 89,
  so there are no mappings: the removal finds none, returns 0, and her alert is as before.
