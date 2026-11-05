# T-034 — «Откликнулся на репетицию»: один раз на человека

Fix commit: `9f43688` (base `0799bfd`). The fix is on the server, but what it changes is
on screen: the admin's inbox. So it has a flow, `e2e/flows/73-seen-told-once.yaml`
(review of T-034; see "On screen" at the end).

Rule (one place): `rehearsal-calendar-native/server/services/rehearsals/seenNotice.js`.
- A "yes" claims `(rehearsal_id, user_id, 'seen')` in `native_push_reminders`, in the
  same transaction as the mark (`rsvpService.markRehearsal`). Only the request that
  gets the row back (`ON CONFLICT DO NOTHING RETURNING`) sends `notifyMemberResponse`.
- An edit that changes `starts_at`, `ends_at` or `location` deletes the 'seen' claims
  of that rehearsal (`rehearsalService.editRehearsal`, under its `FOR UPDATE`).
  A title/description change does not.
- "no" sends nothing and releases nothing.
- No migration: existing table, existing unique key `(rehearsal_id, user_id, reminder_type)`,
  `reminder_type` is `VARCHAR(10)` without a CHECK. The scheduler queries its own types by
  name (`reminderScheduler.js`), so 'seen' rows never reach it.

## Red before (base sources restored with `git restore --source=0799bfd -- services/rehearsals/rsvpService.js services/rehearsals/rehearsalService.js routes/native/rehearsals.js`, tests from the fix)

`NODE_OPTIONS=--experimental-vm-modules npx jest __tests__/routes/seenNotifications`

```
    ✓ a mark tells the admins once (88 ms)
    ✕ unmarking tells nobody, and marking again tells nobody either (50 ms)
    ✕ a second "yes" in a row is not news (16 ms)
    ✕ after the rehearsal moved, marking it again tells the admins once (85 ms)
    ✕ a new end time or place counts as a change too; a new title does not (96 ms)
    ✕ two marks at once tell the admins once (17 ms)
    ✓ a mark that is refused claims nothing (14 ms)
    Expected number of calls: 0
    Received number of calls: 2
    Expected number of calls: 1
    Received number of calls: 2
    Expected number of calls: 1
    Received number of calls: 2
    Expected number of calls: 2
    Received number of calls: 3
    Expected number of calls: 1
    Received number of calls: 2
Tests:       5 failed, 2 passed, 7 total
```

PostgreSQL, `npm run test:r0-postgres -- --r8-only` (two marks held on the rehearsal row
by a second connection, released together):

```
AssertionError [ERR_ASSERTION]: T-034: two marks at once must tell the admin once
  actual: 2,
  expected: 1,
```

## Green after (`git restore --source=HEAD -- <same files>`)

```
    ✓ a mark tells the admins once (128 ms)
    ✓ unmarking tells nobody, and marking again tells nobody either (57 ms)
    ✓ a second "yes" in a row is not news (18 ms)
    ✓ after the rehearsal moved, marking it again tells the admins once (120 ms)
    ✓ a new end time or place counts as a change too; a new title does not (98 ms)
    ✓ two marks at once tell the admins once (18 ms)
    ✓ a mark that is refused claims nothing (6 ms)
Tests:       7 passed, 7 total
```

PG: `two "seen" marks at once tell the admins once; unmark and mark again tells nobody (T-034)` —
`R8_REMINDERS REGRESSION PASS: controls and repaired contracts passed on real PostgreSQL`.

Related suites (seenNotifications, rsvp integration, rehearsalNotifications, rehearsalRoster,
lifecycleAtomicity, cronReminders, reminderScheduler): `Tests: 113 passed, 113 total`.

## Supervisor PG check: D01 red, then green

`--security-only` failed at D01: `relation "native_push_reminders" does not exist`, 500 on
`POST /rehearsals/:id/respond`. D01 runs on the diagnostic subset `__tests__/postgres/fixture.sql`,
which had no `native_push_reminders`; the "seen" mark now claims its notice there in the mark's
transaction. Production has the table (migrations 002, 006; `init-native-schema.sql`), so the
cause was the fixture, not the code: it now carries the table in its canonical shape. No
migration, no schema change.

After: every PG mode run one by one — `D01+R4_LIFECYCLE+R4_PUSH_TOKEN`, `A02+B03`, `B04`, `H04`,
`IS02`, `F05`, `R2_SCHEMA+R2_MIGRATIONS`, `R3_EMAIL+R3_AUTH`, `R6_AVAILABILITY`, `R7_IMPORT`,
`R8_REMINDERS` — `REGRESSION PASS`. `R2_STARTUP` (in `--r2-foundation-only` and `--security-only`)
cannot run on this machine: its child loads the synthetic `.env` the fixture writes into a temp
directory, and the OS policy here denies reading any `.env`
(`Unable to load the explicitly selected server environment file`). Same cause as
`runtimeStartup.test.js` below; it does not touch the fixture or this change.

## Mutation

`releaseSeenNotices` made a no-op → `a new end time or place counts as a change too` fails
(1 failed, 6 passed). A start move alone is still caught by the older start-move release,
which clears every claim of the rehearsal.

## Not of this task

Full server Jest: 76 suites pass; `__tests__/startup/runtimeStartup.test.js` fails 8 tests
identically on the base sources (child fixture reads its own `.env`, which this machine's OS
policy denies) — environment, not this change.

## On screen: flow 73 (review of T-034)

The first report said "server only — no screen changes, so no e2e flow". Wrong: no client
code changed, but the effect is in the admin's inbox. `e2e/flows/73-seen-told-once.yaml`
(tags `seen`, `notifications`, `rehearsals`): Malvolio marks "Letter scene" (tomorrow 12:00,
`Illyria House`, seeded for this flow alone) seen, unmarks, marks again; Olivia, its owner,
has exactly one "responded … at 12:00 PM". Then `e2e/scripts/move-rehearsal.js` moves it to
15:00 as from her other device; he unmarks and marks again; she has one at 12:00 and one at
3:00 PM, no third. Every tap waits for the toggle to be enabled again (it is disabled while
its answer is on the way), so each tap is a mark that reached the server.

### Red before

Server files of the fix restored from the base
(`git restore --source=0799bfd -- server/services/rehearsals/rsvpService.js
server/services/rehearsals/rehearsalService.js server/routes/native/rehearsals.js`),
flow and seed as they are now; `npm run e2e -- e2e/flows/73-seen-told-once.yaml`:

```
[Failed] Seen told once (3m 50s) (Assertion is false: ".*Malvolio Steward responded to “Letter scene”.*", Index: 1 is not visible)
1/1 Flow Failed
```

maestro.log: the three taps and their states pass, then

```
Assert that ".*Malvolio Steward responded to “Letter scene” \(.* at 12:00.PM\) in Illyria House.*" is visible COMPLETED
Assert that ".*Malvolio Steward responded to “Letter scene”.*", Index: 1 is not visible FAILED
```

— the old code told her twice of one "seen".

### Green after

`git restore --source=HEAD -- <same files>`, same command:

```
[Passed] Seen told once (3m 2s)
1/1 Flow Passed in 3m 3s
[e2e] taps taken again (tap-and-see.yaml): 0
```

```
Assert that ".*Malvolio Steward responded to “Letter scene”.*", Index: 1 is not visible COMPLETED
Assert that ".*Malvolio Steward responded to “Letter scene” \(.* at 3:00.PM\) in Illyria House.*" is visible COMPLETED
Assert that ".*Malvolio Steward responded to “Letter scene” \(.* at 12:00.PM\) in Illyria House.*" is visible COMPLETED
Assert that ".*Malvolio Steward responded to “Letter scene”.*", Index: 2 is not visible COMPLETED
```

Final screenshot `73-told-again-after-the-move`: two "New response" cards, "(tomorrow at
3:00 PM)" just now and "(tomorrow at 12:00 PM)" two minutes ago. An earlier green run reached
the same last assertion but was cut by the tool's 10-minute limit at its final screenshot;
the run above is the clean one.
