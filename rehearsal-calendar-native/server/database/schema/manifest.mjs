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
        "sha256": "c39f22b3f7c84d53dae2b769cdf98944e3f7277c935cfaf84e596ad3c25ea6e9"
      },
      "fresh": true,
      "adopt": true,
      "bootstrap": {
        "file": "database/init-native-schema.sql",
        "sha256": "b4dde9984810a81362b509f5414aa1ee09760467808b7ba907406f04c8f86c79"
      },
      "inspector": {
        "file": "database/schema/inspect.mjs",
        "sha256": "19b5fe0c3ccc7d079bc64a5649e0799dc3e23917d6628867168f0451fd899a4b"
      },
      "completionProfile": "rehearsly-pg-current-v1"
    },
    {
      "id": "rehearsly-pg-domain13-v1",
      "descriptor": {
        "file": "database/schema/catalog.json",
        "sha256": "c39f22b3f7c84d53dae2b769cdf98944e3f7277c935cfaf84e596ad3c25ea6e9"
      },
      "fresh": false,
      "adopt": true,
      "inspector": {
        "file": "database/schema/inspect.mjs",
        "sha256": "19b5fe0c3ccc7d079bc64a5649e0799dc3e23917d6628867168f0451fd899a4b"
      },
      "completionProfile": "rehearsly-pg-current-v1"
    },
    {
      "id": "rehearsly-pg-domain13-pre-import-key-v1",
      "descriptor": {
        "file": "database/schema/catalog.json",
        "sha256": "c39f22b3f7c84d53dae2b769cdf98944e3f7277c935cfaf84e596ad3c25ea6e9"
      },
      "fresh": false,
      "adopt": true,
      "inspector": {
        "file": "database/schema/inspect.mjs",
        "sha256": "19b5fe0c3ccc7d079bc64a5649e0799dc3e23917d6628867168f0451fd899a4b"
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
        "sha256": "aca4b232c5d4607c009fa364be500670cc1bb5c7aa7fbe288637ea24654e4a91"
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
    "native_push_tokens",
    "native_rehearsal_responses",
    "native_rehearsals",
    "native_user_availability",
    "native_users"
  ]
});
