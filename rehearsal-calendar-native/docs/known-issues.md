# Known Issues

Defects found and deliberately **not** fixed yet, so they are not lost. Each
entry says where it is, what the user sees, and why it was left alone.

Fix one → delete its entry. Anything urgent belongs in a branch, not here.

**Read the verification status before acting on anything below.** The candidate
list came out of a six-way automated sweep on 2026-09-01. Twenty-one claims have
been verified since; all twenty-one were real, though three were narrower than
reported and one sub-claim was refuted outright. That is twenty-one, not
forty-two — everything in the unverified tables is a lead, not a fact. Confirm
one against the code before fixing it, and correct or delete the entry if it
turns out wrong.

Verifying in batches of three or four works; batches of seven run out of budget
partway and report nothing.

Thirteen were fixed on 2026-09-03 and their entries deleted. Six from the
register: the planner booking the whole company for every rehearsal, a push
token staying with the account that no longer held it, the secret scanner
reporting its own pattern list, a deleted project leaving its busy hours on
everyone forever, an account deletion telling nobody, and a recurring calendar
event blocking one occurrence.

Seven more came out of a two-agent audit of the Smart Planner run the same day,
all of them the same failure — **the planner saying free when the person is
busy**, which is the one thing this feature cannot afford:

- Busy time was sampled at :00 and :30 and asked "is anyone busy *at* this
  instant", so a 10:05–10:25 call blocked nothing and the day read Perfect.
- The last slot of the day was closed with the previous half-hour's busy set,
  so anyone who became busy after 22:30 was dropped from it.
- A span crossing local midnight came back as 22:00–02:00 and the client
  discarded it outright, so the whole evening read free.
- A multi-day span was filed under its start date only, leaving the rest Perfect,
  and one that began before the requested window was never fetched at all.
- A whole-day calendar event took both ends from its start, so a fortnight's
  holiday blocked one day.
- One calendar failing to open was read as "the user deleted these", wiping
  every slot imported from it.
- A tap on the eye put an admin on a rehearsal with no busy time booked.

Plus two range bugs that hid days rather than busy time: the day walk lost the
last day of any range containing an autumn clock change, and its first repair
broke Santiago and Havana, where the clocks change at midnight. Both loops walk
UTC now, verified under six timezones.

The planner had **no tests at all** before this — it could not have had any,
since Jest never defined `__DEV__` and any module guarding on it threw. It has
28 now, and the availability endpoint has its first 8.

---

## Confirmed, not yet fixed

### Decided against: a silent push to update the calendar without opening the app

Asked and answered on 2026-09-05, recorded so it is not re-litigated by
accident.

The calendar is written by the app, running on that device. If the reader never
opens it, nothing changes there — a rehearsal cancelled or moved by someone else
stays wrong in their calendar indefinitely. That is a real gap for anyone who
checks their calendar rather than the app, which is a normal habit.

A silent push (`content-available`) would wake the app in the background long
enough to write. It costs a background mode in the config, a task handler, a
justification at App Review, and it is throttled by iOS — usually prompt, never
guaranteed.

**Not doing it**, on the owner's decision: the intent is for people to live in
the app rather than in their calendar. Revisit only if that intent changes.


### A tapped notification opens a sheet over the availability screen, and back leads to the calendar as a modal

Reported from the device on 2026-09-05, deliberately left for later.

With the app open on the availability screen, tapping a push opens the rehearsal
sheet over it — and the back gesture then shows the **calendar** presented as a
modal rather than returning where the reader was. So the stack after a
notification is not the stack they left.

Not investigated. It belongs to the same family as the stranded-layer bug in
CLAUDE.md — the one that cost a day — so treat it as a navigation-stack question
rather than a notification one, and start from what `RehearsalDetails` is pushed
onto when the availability screen is itself a modal (`MarkBusy`).

Nothing is lost and nothing is wrong in the data; it is the reader being put
somewhere they did not ask to be.

### Calendar sync — all twenty findings closed

Reviewed 2026-09-04 by three agents, one per half plus the failure paths, and
finished on 2026-09-05. Twenty findings, two of them critical; every one is
fixed and its row deleted.

**The privacy promise holds**, and now has a test rather than resting on
everyone remembering: given an event with a real title, notes, location and
URL, none of them appear in what is posted.

This was the part of the app with no tests at all. It has thirty now, and the
reason there were none turned out to be mechanical rather than anyone's neglect:
the module would not load under test. The shared mocks were missing `AppState`,
`getEventAsync` and two expo-calendar enums, and the AsyncStorage mock lacked
`__esModule`, so the interop handed back a wrapper and any module touching
storage threw on import. Anyone who tried hit that wall and gave up.

Two things worth carrying forward. Three of the twenty were found on the device
by the owner and not by any agent or test — a dead link, a wrong time, and a
pull-to-refresh that had to be repeated. And the last fix failed its own test at
first, because the exclusion it changed existed in three copies and the one it
touched only fed a log line.

### A member cannot leave a project

Found while verifying the above. There is no leave endpoint at all.
`DELETE /:projectId/members/:userId` requires the **requester** to be an owner or
admin ([members.js:372](../server/routes/native/members.js#L372)), so an ordinary
member has no way out of a project except asking someone to remove them.

### "Delete data" on a past date deletes nothing

Verified 2026-09-03. `deletePastDates`
([useAvailabilityEditor.ts:207-216](../src/features/availability/hooks/useAvailabilityEditor.ts#L207))
makes no network call at all — it drops the dates from local state and calls
the completion, and its one call site passes an empty one
([AvailabilityScreen.tsx:278](../src/features/availability/screens/AvailabilityScreen.tsx#L278)).

A later Save cannot rescue it. `useAvailabilitySave` drops past dates from the
payload (`if (today && date < today) continue;`), and the bulk endpoint only
deletes dates that appear in that payload, so a past date is in neither set. The
reload on focus is unconditional — `loadAvailability` runs outside the
`if (shouldSync)` branch — and replaces state wholesale from the server.

So the marks vanish, no error is shown, and they are all back on the next visit
to the tab.

Aggravating: `clearSelection()` inside the same function closes the panel that
holds the Save bar, so the press hides its own confirmation affordance while
leaving `hasChanges` true.

**Smallest fix** (client, needs a rebuild): `availabilityAPI.delete(date)` and
`DELETE /api/native/availability/:date` both already exist and are scoped to
manual rows — the wiring was simply never done. Make `deletePastDates` async,
await one call per selected date, and skip the local mutation if any fails.

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

Eight consecutive full runs on 2026-09-03 were clean, so it is rare rather than
gone. Leave the entry until something explains it.

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

Empty: three were verified on 2026-09-03 and moved above, and two were fixed the
same day — the orphaned busy slots after a project delete, and the planner's
range being built through UTC.

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

- `/admin` runs under a relaxed CSP because its tables are built with inline
  `onclick` — see the tech-debt list in [app-store-release.md](app-store-release.md).
- Push delivery is not verified: Expo's tickets say the message was accepted,
  and the receipts that say whether a phone got it are never fetched. `sent`
  means accepted.
