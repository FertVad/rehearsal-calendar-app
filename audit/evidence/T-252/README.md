# T-252 — the inbox card says all of it; "New administrator" opens the members; every type has its icon

Fix: ad078de on 6e87de6 (auto/main). Node 22.

## Red before, green after

| What | Before (6e87de6 code, the new tests) | After (ad078de) |
|---|---|---|
| Server: role given through the route, other admin's inbox row (`server/__tests__/integration/adminAppointedNotice.integration.test.js`) | red: `data.projectId` NaN (`server-red-before.txt`) | green |
| Client: `everyServerNotification.test.tsx` — every `type: '…'` in pushNotificationService.js: a tapped push opens something; no card gets the unknown type's bell; card text not cut to lines | red: admin_appointed push opens nothing; admin_appointed icon `notifications-outline`; `numberOfLines` 2 (`client-red-before.txt`) | green |
| Client: `backToTabs.test.tsx` — admin_appointed, push and card open the project on its members; old row without id opens nothing | red: push stays on the modal; card opens the project without `section: 'members'` | green |
| e2e flow 86 (extended: longest notice, `no-ellipsis.js` on every shot) | red: `86-spanish: text cut, "…" at 327,271 pt; 327,373 pt; 328,764 pt; 331,169 pt` (`before-86-maestro.log`, `before-86-spanish.png`) — Maestro had read the full texts as visible | green (`after-86-*.png`, `after-86-maestro.log`) |
| e2e flow 88 (new: "New administrator" in the inbox opens the members) | red: `".*Ariel Spirit.*" is visible` false after two taps; the card shows the bell (`before-88-new-admin-in-inbox.png`, `before-88-maestro.log`) | green: the key icon, the castle on its members (`after-88-*.png`) |

The red e2e run: the four fix files (`NotificationsScreen.tsx`, `useNotifications.ts`,
`pushNotificationService.js`, `members.js`) put back with
`git restore --source=6e87de6`, flows 86 and 88 run, then `git restore --source=HEAD`.

## Other checks on ad078de

- e2e 61, 62, 75: passed (3/3). A first attempt failed 3/3 on
  "Database is temporarily unavailable" — the run's PostgreSQL container
  disappeared (`docker stop`: "No such container"); the rerun passed.
- `jest --selectProjects frontend`: 145 suites, 1409 tests passed.
- Server `npm run test:unit`: 1095 passed, 8 failed — all in
  `__tests__/startup/runtimeStartup.test.js` (`import-failed` of a copied
  server); the same 8 fail with the server files of 6e87de6, so the sandbox,
  not this change.
- `npm run type-check`, `npm run check:dead`, `npm run lint` (0 errors),
  `npm run check:secrets -- --staged`: pass.
