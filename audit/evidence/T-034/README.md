# T-034 — «Откликнулся на репетицию»: один раз на человека

Fix commit: `9f43688` (base `0799bfd`). Server only — no screen changes, so no e2e flow.

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

## Mutation

`releaseSeenNotices` made a no-op → `a new end time or place counts as a change too` fails
(1 failed, 6 passed). A start move alone is still caught by the older start-move release,
which clears every claim of the rehearsal.

## Not of this task

Full server Jest: 76 suites pass; `__tests__/startup/runtimeStartup.test.js` fails 8 tests
identically on the base sources (child fixture reads its own `.env`, which this machine's OS
policy denies) — environment, not this change.
