# Historical migrations — do not run

These files are what older databases ran by hand. The migration runner uses
their names to verify an existing `native_migrations` ledger and executes only
the reviewed steps named in `../database/schema/manifest.mjs`. Nothing here is
discovered or run in filename order any more.

Do not apply the rest with `psql` either. The `migrate-*-to-timestamptz.sql`
conversions read the clock in the session zone (FM01), and the backfill in
`001-add-oauth-providers.sql` duplicates email providers on every rerun (FM02).

Provision and upgrade through the runner: see
[server migrations](../../docs/server-migrations.md).
