# T-293 — admin: where people come from and how they use it, from what is already stored

Commits: `d439495` (admin), `cd0d613` (privacy policy). Base for red-before: `32ca8f0`.
Node 26.13.0, run in `rehearsal-calendar-native/server`.

## Red before (32ca8f0)

The source files of the change restored to the base
(`git restore --source=32ca8f0 -- routes/admin.js routes/admin/dashboardPage.js
public/admin/dashboard.js public/admin/dashboard.css services/rehearsals/roster.js
public/privacy.html`), the new tests kept, then `git restore --source=HEAD`.
Output: [red-before.txt](red-before.txt).

- `adminAnalytics.test.js`: 16 of 18 fail — service accounts counted, no source,
  no steps, no `/analytics` (404 instead of 401 too); the 401 of `/stats` and
  `/users` passed already.
- `adminStoredContent.test.js`: 5 fail — no source/project name in the users
  JSON, no analytics.
- `privacyPage.test.js`: the internal-statistics purpose is missing in all four
  languages; `privacyProcessors.test.js`: the date is 19 November.
- `runtimeStartup.test.js` fails on the base the same way as on HEAD (8 of 11):
  the fixture writes a `.env` into its copied server and this sandbox forbids
  reading `.env` files (the import reports `import-failed`, `code: null`).
  Environment, not this task.

## Green (HEAD)

[green.txt](green.txt): the seven suites of the task, 181/181. Whole server
Jest (`npm run test:unit -- --silent`): 1376 passed, 8 failed — the
`runtimeStartup` eight above, nothing else. Browser: `npm run test:admin-browser`
(adminDashboard 6/6, adminFailures 18/18 after the URL fix),
`npm run test:admin-stored-browser` 6/6 (persisted text → real API → Chromium DOM/CSP).
`check:dead` (knip, both modes) clean; `check:secrets` pass; `npm run lint` 0 errors.

## PostgreSQL

`npm run test:r0-postgres -- --t293-only` on PostgreSQL 15.13: controls and
T293_ADMIN PASS, no external connections. [postgres.txt](postgres.txt).

## Mutations (each caught, then `git restore`)

[mutations.txt](mutations.txt):
1. `ADMIN_SERVICE_EMAILS` ignored → `count in no figure`, `hidden from the users table`, filters tests fail.
2. `seenBeforeStart` reads `native_rehearsal_responses` without ROSTER → Hamlet 3 of 5 (60%) instead of 2 of 4.
3. All-day marks read as instants (no UTC date window) → coverage 3 of 3 instead of 2 of 3.
4. `requireAdmin` taken off `/api/analytics` → the 401 test fails.
