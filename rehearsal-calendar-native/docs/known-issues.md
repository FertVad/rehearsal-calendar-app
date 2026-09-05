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

### Editing a rehearsal briefly showed a time that was neither the old nor the new one

Reported from the device on 2026-09-05. The event in the phone's calendar showed
a third time entirely, and became correct after leaving the Calendar app and
returning.

Our own data was ruled out: the form builds the timestamps in the reader's
timezone and hands the *same* value to the server and to the export, so both
writes carry the same instant.

The remaining suspect is that the event never said which timezone it meant. iOS
assigns the device's zone at creation, and an update that sets only `startDate`
can be reinterpreted against whatever was recorded. Both paths now state the
zone explicitly — a cheap change that removes the question, **but this is a
hypothesis and not a confirmed diagnosis**. If the wrong time appears again
after the next build, the cause is elsewhere and this note should say so.


### Calendar sync — eleven findings left, and eighteen tests now

Reviewed 2026-09-04 by three agents, one per half plus the failure paths. This was
the part of the app with no tests at all. It has eighteen now, and the reason
there were none turned out to be mechanical rather than anyone's neglect: the
module would not load under test. The shared mocks were missing `AppState`,
`getEventAsync` and two expo-calendar enums, and the AsyncStorage mock lacked
`__esModule`, so the interop handed back a wrapper and any module touching
storage threw on import. Anyone who tried hit that wall and gave up.

**The privacy promise holds.** Both halves were read for it specifically: no
event title, notes, location, URL or attendee is read on the import path at all,
both payloads hard-code `IMPORTED_SLOT_TITLE`, and the log lines that survive
production carry only counts and ids. The one blemish is data minimisation, not
a breach — see the last row.

The two critical ones were re-verified by hand rather than taken on trust.

**Nine were fixed on 2026-09-05 and their rows removed**, including both
criticals: automatic sync now lives on the tab bar and runs on a cold launch;
the export reconciles rehearsals that no longer exist; the diff reaches an event
that began before today; an exported event records which rehearsal it is, in its
URL, so a second device matches it exactly instead of guessing from title, time
and location; a revoked permission no longer reads as "the reader deleted this";
and a run that failed no longer stamps itself done — which for the export also
stopped it refusing to retry for ten minutes.

The eleven below remain. A fresh sweep of this area would mostly re-find them,
so finish this list rather than hunting again.

One thing here can only be settled on a device: whether `url` survives a
round-trip through EventKit. The type says it does and is iOS-only, but reading
a type is not seeing the value come back — and if it does not, the exact
matching quietly does nothing and falls back to the heuristic.

| Severity | What | Where |
|---|---|---|
| high | Every timed imported event is diffed as "changed" on every sync, and the whole update batch is rejected once the calendar is ~500 events deep | `src/shared/services/calendar/import.ts:297` |
| high | One failed mappings request empties the import exclusion, and the phantom busy slots it creates can never be cleaned up | `src/shared/utils/calendarMappings.ts:181` |
| high | Mappings are keyed per user but hold device-local event ids, so on a second device the exclusion, the deletes and the duplicate check all point at the wrong event | `server/routes/native/calendarSync.js:204` |
| high | A stale in-memory connection id after a user switch stops every mapping reaching the server, silently | `src/shared/utils/calendarMappings.ts:22` |
| medium | "Remove all exported" erases the record of events it did not delete, and reports success either way | `src/shared/services/calendar/export.ts:409` |
| medium | Changing the export calendar leaves every exported rehearsal in the old calendar while the screen claims they are in the new one | `src/shared/services/calendar/export.ts:236` |
| medium | Fifty parallel read-modify-writes on one AsyncStorage key lose forty-nine of them | `src/shared/services/calendar/import.ts:398` |
| medium | getAllMappings discards the local cache instead of merging it, so a second device's exported rehearsals get re-imported as busy | `src/shared/utils/calendarMappings.ts:180` |
| medium | A device clock that moves backwards locks both timers out until real time catches up | `src/shared/hooks/useAutoCalendarSync.ts:61` |
| low | The device calendar identifier is uploaded with every imported slot and the server has no use for it | `src/shared/services/calendar/import.ts:385` |
| low | performSmartSync has no finally: a rejection leaves the syncing spinner on forever and skips the reload | `src/features/availability/hooks/useAvailabilitySync.ts:72` |

Full evidence, failure scenarios and proposed fixes are in the workflow
transcript for run `wf_10bab5ff-ace`. The two confirmed by hand:

- **Auto sync only exists while the Mark Busy sheet is open.** `useAutoCalendarSync`
  is called from exactly one place, `AvailabilityScreen`, and that screen is not
  a tab — it is mounted only as the `MarkBusy` modal (`src/navigation/index.tsx:281`).
  The tabs are Calendar, Projects, Create, Planner, Profile. So a user who turns
  Auto Sync on and never opens that sheet gets no import and no export, ever,
  while the settings screen says it is on.
- **A deleted rehearsal keeps its event and its 30-minute alarm on every other
  device.** The automatic export iterates the rehearsals that exist
  (`useAutoCalendarSync.ts:89`) and nothing ever walks the mappings looking for
  one whose rehearsal is gone. The device that pressed delete removes its own
  event; nobody else's is touched, and the next sync does not reconcile it.

#### The tests this area should have

Written by the agents that read it, most valuable first. This list is the point
of the exercise — the findings above will be re-broken without it.

- Idempotency: run importCalendarEventsToAvailability twice against an unchanged calendar and assert the second run posts nothing — no bulkSet, no batchUpdateImported, no batchDeleteImported — and returns success 0 with every event counted as skipped. This alone pins the isAllDay comparison.
- Deleting a still-running event: a multi-day all-day slot already stored with startsAt three days in the past, absent from the calendar, must appear in batchDeleteImported. Same for a timed event that started yesterday and ends tomorrow.
- All-day events west of UTC: with the device clock in America/New_York, an all-day event on today that is already stored must be recognised as unchanged (not re-added), and when removed from the calendar must be deleted.
- A wrongly-imported exported rehearsal: seed an availability row whose external_event_id is a rehearsal's calendar event id, put that id in the mappings, and assert the delete pass removes it rather than protecting it.
- getAllMappings failure isolation: make calendarSyncAPI.getMappings reject while availabilityAPI.getAll succeeds, and assert the import does NOT store exported rehearsal events as busy slots (either it aborts or it still excludes them).
- Recurrence keying round-trip: a weekly series of 52 occurrences sharing one event.id produces 52 distinct `${id}:${startsAt}` rows on the first run and zero writes on the second; moving one occurrence produces exactly one delete of the old key and one add of the new.
- All-day span conversion: a fortnight event, a single-day event, and one crossing a month boundary each yield startsAt `${firstDate}T00:00:00.000Z` / endsAt `${lastDate}T23:59:59.999Z`, under both the exclusive-next-midnight and inclusive-23:59:59 endDate conventions.
- Update batch size: 600 changed timed events must be split into chunks the way the add path is, and a chunk failing must not be reported to the caller as a successful sync.
- Privacy contract: assert the object handed to availabilityAPI.bulkSet and batchUpdateImported contains only the whitelisted keys and that title is always IMPORTED_SLOT_TITLE, given an event carrying a real title, notes, location, url and attendees.
- Failed-calendar guard: with one of three calendars throwing from getEventsAsync, assert batchDeleteImported is never called while the adds from the two healthy calendars still go through.
- Timezone fidelity: a timed event created in another zone, and one crossing local midnight, are sent as the exact ISO instants expo-calendar reported, with no date-shifting.
- Window edges: an event that moves from day 300 to day 400 is deleted; one that moves from day 400 to day 300 is added; neither produces both.
- exportRehearsalsIfDue reconciles deletions: mappings exist for rehearsals 1, 2 and 3, the batch endpoint returns only 1 and 3, and the run deletes event and mapping for 2 (fails today — this is the stale-alarm bug)
- syncRehearsalToCalendar keeps the mapping when the calendar cannot be read: Calendar.getEventAsync rejects with a permission error and the test asserts removeEventMapping was NOT called and no event was created (fails today)
- findDuplicateEvent matches a location-less rehearsal: an existing event with location null/'' and the same title and times is adopted rather than duplicated (fails today)
- importCalendarEventsToAvailability excludes exported rehearsal events from both the add pass and the delete pass, given mappings returned by the server
- importCalendarEventsToAvailability skips the whole run when the exported-mapping set cannot be established (mappings request rejects), instead of importing with an empty exclusion
- removeAllExportedEvents deletes an event whose mapping exists only in AsyncStorage, and leaves the mapping in place for any event whose deletion failed
- calendarMappings.getAllMappings surfaces every external_event_id when the same rehearsal has mapping rows under two connections, rather than collapsing to one
- GET and DELETE /calendar-sync/mappings/by-event are scoped to a connection: device A's unsync does not remove device B's mapping row for the same rehearsal
- getOrCreateConnection re-fetches after a user switch: reconcileDeviceState runs for a different user id and the next call does not return the previous user's connection id
- POST /calendar-sync/mappings with another user's connectionId returns 403 and writes no row (passes today — pin it, it is the only thing stopping a cross-user write)
- syncRehearsalToCalendar moves the event when settings.exportCalendarId differs from mapping.calendarId
- handleRemoveAll does not show the success alert when result.failed > 0
- Mounting the app without ever opening Mark Busy and firing an AppState background→active transition triggers an import and an export (the regression guard for finding 1; it fails today).
- importCalendarEventsToAvailability leaves lastImportTime untouched when bulkSet rejects for one chunk, and updates it only when result.failed is 0.
- handleSynchronize's alert prints 0 exported when syncAllRehearsals returns {success: 0, failed: N}, and reports failure rather than 'Sync Complete'.
- performForceSync still calls loadAvailability and surfaces the error when forceSync rejects (permission revoked mid-session).
- Fifty events in one chunk produce fifty entries in 'calendar-import-tracking', and ten rehearsals in one export batch produce ten entries in 'calendar-export-mappings'.
- getAllMappings returns the union of the server's mappings and the AsyncStorage cache, so an event id known only locally is still excluded from import.
- importCalendarEventsToAvailability excludes exported rehearsal events when GET /calendar-sync/mappings fails but GET /availability succeeds.
- exportRehearsalsIfDue and shouldAutoSync both run when the stored last-sync timestamp is in the future.
- A second import started while the first is in flight (settings-screen Synchronize plus a Mark Busy focus sync) results in one row per event on the server and one lastImportTime write.
- performAutoSync returns without touching the network when there is no accessToken, and does not stamp lastImportTime.
- Revoking calendar permission and re-granting it later resumes sync with no change to stored settings (no reinstall, no re-picking the calendar).


### The schema file has drifted from production

`server/database/init-native-schema.sql` no longer describes the database. Read
off production directly on 2026-09-02:

- `native_project_members` there has `expires_at`, `invite_code` and
  `character_name`, none of which are in the file, and lacks the `created_at`
  the file declares. `routes/native/members.js:234` selects `character_name`.
- `native_notifications` is created by no schema file and no migration at all.

Production is fine — it grew these by hand. But a new environment provisioned by
the procedure in CLAUDE.md comes up broken: the project members screen 500s and
the whole notification inbox fails. So does any restore from scratch.

Repairing the file is safe (production never reads it) but must be done by
comparing against a real dump, not by memory — and every other divergence found
the same way should go in at once.

### Deleting an account warns about it only afterwards

Two thirds of this were **fixed on 2026-09-03**: the members of a project that
goes with the account are now told, and the busy hours its rehearsals had booked
are cleared instead of outliving them. What is left is the copy below — the app
still does not say what is about to happen until it has happened.

Verified 2026-09-02. The confirmation modal
([ProfileScreen.tsx:505-529](../src/features/profile/screens/ProfileScreen.tsx#L505))
shows only "This action is irreversible. All **your** data will be permanently
deleted." The string that does mention other people's projects,
`deleteAccountProjectsWarning`, exists in all four locales and has exactly one
call site — [ProfileScreen.tsx:132](../src/features/profile/screens/ProfileScreen.tsx#L132),
in the alert shown **after** `await deleteAccount()` on line 128. The truth
arrives after the irreversible act.

The server deletes every project where the departing user is the last active
owner or admin ([auth.js](../server/routes/auth.js#L412)), cascading its
rehearsals and responses. Two things used to make it worse than the claim, and
both are now repaired — `notifyProjectDeleted` is sent to the surviving members
after the transaction commits, and the orphaned `source='rehearsal'` rows are
deleted before the project is, since no cascade and no endpoint could reach them
afterwards. Covered by `__tests__/routes/accountDeletionCleanup.test.js`.

**Still to do** (client, needs a rebuild): extend `deleteAccountWarning` in all
four locales in [profile.ts](../src/i18n/translations/profile.ts) to say that
projects where you are the only administrator will be deleted for everyone in
them. An exact count would need a new server preview endpoint.

### An owner deleting their account leaves the project ownerless

Verified 2026-09-02. With another active admin present the project is not
counted as orphaned and survives — with no owner row, and nothing ever sets one
again. The only `INSERT` with `'owner'` is project creation, the role endpoint
validates against `['admin','member']` only
([members.js:284](../server/routes/native/members.js#L284)), and there is no
project update route. Deletion requires `role === 'owner'` exactly
([projects.js:156](../server/routes/native/projects.js#L156)), so the project can
never be deleted or transferred. The client hides the button rather than
erroring, so nobody sees a failure — they just cannot do it.

Everything else keeps working: admins can still run rehearsals, invite, remove
members and promote further admins.

**One part of the original claim is refuted:** plain members could not leave
before this either. There is no leave endpoint anywhere — see below.

**Decided 2026-09-03: nobody inherits.** The project is deleted along with the
account and its members are told, rather than an admin being promoted to owner.

That is a **wider deletion than the code performs today** — currently a project
survives whenever another active admin remains — so it destroys data belonging
to other people, and is not something to apply as part of a bug-fix sweep. It
needs its own change, deliberately made and watched: the confirmation copy has
to name what is about to happen before the button is pressed, not after.

The narrower repairs that follow from the same decision — telling the members,
and clearing the busy hours the vanished rehearsals left on them — are safe and
belong with the entry above.

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

### A deleted rehearsal keeps its calendar event on every other device

Verified 2026-09-03. The export is create-or-update only:
[`syncAllRehearsals`](../src/shared/services/calendar/export.ts#L304) iterates
the rehearsals it is handed and nothing reads the mapping set to find entries
with no matching rehearsal. Deletion is handled only on the device that did it —
`unsyncRehearsal` deletes from that device's own store.

So on a second device the event stays, and its 30-minute alarm fires for a
rehearsal that no longer exists. Worse, `deleteMappingByEvent` is scoped by user
but **not** by connection, so it removes the mappings of every one of the user's
devices — after which "remove all exported" on the second device cannot see the
orphan either. The only way out is editing the phone's Calendar app by hand.

The same shape hits a single device that was offline during the delete.

**Smallest fix** (client, needs a rebuild): in `exportRehearsalsIfDue`, prune
mappings with no live rehearsal, reading them from the AsyncStorage-backed
`calendarStorage` — the DB copy has already been deleted by the other device.
Guard it on a successful fetch, or a failed request reads as "everything was
deleted". Repairing the unscoped queries in `routes/native/calendarSync.js`
would be the proper fix and is larger.

### A rehearsal moved after its day-before reminder is never reminded again

Verified 2026-09-03, and **narrower than first reported**: the move itself is
announced. `notifyRehearsalUpdated` fires at edit time with `'datetime'` among
the change keys, so participants do hear about it.

What is lost is the day-before reminder for the new date. The claim row in
`native_push_reminders` is written on the first send and released only inside
the push-failure catch; `updateRehearsal` rewrites `starts_at` and never touches
it. The suppressing predicate
([reminderScheduler.js:83-86](../server/services/notifications/reminderScheduler.js#L83))
keys on `rehearsal_id` and `reminder_type` alone, with no comparison against
`starts_at` or `sent_at`, so once claimed a rehearsal can never re-enter the
24h result set. Move a rehearsal from Tuesday to Friday and nothing arrives on
Thursday. The hour-before reminder is a separate claim and still fires.

**Smallest fix** (server, no rebuild): delete the rehearsal's claim rows in
`updateRehearsal` when the start time changes. See the entry below — one change
settles both.

### Someone added to a rehearsal after its reminder went out never gets one

Verified 2026-09-03. The claim is per rehearsal, not per recipient: the insert
writes no `user_id` and conflicts on `(rehearsal_id, reminder_type)`, so one
send retires the whole rehearsal for that type. The roster is read *before* the
claim and only on the run that wins it, so a later run never looks again.

They get no update push either — `changeKeys` only ever holds `'datetime'`,
`'location'` and `'title'`, so a roster-only edit sends nothing at all. The
rehearsal simply appears in their list if they happen to open the app.

**Smallest fix** (server, no rebuild): restore the per-recipient claim the
original migration already specifies. `create-push-reminders-table.sql` declares
`user_id INTEGER NOT NULL` with `UNIQUE(rehearsal_id, user_id, reminder_type)`;
`002-create-push-tokens-postgres.sql` narrowed it to the pair. Going back to the
three-column key, inserting one row per recipient and notifying only the ids
whose insert returned, settles this and the entry above together and keeps the
double-send protection. Needs a migration.

### The two migrations disagree on the shape of `native_push_reminders`

Found 2026-09-03 while verifying the two above, and **not yet settled** — it
needs a look at the live database, which is why it is here rather than fixed.

- [create-push-reminders-table.sql:6-18](../server/migrations/create-push-reminders-table.sql) —
  `user_id INTEGER NOT NULL`, `UNIQUE(rehearsal_id, user_id, reminder_type)`
- [002-create-push-tokens-postgres.sql:21-27](../server/migrations/002-create-push-tokens-postgres.sql) —
  no `user_id`, `UNIQUE(rehearsal_id, reminder_type)`

Both use `CREATE TABLE IF NOT EXISTS`, so neither corrects the other. The
scheduler's insert supplies no `user_id` and names `ON CONFLICT (rehearsal_id,
reminder_type)` — against the older shape both halves fail, and the error is
swallowed by the outer catch, which would mean reminders failing entirely and
silently. Production was baselined rather than migrated, so the repo cannot say
which shape is live. One `\d native_push_reminders` against production settles
it.

The test harness hardcodes the newer shape, so the green suite proves nothing
here.

### The select-all checkbox never says it will clear

There is no Clear All control — the register used to claim one. The header holds
a single checkbox labelled **Select All** in every state
([MemberFilter.tsx:74-81](../src/features/smart-planner/components/MemberFilter.tsx#L74)).
Once everything is selected, tapping it deselects everything, while the label
still reads Select All and the box shows a tick. Nothing tells you what the tap
will do.

An empty selection means every member is counted — that is how the generator
reads it — and the summary line does say so. So the outcome is not wrong, only
unannounced.

**Smallest fix** (client): swap the label when `allSelected` is true. There is
no `clearAll` string yet — it needs adding to the interface and all four locale
blocks in `src/i18n/translations/common.ts`, or the type will not compile.

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

- Four `native_subscription_*` / `native_payment_*` / `native_allpay_*` tables
  survive in the database with nothing reading them — see the Payments section
  of [CLAUDE.md](../../CLAUDE.md).
- `/admin` runs under a relaxed CSP because its tables are built with inline
  `onclick` — see the tech-debt list in [app-store-release.md](app-store-release.md).
- Push delivery is not verified: Expo's tickets say the message was accepted,
  and the receipts that say whether a phone got it are never fetched. `sent`
  means accepted.
