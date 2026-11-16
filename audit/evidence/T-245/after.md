# T-245 — after

## npm run check:dead (now knip twice: as is and --production)

```
$ cd rehearsal-calendar-native && npm run check:dead

> rehearsal-calendar-native@1.0.0 check:dead
> knip --no-progress && knip --no-progress --production

exit 0
```

Before: knip-production-before.txt (10 files, 8 exports, exit 1).

## Guard test

```
$ npx jest --selectProjects frontend exportStar
PASS frontend src/__tests__/exportStar.test.ts (22.972 s)
```

Before: guard-test-before.txt (3 findings: shared/components/index.ts:5,
editor/index.ts:4, editor/index.ts:5).

## What each finding became

| finding | checked | done |
|---|---|---|
| TimeSlotsEditor, ModeSelector | only their own tests and `export *` in editor/index.ts import them; no screen | deleted with tests and the two lines |
| animations/index.ts (0 bytes) | only `export *` in shared/components/index.ts | deleted with the line |
| closeDatabase | no server code calls it; the PG checks (r0-postgres.mjs → __tests__/postgres/*.mjs) close the adapter with it, adapterContract.mjs checks it; docs/server-runtime.md | kept, `@internal` + reason |
| respondToRehearsal | a wrapper of markRehearsal (which the route uses); only rsvpService.integration.test.js | removed; the test goes through markRehearsal(...).stats |
| localDate (useClock.ts) | only useClock.test.ts | removed; its CC01 test now checks useToday at the same instant |
| resetSessionForTests | 20 test files; tests only by design | kept, `@internal` + reason |
| clearAllMappings (calendarMappings.ts) | no caller since "remove all exported" removes mapping by mapping; only mappingScope.test.ts and mocks | removed with its test, the mocks, and what only it used: calendarStorage.clearAllMappings and calendarSyncAPI.deleteMappings |
| DATE_FORMATS | only dateFormat.test.ts | removed; the test iterates EXPECTED, which is a Record over DateFormatName, so a missing format is a compile error |
| isStartOfDayInTimezone, isEndOfDayInTimezone | only time.timezone.test.ts | removed with their test block |
| server/database/migrations/*.mjs, schema/*.mjs | `npm run migrate` → scripts/migrate.js → migrations/cli.mjs | knip.jsonc: scripts/migrate.js! |
| server/scripts/demoDates.mjs | imported by seed-demo.mjs, which writes the demo account in production (its header) | knip.jsonc: scripts/seed-demo.mjs! |
| server/scripts/test.mjs | `npm test` runner, not production code | knip.jsonc: `!scripts/test.mjs!` (out of the production project only) |

Not touched: the server's `DELETE /native/calendar-sync/mappings` route — the
app no longer calls it (calendarSyncAPI.deleteMappings was its only client);
removing a server endpoint is outside this task.

## Other checks

- type-check: no errors. lint: 0 errors (595 warnings, as before).
- frontend jest: 1390 passed (one full run had one test time out under load,
  EditProfileScreen at 10 s on the base run; reruns green).
- server rsvpService.integration.test.js: 7 passed.
- server jest: runtimeStartup.test.js fails 8 tests here, and the same 8 with
  the server files restored to the base commit — the sandbox, not this change.
- e2e: 64-availability-collapse-asks, 68-availability-drag-save,
  10-availability-days — Passed.
