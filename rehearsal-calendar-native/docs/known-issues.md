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

Five were fixed on 2026-09-03 and their entries deleted: the planner booking the
whole company for every rehearsal, a push token staying with the account that no
longer held it, the secret scanner reporting its own pattern list, a deleted
project leaving its busy hours on everyone forever, and the planner's range
being computed through UTC.

---

## Confirmed, not yet fixed

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

### A recurring calendar event blocks only one of its occurrences

Verified 2026-09-03. All occurrences of a series share one id — expo-calendar
says so outright: *"instances of recurring events do not have their own unique
and stable IDs on either iOS or Android."* The import keys everything on that
shared id ([import.ts:183-187](../src/shared/services/calendar/import.ts#L183)
collapses N occurrences to one map entry), and every occurrence is sent with the
same `external_event_id`, where the unique index from migration 005 keeps
exactly one.

A missing row reads as free rather than unknown, so a weekly class shows the
person available for every occurrence but one — on their own screen and in
everyone else's planner. Which occurrence is blocked also moves between syncs,
because each occurrence whose times differ is pushed to `toUpdate` and the
single row is rewritten, last one wins.

**Smallest fix** (client, needs a rebuild): key the import on
`` `${event.id}:${startsAt}` `` instead of `event.id` in the three maps and the
payload. The exported-rehearsal exclusion must keep comparing the bare
`event.id`. No migration: the unique index still holds, and rows keyed on the
bare id are pruned by the existing delete pass and re-added on the first sync.

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
