# Known Issues

Defects found and deliberately **not** fixed yet, so they are not lost. Each
entry says where it is, what the user sees, and why it was left alone.

Fix one → delete its entry. Anything urgent belongs in a branch, not here.

**Read the verification status before acting on anything below.** The candidate
list came out of a six-way automated sweep on 2026-09-01. Of the ten claims
verified so far, all ten stood up — but that is ten, not forty-two, and an
unverified claim is a lead, not a fact. Confirm one against the code before
fixing it, and correct or delete the entry if it turns out wrong.

---

## Confirmed, not yet fixed

### The smart planner treats every project member as called to every rehearsal

[availabilityMerger.ts:44-47](../src/features/smart-planner/utils/availabilityMerger.ts#L44)
says so in as many words — *"In native app, all members of the project are
assumed to be invited to the rehearsal"* — and pushes each rehearsal's time
range onto every member of the project.

That assumption stopped being true when rehearsals got their own rosters. A
rehearsal for three people now blocks that slot for the whole company, so the
planner refuses times that are genuinely free and recommends worse ones. It also
double-counts the people who *are* on it, since `native_user_availability`
already carries a `source='rehearsal'` busy row per participant.

Confirmed by reading. Not yet fixed because the fix needs the per-rehearsal
roster on the client, which the planner does not currently fetch.

### `npm run lint` does not run at all

The config is in the old `.eslintrc` format and ESLint 9 refuses it, so
`npm run lint`, `npm run lint:fix` and anything depending on them fail before
linting a single file. Nobody has been linting for a while.

### Two route suites fail intermittently in a full run

Seen twice on 2026-09-02, on different tests:

- `rehearsalById.test.js` → "gives it to an admin who is not on it"
- `rehearsalNotifications.test.js` → "tells the roster when the rehearsal changes"

Both pass on their own, repeatedly, and both passed on the next full run. So
nothing is broken — but a suite that fails one run in five stops being read, and
the next real failure gets waved through as "the flaky one".

Both suites build their timestamps with `Date.now()` at call time and share the
in-memory SQLite harness, so the likely candidates are a time-dependent
assertion or cross-suite state in a worker. Not yet chased.

### `npm run check:secrets` always fails, on itself

`scripts/check-secrets.sh` greps tracked files for its own pattern list, and the
patterns live in that tracked file — so it reports four "secrets" every time, all
of them its own source lines. No real leak. But `npm run check` is wired to it,
which means the pre-flight check is permanently red and therefore ignored.
Excluding the script from its own scan is a one-line fix.

---

## Candidates from the 2026-09-01 sweep — **not verified**

Six agents read the subsystems with no test coverage; a verification pass
confirmed the four critical findings and six others, then ran out of budget. The
rest are listed as found, in the reporter's words, with nothing checked. Roughly
half of such claims usually fall over on inspection.

Two are worth checking first because they are cheap to settle and would be
serious if true:

- **`native_notifications` may never be created by any schema file or
  migration** ([003-notifications-timestamptz.sql:9](../server/migrations/003-notifications-timestamptz.sql)).
  Production has the table, so this would only bite a freshly provisioned
  environment — but that is the documented setup procedure.
- **`GET /projects/:projectId/members` may select a column no schema creates**
  ([members.js:228](../server/routes/native/members.js#L228)), which would 500
  the project screen on such an environment.

### High

| Where | Claim |
|---|---|
| [pushTokens.js:44](../server/routes/native/pushTokens.js#L44) | A push token is never taken from the previous account, so one user's notifications reach whoever signs in on that phone next |
| [ProfileScreen.tsx:128](../src/features/profile/screens/ProfileScreen.tsx#L128) | Deleting an account destroys other members' projects, and the dialog only says so after it has happened |
| [useAvailabilityEditor.ts:191](../src/features/availability/hooks/useAvailabilityEditor.ts#L191) | "Delete data" on a past date only changes local state; the rows return on the next focus |
| [import.ts:313](../src/shared/services/calendar/import.ts#L313) | A recurring calendar event is imported as one slot, so the user reads free for its other occurrences |
| [useAutoCalendarSync.ts:75](../src/shared/hooks/useAutoCalendarSync.ts#L75) | A deleted rehearsal leaves its calendar event and 30-minute alarm on every device except the one that deleted it |
| [projects.js:174](../server/routes/native/projects.js#L174) | Deleting a project orphans every participant's rehearsal-sourced busy slots, with no endpoint able to clear them |
| [auth.js:422](../server/routes/auth.js#L422) | An owner deleting their account while another admin exists leaves the project ownerless: it cannot be deleted, ownership cannot move, members cannot leave |
| [SmartPlannerScreen.tsx:92](../src/features/smart-planner/screens/SmartPlannerScreen.tsx#L92) | The planner's range comes from `toISOString()`, so between local midnight and the UTC offset it plans the wrong week |

### Medium

| Where | Claim |
|---|---|
| [accountLinking.js:76](../server/utils/accountLinking.js#L76) | Email lookups are case-sensitive, so a Google sign-in can create a duplicate empty account instead of linking |
| [api.ts:136](../src/shared/services/api.ts#L136) | A session revoked mid-use leaves the app showing signed-in UI with stale data until it is force-quit |
| [slotGenerator.ts:191](../src/features/smart-planner/utils/slotGenerator.ts#L191) | A range spanning a DST transition repeats one day and drops the last |
| [availability.js:82](../server/routes/native/availability.js#L82) | Work outside the try block can leave a malformed request with no response at all, plus an unhandled rejection |
| [members.js:141](../server/routes/native/members.js#L141) | The members-availability endpoint hands every member everyone else's email address |
| [import.ts:58](../src/shared/services/calendar/import.ts#L58) | One calendar failing to read makes the import delete everything previously imported from it |
| [export.ts:236](../src/shared/services/calendar/export.ts#L236) | Changing the export calendar keeps writing rehearsals to the old one |
| [calendarMappings.ts:22](../src/shared/utils/calendarMappings.ts#L22) | The cached connection id survives a user switch, so the next user's mappings never reach the server |
| [invites.js:188](../server/routes/native/invites.js#L188) | Invite codes are matched case-sensitively while the entry field disables auto-capitalisation, so a correctly dictated code typed in lowercase is rejected |
| [reminderScheduler.js:118](../server/services/notifications/reminderScheduler.js#L118) | A reminder claim is not released when the rehearsal moves, so a rehearsal rescheduled after its day-before reminder is never announced again |
| [reminderScheduler.js:106](../server/services/notifications/reminderScheduler.js#L106) | Someone added to a rehearsal after its reminder was claimed never gets that reminder |
| [useNotifications.ts:83](../src/shared/hooks/useNotifications.ts#L83) | `getLastNotificationResponseAsync` is re-read when the user object changes, replaying an already-handled tap |
| [AvailabilityScreen.tsx:81](../src/features/availability/screens/AvailabilityScreen.tsx#L81) | `today` is the UTC date while the grid is built from local dates, so after local midnight the wrong day is ringed |

### Low

| Where | Claim |
|---|---|
| [UnreadContext.tsx](../src/contexts/UnreadContext.tsx) | The unread badge is not cleared on logout, so the next person on the device sees the previous user's count |
| [auth.js:26](../server/routes/auth.js#L26) | Registration confirms whether an email already has an account, while login is deliberately generic |
| [reminderScheduler.js:28](../server/services/notifications/reminderScheduler.js#L28) | The day-before reminder is titled "Rehearsal tomorrow" for anything 12–24h out, including later the same day |
| [reminderScheduler.js:89](../server/services/notifications/reminderScheduler.js#L89) | A failed reminder query is reported as a successful run with nothing due |
| [NotificationsScreen.tsx:94](../src/features/notifications/screens/NotificationsScreen.tsx#L94) | Project-level notifications carry no projectId, so tapping them navigates nowhere |
| [NotificationsScreen.tsx:64](../src/features/notifications/screens/NotificationsScreen.tsx#L64) | A failed inbox load is shown as an empty inbox while the bell still reports unread |
| [AuthContext.tsx:163](../src/contexts/AuthContext.tsx#L163) | A failed timezone auto-sync is never retried, so an OAuth signup can store rehearsal times as UTC wall-clock |

---

## Known and left alone on purpose — not defects

- Four `native_subscription_*` / `native_payment_*` / `native_allpay_*` tables
  survive in the database with nothing reading them — see the Payments section
  of [CLAUDE.md](../../CLAUDE.md).
- `/admin` runs under a relaxed CSP because its tables are built with inline
  `onclick` — see the tech-debt list in [app-store-release.md](app-store-release.md).
- Push delivery is not verified: Expo's tickets say the message was accepted,
  and the receipts that say whether a phone got it are never fetched. `sent`
  means accepted.
