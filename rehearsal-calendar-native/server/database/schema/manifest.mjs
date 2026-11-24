// Reviewed immutable artifact identities. These hashes are literal constants,
// never recomputed from ambient files at import or invocation. A source change
// requires an explicit reviewed manifest update and the PostgreSQL regressions.
//
// Version 1's artifacts and definitions are exactly those recorded by existing
// histories (production: `--fresh` on 2026-10-28, root rehearsly-pg-current-v1)
// and never change. Version 2 (T-294: group 016) has its own snapshot, catalog
// and checker, and so does version 3 (T-406: group 017, the weekends_* columns
// of native_users). `--fresh` creates version 3; a v1 root receives 016 and
// 017 by `--apply`, a v2 root 017. Version 2's entries stay as recorded.
import { inspectSchema as inspectV1 } from './inspect.mjs';
import { inspectSchema as inspectV2 } from './inspect-v2.mjs';
import { inspectSchema as inspectV3 } from './inspect-v3.mjs';

const checkers = { 'rehearsly-pg-current-v2': inspectV2, 'rehearsly-pg-current-v3': inspectV3 };
// Each profile is checked by the checker its manifest entry pins.
export const inspectSchema = (query, options) =>
  (checkers[options?.profile] ?? inspectV1)(query, options);
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
export const manifest = freeze({
  "formatVersion": 1,
  "currentProfile": "rehearsly-pg-current-v3",
  "profiles": [
    {
      "id": "rehearsly-pg-current-v1",
      "descriptor": {
        "file": "database/schema/catalog.json",
        "sha256": "3ed03aaac7a6516936b2a8617802a8c286fb5aa711fb1cb9412bb13608af6f83"
      },
      "fresh": true,
      "adopt": true,
      "bootstrap": {
        "file": "database/init-native-schema.sql",
        "sha256": "48284687247da9559e196a0175f427fd39c997fab04f2356de2f7ab204217cf9"
      },
      "inspector": {
        "file": "database/schema/inspect.mjs",
        "sha256": "a38f465f02be34242f43257197b391c4caaf73bfe4c975814ad33a3afe5ca317"
      },
      "completionProfile": "rehearsly-pg-current-v1"
    },
    {
      "id": "rehearsly-pg-domain13-v1",
      "descriptor": {
        "file": "database/schema/catalog.json",
        "sha256": "3ed03aaac7a6516936b2a8617802a8c286fb5aa711fb1cb9412bb13608af6f83"
      },
      "fresh": false,
      "adopt": true,
      "inspector": {
        "file": "database/schema/inspect.mjs",
        "sha256": "a38f465f02be34242f43257197b391c4caaf73bfe4c975814ad33a3afe5ca317"
      },
      "completionProfile": "rehearsly-pg-current-v1"
    },
    {
      "id": "rehearsly-pg-domain13-pre-import-key-v1",
      "descriptor": {
        "file": "database/schema/catalog.json",
        "sha256": "3ed03aaac7a6516936b2a8617802a8c286fb5aa711fb1cb9412bb13608af6f83"
      },
      "fresh": false,
      "adopt": true,
      "inspector": {
        "file": "database/schema/inspect.mjs",
        "sha256": "a38f465f02be34242f43257197b391c4caaf73bfe4c975814ad33a3afe5ca317"
      },
      "completionProfile": "rehearsly-pg-current-v1"
    },
    {
      "id": "rehearsly-pg-current-v2",
      "descriptor": {
        "file": "database/schema/catalog-v2.json",
        "sha256": "00acaccbabb47d78549a12464366c9340978da1d227284f0e608d3dad611eabc"
      },
      "fresh": true,
      "adopt": true,
      "bootstrap": {
        "file": "database/init-native-schema-v2.sql",
        "sha256": "ab086450afd91fb61b5a0dab7c4a14c6306e6b40f714a558c58089783eeeece3"
      },
      "inspector": {
        "file": "database/schema/inspect-v2.mjs",
        "sha256": "3f9e371967c29a1b74969e95c9609d9aa04ce6389eaf9bce54b8723320cdcd5e"
      },
      "completionProfile": "rehearsly-pg-current-v2"
    },
    {
      "id": "rehearsly-pg-current-v3",
      "descriptor": {
        "file": "database/schema/catalog-v3.json",
        "sha256": "f923dedf8af61ee13b5ac61cd1c77902a14eb3df72a0fb8050163ca310c45033"
      },
      "fresh": true,
      "adopt": true,
      "bootstrap": {
        "file": "database/init-native-schema-v3.sql",
        "sha256": "92190a62af055208b961ab95cea74ef6bcec19493c5d5694b5ae2288ad88f831"
      },
      "inspector": {
        "file": "database/schema/inspect-v3.mjs",
        "sha256": "c20a67043744bbb68db7565b8eba6862544347840d15d61afd8003332c976f26"
      },
      "completionProfile": "rehearsly-pg-current-v3"
    }
  ],
  "steps": [
    {
      "id": "availability-conflict-key-v1",
      "sql": {
        "file": "database/schema/availability-conflict-key-v1.sql",
        "sha256": "9bac959563d488e931f6dc1486f8098499a84cf192a0cdb3d81cf99e40110088"
      },
      "when": {
        "missingAvailabilityKey": true
      },
      "verifyProfile": "rehearsly-pg-domain13-v1",
      "roots": [
        "rehearsly-pg-current-v1",
        "rehearsly-pg-domain13-v1",
        "rehearsly-pg-domain13-pre-import-key-v1"
      ]
    },
    {
      "id": "007-member-availability-rate-limit",
      "sql": {
        "file": "migrations/007-member-availability-rate-limit.sql",
        "sha256": "3e24a63c5fe5536e9e32fcc7a8096f149fc003a0aacabe236e0c1385991bb833"
      },
      "when": {
        "missingBudget": "007"
      },
      "verifyProfile": "rehearsly-pg-domain13-v1",
      "roots": [
        "rehearsly-pg-current-v1",
        "rehearsly-pg-domain13-v1",
        "rehearsly-pg-domain13-pre-import-key-v1"
      ]
    },
    {
      "id": "008-invite-rate-limits",
      "sql": {
        "file": "migrations/008-invite-rate-limits.sql",
        "sha256": "7087822512ee51bc024ed1bacd96b6aebf8cc40a11133d43f63e467d6b532e99"
      },
      "when": {
        "missingBudget": "008"
      },
      "verifyProfile": "rehearsly-pg-domain13-v1",
      "roots": [
        "rehearsly-pg-current-v1",
        "rehearsly-pg-domain13-v1",
        "rehearsly-pg-domain13-pre-import-key-v1"
      ]
    },
    {
      "id": "009-operation-ip-rate-limits",
      "sql": {
        "file": "migrations/009-operation-ip-rate-limits.sql",
        "sha256": "f52802b7cbc0d057e0098ce8f890aea4192268e6d05e0beef3ffbf1af6af5961"
      },
      "when": {
        "missingBudget": "009"
      },
      "verifyProfile": "rehearsly-pg-domain13-v1",
      "roots": [
        "rehearsly-pg-current-v1",
        "rehearsly-pg-domain13-v1",
        "rehearsly-pg-domain13-pre-import-key-v1"
      ]
    },
    {
      "id": "010-email-verification",
      "sql": {
        "file": "migrations/010-email-verification.sql",
        "sha256": "0306e3c33c39edc892388dedabd4aed5909b0b0b81d53244b52c8a8032dfea6d"
      },
      "when": {
        "missingBudget": "010"
      },
      "verifyProfile": "rehearsly-pg-domain13-v1",
      "roots": [
        "rehearsly-pg-current-v1",
        "rehearsly-pg-domain13-v1",
        "rehearsly-pg-domain13-pre-import-key-v1"
      ]
    },
    {
      "id": "011-push-tickets",
      "sql": {
        "file": "migrations/011-push-tickets.sql",
        "sha256": "b2a92ce145607f7298dd4f091e5ee15e9ad10c01a442f0cb81899ede97ddca5b"
      },
      "when": {
        "missingBudget": "011"
      },
      "verifyProfile": "rehearsly-pg-domain13-v1",
      "roots": [
        "rehearsly-pg-current-v1",
        "rehearsly-pg-domain13-v1",
        "rehearsly-pg-domain13-pre-import-key-v1"
      ]
    },
    {
      "id": "012-idempotency-keys",
      "sql": {
        "file": "migrations/012-idempotency-keys.sql",
        "sha256": "807f7d43e52dbb7060a4b7a22c8608f09b47b118e25ad4083a69088b2f215449"
      },
      "when": {
        "missingBudget": "012"
      },
      "verifyProfile": "rehearsly-pg-domain13-v1",
      "roots": [
        "rehearsly-pg-current-v1",
        "rehearsly-pg-domain13-v1",
        "rehearsly-pg-domain13-pre-import-key-v1"
      ]
    },
    {
      "id": "013-push-token-owner",
      "sql": {
        "file": "migrations/013-push-token-owner.sql",
        "sha256": "3fe1254b348ee3be9112ad91fb9a754306a261102697e7662ccbf8c7de0a9998"
      },
      "when": {
        "missingBudget": "013"
      },
      "verifyProfile": "rehearsly-pg-domain13-v1",
      "roots": [
        "rehearsly-pg-current-v1",
        "rehearsly-pg-domain13-v1",
        "rehearsly-pg-domain13-pre-import-key-v1"
      ]
    },
    {
      "id": "016-usage-statistics",
      "sql": {
        "file": "migrations/016-usage-statistics.sql",
        "sha256": "50c70c74f69f5046b33dd7e30f7309374320857f142974c8dbbebb6a283a69e0"
      },
      "when": {
        "missingBudget": "016"
      },
      "verifyProfile": "rehearsly-pg-current-v2",
      "roots": [
        "rehearsly-pg-current-v1",
        "rehearsly-pg-domain13-v1",
        "rehearsly-pg-domain13-pre-import-key-v1"
      ]
    },
    {
      "id": "017-weekend-defaults",
      "sql": {
        "file": "migrations/017-weekend-defaults.sql",
        "sha256": "e116dce9f8515e10a3ac0898c08eb09bb81a5a8ef3325b0dc603e4225e778162"
      },
      "when": {
        "missingBudget": "017"
      },
      "verifyProfile": "rehearsly-pg-current-v3",
      "roots": [
        "rehearsly-pg-current-v1",
        "rehearsly-pg-domain13-v1",
        "rehearsly-pg-domain13-pre-import-key-v1",
        "rehearsly-pg-current-v2"
      ]
    }
  ],
  "legacyFilenames": [
    "001-add-oauth-providers.sql",
    "002-create-push-tokens-postgres.sql",
    "002-create-push-tokens-sqlite.sql",
    "003-notifications-timestamptz.sql",
    "004-trim-user-names.sql",
    "005-unique-imported-event.sql",
    "006-per-recipient-reminder-claims.sql",
    "007-member-availability-rate-limit.sql",
    "008-invite-rate-limits.sql",
    "009-operation-ip-rate-limits.sql",
    "adapt-calendar-tables-for-expo.sql",
    "add-is-all-day-flag.sql",
    "add-is-all-day-to-rehearsals.sql",
    "add-onboarding-completed.sql",
    "add-pending-response-status.sql",
    "add-rehearsal-responses-table.sql",
    "add-rehearsal-title-description.sql",
    "add-token-version.sql",
    "add-week-start-preference-sqlite.sql",
    "add-week-start-preference.sql",
    "create-push-reminders-table.sql",
    "drop-old-availability-columns.sql",
    "drop-old-rehearsal-columns.sql",
    "fix-date-column-types.sql",
    "migrate-availability-to-timestamptz.sql",
    "migrate-rehearsals-to-timestamptz.sql"
  ],
  "lockTables": [
    "native_auth_providers",
    "native_bug_reports",
    "native_calendar_connections",
    "native_calendar_event_mappings",
    "native_email_codes",
    "native_email_identities",
    "native_idempotency_keys",
    "native_invite_account_rate_limits",
    "native_invite_counts",
    "native_invite_ip_rate_limit_gate",
    "native_invite_ip_rate_limits",
    "native_member_availability_rate_limits",
    "native_notifications",
    "native_operation_ip_rate_limit_gates",
    "native_operation_ip_rate_limits",
    "native_project_members",
    "native_projects",
    "native_push_reminders",
    "native_push_tickets",
    "native_push_tokens",
    "native_rehearsal_responses",
    "native_rehearsals",
    "native_usage_days",
    "native_user_availability",
    "native_users"
  ]
});
