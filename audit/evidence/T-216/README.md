# T-216: the "tests" check was flaky

Red run: T-022 checks, commit 9cf6f2e, 02.11.2026 (log
`rehearsal-calendar-native/e2e/out/failed/T-022-2026-11-02T02-42-00-066Z/checks.log`,
not in git). No test failed: all 33 scanner, 12 lock, 191 Jest files (2117
tests), 8 admin DOM/CSP and 18 admin error tests passed. The check got "code
null" because autodev stopped `npm test` at its 20 min limit ("не уложились в
лимит 20 мин"). The Jest stage alone took 1075.79 s, against 402 s measured in
T-215, and in it nearly every frontend file took 7-19 s.

## Cause

The frontend project compiled with ts-jest in its type-checking mode. In that
mode ts-jest adds to each file's cache key the mtime of every module the file
resolves (`ts-jest-transformer.js`, `getCacheKey`, when `!isolatedModules`).
A commit or a checkout that touches a widely imported module, such as the
translations or `shared/components/index.ts` that T-022 changed, so
invalidates the cache of nearly every screen test, even when nothing they
import changed in content, and each file goes through the TypeScript language
service again: 7-19 s a file instead of under 5 s. A worker that Jest replaces
past 512 MB (T-215) builds its language service anew as well.

Reproduced on HEAD with no content change, only a new mtime on the three files
(what a checkout does): half the frontend took 499 s against about 87 s warm
(`red-before-runs.txt`), so the whole frontend about 1000 s, as in the red run.

The type check there duplicated `npm run type-check`: `tsc --noEmit` already
checks the whole project, the 244 files under `__tests__` included, with the
stricter project tsconfig.

## Fix

`jest.config.js`, frontend transform: `isolatedModules: true` in ts-jest's
tsconfig. ts-jest compiles each file on its own (`transpileModule`); the
cache key is the file's own content and config, and no language service is
built. Types stay checked by `npm run type-check`. No time limit raised, no
retry, no test changed.

## Red before, green after

| | run | files | time |
|---|---|---|---|
| before | warm, full frontend (1) | 118 | 174 s |
| before | new mtime on 3 files, half the frontend (2) | 59 | **499 s** |
| after | new mtime + new transform config, the same half (3) | 59 | **41 s** |
| after | new mtime, whole Jest stage as `npm test` runs it (4) | 191 | 261 s (red run: 1076 s) |

Same 439 tests in runs 2 and 3, all passing. In run 4, 2109 of 2117 pass; the
8 failures are `runtimeStartup.test.js`, which cannot read `server/.env` in
this sandbox, before and after (T-215 README), and passed in the red run.

## The bug the test guards

No single test failed: the check stopped on time while every test passed. So
no fixed bug guarded by a test came back here; all 2109 tests that can run in
this sandbox pass after the change.

## Files

- `red-before-runs.txt`: runs 1 and 2.
- `green-after-runs.txt`: runs 3 and 4, type-check.
- The mtime was set with a 6-line `fs.utimesSync` script
  (`node /tmp/t216/touch.mjs <files>`), content untouched (`git status` clean).
