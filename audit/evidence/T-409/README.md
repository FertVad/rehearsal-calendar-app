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

Screenshots of the green run (106-exported, 106-question, 106-deleted) are in
`rehearsal-calendar-native/e2e/out/artifacts/2026-11-25_104640/…/takeScreenshot/`;
copying them here was not allowed in this session.

## Not run

- Flow 89 (which also deletes an account) was cut off by the 10-minute limit on commands:
  `Exit code 143`. Left for the supervisor's night run. Kabanikha never turns sync on in 89,
  so there are no mappings: the removal finds none, returns 0, and her alert is as before.
