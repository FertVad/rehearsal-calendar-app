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

Provision and upgrade through the runner: see
[server migrations](../../docs/server-migrations.md).
