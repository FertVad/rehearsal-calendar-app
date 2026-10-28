// Reviewed immutable artifact identities. These hashes are literal constants,
// never recomputed from ambient files at import or invocation. A source change
// requires an explicit reviewed manifest update and the PostgreSQL regressions.
export { inspectSchema } from './inspect.mjs';
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
export const manifest = freeze({
  "formatVersion": 1,
  "currentProfile": "rehearsly-pg-current-v1",
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
    "native_user_availability",
    "native_users"
  ]
});
