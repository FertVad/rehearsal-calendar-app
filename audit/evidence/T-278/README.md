# T-278 — deleting an account takes the person's name out of other people's inboxes

Source: review T-269, round 1, remark 1. Owner's decision 19.11 (chat): "delete for real".
Approval of the `routes/auth.js` change and the data step: owner, 19.11, chat.

## Cause

Three notices put a member's name, as text, into the inboxes of the owner and
administrators: "joined" (`routes/native/inviteRedemption.js`), "is now an
administrator" (`routes/native/members.js`), "has seen a rehearsal"
(`routes/native/rehearsals.js`). A `native_notifications` row belongs to its
reader and cascades with the reader only; nothing in it said whose name it
held. `DELETE /me` therefore could not reach them.

## Fix

- **The notice says whom it names.** `data.aboutUserId` (the JSONB column the
  row already has) — no schema change, so no migration ahead of the code. The
  three `notify*` functions take `{ id, name }` and throw on a bare name, so a
  future caller cannot hand over a name without whose it is
  (`pushNotificationService.js`, `named()`).
- **Deletion.** `DELETE /me`, in its transaction, after deleting the account's
  row: `DELETE FROM native_notifications WHERE CAST(data->>'aboutUserId' AS TEXT) = $1`.
  `lockSession` and `lockProject` are unchanged.
- **The race.** A notice naming someone is inserted only while their account
  exists, with `FOR KEY SHARE` on that row (`notificationStore.js`). `lockSession`
  takes `FOR NO KEY UPDATE`, which does not block it; the account's `DELETE`
  does. So a notice either commits before the deletion's DELETE of the account
  — and the notice delete after it, a later statement, sees and removes it — or
  waits for the deletion and then writes nothing. A push naming someone goes
  only where its row was written. Proven on PostgreSQL; without the lock the
  check fails (green.txt).
- **Old rows.** `migrations/015-delete-unmarked-name-notices.sql`: deletes the
  three types without `aboutUserId`. Deleted, not traced: a name is neither
  unique nor fixed (two members may share one; renames), so a match could hit
  the wrong person. Prepared, not applied, not in the manifest.

## Order on production (owner)

1. Deploy the server (this PR, with T-268, T-273, T-269).
2. Then apply `014-clear-avatar-urls.sql` and `015-delete-unmarked-name-notices.sql`.
   015 before the deploy would leave rows the old server writes in between
   without a mark. Both are idempotent; 015 can be rerun.

Also in `server/migrations/README.md`.

## Other places checked

Every text column a user's action writes into someone else's record:
notification bodies (the three above; every other notice carries project and
rehearsal titles only — `i18n/pushNotifications.js`), `native_idempotency_keys.response`
(the creator's own; project/rehearsal fields, no person's name),
`native_bug_reports` (the reporter's own), rehearsal and project fields (typed
by their authors, not copied from a profile). No other copy of a person's name.

A push already shown on someone's phone stays there; the server cannot reach it
(the policy, T-269, says so).

## Proof

- `server/__tests__/routes/accountNameInOthersNotices.test.js` — through the
  routes (invite join, role change, "seen", `DELETE /me`) and the real
  notification service. Red on the old server 4 of 4 (`red-old-server.txt`),
  green on the fix (`green.txt`).
- `server/__tests__/postgres/t278Notices.mjs` — scenario `T278_NOTICES`, in
  `--security-only` (the supervisor's postgres check): step 015 on real
  PostgreSQL (unmarked rows of the three types go, marked and other rows stay,
  rerun changes nothing), `DELETE /me` over HTTP, and the race. Red on the old
  code, green on the fix.
- Existing tests updated to the `{ id, name }` signature:
  `rehearsalNoticeText.integration.test.js`, `membershipNotifications.test.js`.
- No e2e: a server change, proven through the route (as the task says).
