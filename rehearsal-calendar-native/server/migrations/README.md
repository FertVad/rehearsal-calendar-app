# Historical migrations — do not run

These files are what older databases ran by hand. The migration runner uses
their names to verify an existing `native_migrations` ledger and executes only
the reviewed steps named in `../database/schema/manifest.mjs`. Nothing here is
discovered or run in filename order any more.

Do not apply the rest with `psql` either. The `migrate-*-to-timestamptz.sql`
conversions read the clock in the session zone (FM01), and the backfill in
`001-add-oauth-providers.sql` duplicates email providers on every rerun (FM02).

`014-clear-avatar-urls.sql` is not historical: a prepared data step (T-273)
that clears stored Google photo links. It is not in the manifest, and nothing
has applied it; applying it to production is the owner's decision.

`015-delete-unmarked-name-notices.sql` is not historical either: a prepared
data step (T-278) that deletes the "joined", "is now an administrator" and
"has seen" notices written before they recorded whom they name — notices
deleting an account cannot reach. Not in the manifest; nothing has applied it.

`016-usage-statistics.sql` is a forward step of the runner, in the manifest
like 007–013 (T-294): the days someone used the app and the invitation counts.
The server works without it and records nothing until it is applied.

Order for 014 and 015, when the owner applies them to production:

1. Deploy the server with T-278 (and T-273). From then on every such notice
   records whom it names.
2. Then apply `014-clear-avatar-urls.sql` and
   `015-delete-unmarked-name-notices.sql`. 015 before the deploy would leave
   the rows the old server writes in between without a mark. Both are
   idempotent; rerunning 015 after the deploy catches any such row.

Provision and upgrade through the runner: see
[server migrations](../../docs/server-migrations.md).
