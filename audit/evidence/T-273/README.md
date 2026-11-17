# T-273 — less of other people's data: members list without address and photo, no Google photo kept

## What was wrong (checked in the code)

- `GET /native/projects/:projectId/members` (`server/routes/native/members.js`)
  selected `u.email, u.avatar_url` and returned `email` and `avatarUrl` of every
  member to every member of the project. The app shows neither: `src/` has
  `email`/`avatarUrl` on members only in types (`ProjectMember`,
  `ProjectDetailScreen`'s `Member`), no screen reads them.
- A Google sign-in kept the Google profile photo: `verifyGoogleToken` returned
  `avatarUrl: payload.picture`, `signInWithProvider` wrote it on a new account
  (`INSERT … avatar_url`) and on a linked one (`UPDATE … SET avatar_url … WHERE
  avatar_url IS NULL`). The app's avatar is initials.
- Who read the members' addresses: two e2e scripts, `e2e/scripts/set-role.js`
  (flows 75, 76, 77) and `e2e/scripts/add-to-rehearsal.js` (flow 79), found the
  member by `m.email === MEMBER`. What they need is the member's user id; the
  owner finds a member by name, as the list shows them. They now take `MEMBER`
  as the full name — like `notify.js` already does — and refuse unless exactly
  one member has it.

## What changed

- Members list: selects and returns names, role, character, status, join date;
  no `email`, no `avatarUrl`.
- Google sign-in: `payload.picture` is not taken; `signInWithProvider` has no
  `avatarUrl` and writes no `avatar_url` (Apple passed `null` and no longer
  passes anything).
- `server/migrations/014-clear-avatar-urls.sql`: prepared, **not applied**.
  `UPDATE native_users SET avatar_url = NULL WHERE avatar_url IS NOT NULL` —
  data only, idempotent, no transaction control. Not in
  `database/schema/manifest.mjs`: the runner only runs structural steps keyed on
  what the catalog lacks (`when.missingBudget` / `missingAvailabilityKey` in
  `database/migrations/artifacts.mjs`) and has no slot for a data step; giving
  it one is migration-tool work. Whether and how to apply it to production is
  the owner's decision. The column stays (dropping it is a schema change).
- Types: `email`/`avatarUrl` off `ProjectMember` and `ProjectDetailScreen`'s
  `Member`; a test fixture that set `email` on a member follows.
- Test schema (`__tests__/integration/setup.js`): `native_project_members`
  gets `character_name`, as in `init-native-schema.sql`; without it the list
  route answered 500 in SQLite and could not be tested through the route.
- `docs/api-documentation.md`: the members response and model without
  `email`/`avatarUrl`; the Google section says the photo is not kept; the
  `/auth/me` example's `avatarUrl` is `null`.

## Red before, green after

`server/__tests__/routes/othersPersonalData.test.js`, through the routes, the
real Google verifier with only google-auth-library replaced:

- `red-old-server.txt`: with `routes/native/members.js`, `routes/auth.js`,
  `utils/accountLinking.js`, `utils/oauthVerification.js` as at `d4af1c1` —
  3 of 3 fail: the list carries `email: "admin@test.com"`, and both a new and a
  linked Google account keep `https://lh3.googleusercontent.com/…`.
- `green.txt`: on the fix, 3 of 3 pass.

## Other checks

- Server Jest: 81 of 82 suites, 1212 tests pass; the 8 failures are
  `startup/runtimeStartup.test.js`, where child processes cannot import the
  server in this sandbox (known since T-011), not touched here.
- Frontend Jest: 153 suites, 1606 tests pass. `type-check` clean. `lint`: 0
  errors.
- e2e, each run on the fix: 75 Role given by push, 76 Role given, seen on
  return, 77 Rehearsal form, the projects read again, 79 Added to a rehearsal,
  told — all passed. Nothing on screen changes, so there is no new flow.
