# Database Schema Documentation

## Overview

This document serves as the **source of truth** for the database schema of the Rehearsal Calendar Native App.

**Database Type:** PostgreSQL (Production), SQLite (Development)
**Timezone Strategy:** All timestamps stored in UTC using TIMESTAMPTZ
**Naming Convention:** All native app tables use `native_` prefix
**Current Schema Version:** v10 (as of December 2025)

---

## Tables

### 1. native_users

**Purpose:** Store user accounts with email/password authentication

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | SERIAL | NO | - | Primary key |
| email | VARCHAR | NO | - | Unique email address |
| password_hash | VARCHAR | NO | - | Bcrypt hashed password |
| first_name | VARCHAR | NO | - | User's first name |
| last_name | VARCHAR | NO | - | User's last name |
| timezone | VARCHAR | YES | 'UTC' | User's timezone (e.g., 'America/New_York') |
| locale | VARCHAR | YES | 'en' | User's locale/language preference (e.g., 'en', 'ru') |
| week_start_day | VARCHAR(10) | YES | 'monday' | Week start preference: 'monday' or 'sunday' |
| notifications_enabled | BOOLEAN | NO | TRUE | Enable push notifications |
| email_notifications | BOOLEAN | NO | TRUE | Enable email notifications |
| created_at | TIMESTAMPTZ | NO | NOW() | Account creation timestamp |
| updated_at | TIMESTAMPTZ | NO | NOW() | Last update timestamp |

**Constraints:**
- PRIMARY KEY: `id`
- UNIQUE: `email`

**Indexes:**
- Primary key index on `id`
- Unique index on `email`

**Schema Notes:**
- Uses `first_name`/`last_name` instead of single `name` field
- `timezone` and `locale` are user preferences for display/notifications
- Both notification flags control notification delivery channels

---

### 2. native_projects

**Purpose:** Store rehearsal projects (bands, theater groups, etc.)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | SERIAL | NO | - | Primary key |
| name | VARCHAR | NO | - | Project name |
| description | TEXT | YES | NULL | Project description |
| timezone | VARCHAR | NO | 'UTC' | Project's default timezone |
| invite_code | VARCHAR(32) | YES | NULL | Current active invite code (32 hex chars) |
| invite_expires_at | TIMESTAMPTZ | YES | NULL | When the current invite expires |
| invite_created_by | INTEGER | YES | NULL | Foreign key to native_users.id who created invite |
| created_at | TIMESTAMPTZ | NO | NOW() | Project creation timestamp |
| updated_at | TIMESTAMPTZ | NO | NOW() | Last update timestamp |

**Constraints:**
- PRIMARY KEY: `id`
- UNIQUE: `invite_code` (when not null)
- FOREIGN KEY: `invite_created_by` REFERENCES `native_users(id)` ON DELETE SET NULL

**Indexes:**
- Primary key index on `id`
- Unique index on `invite_code`

**Schema Notes:**
- Only one active invite per project (stored in project table, not separate invites table)
- `invite_code` is 32-character hex string generated via `crypto.randomBytes(16).toString('hex')`
- Default expiration: 7 days from creation
- `timezone` used for displaying rehearsals in project's local time

---

### 3. native_project_members

**Purpose:** Many-to-many relationship between users and projects with role management

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | SERIAL | NO | - | Primary key |
| user_id | INTEGER | NO | - | Foreign key to native_users.id |
| project_id | INTEGER | NO | - | Foreign key to native_projects.id |
| role | VARCHAR | NO | 'member' | Role: 'owner', 'admin', or 'member' |
| status | VARCHAR | NO | 'active' | Status: 'active' or 'inactive' |
| invited_at | TIMESTAMPTZ | YES | NULL | When user was invited (for invite joins) |
| joined_at | TIMESTAMPTZ | YES | NULL | When user joined project |
| created_at | TIMESTAMPTZ | NO | NOW() | Membership creation timestamp |

**Constraints:**
- PRIMARY KEY: `id`
- FOREIGN KEY: `user_id` REFERENCES `native_users(id)` ON DELETE CASCADE
- FOREIGN KEY: `project_id` REFERENCES `native_projects(id)` ON DELETE CASCADE
- UNIQUE: `(user_id, project_id)`

**Indexes:**
- Primary key index on `id`
- Index on `user_id` (for "get all projects for user" queries)
- Index on `project_id` (for "get all members of project" queries)
- Unique index on `(user_id, project_id)`

**Schema Notes:**
- `role` has three levels: 'owner' (full control, can delete project), 'admin' (can manage members, create invites), 'member' (read/write access)
- `status` allows soft deletion ('inactive') instead of hard delete
- Inactive members can be reactivated via invite links (status → 'active')
- `invited_at` and `joined_at` track invite flow timestamps

**Performance Note:** These indexes are critical for dashboard queries that fetch projects per user.

---

### 4. native_rehearsals

**Purpose:** Store rehearsal/event scheduling information

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | SERIAL | NO | - | Primary key |
| project_id | INTEGER | NO | - | Foreign key to native_projects.id |
| title | VARCHAR | YES | NULL | Rehearsal title |
| description | TEXT | YES | NULL | Rehearsal description/notes |
| starts_at | TIMESTAMPTZ | NO | - | **Rehearsal start time in UTC** |
| ends_at | TIMESTAMPTZ | NO | - | **Rehearsal end time in UTC** |
| location | VARCHAR | YES | NULL | Rehearsal location/venue |
| created_by | INTEGER | YES | NULL | Foreign key to native_users.id who created rehearsal |
| created_at | TIMESTAMPTZ | NO | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | NO | NOW() | Last update timestamp |

**Constraints:**
- PRIMARY KEY: `id`
- FOREIGN KEY: `project_id` REFERENCES `native_projects(id)` ON DELETE CASCADE
- FOREIGN KEY: `created_by` REFERENCES `native_users(id)` ON DELETE SET NULL
- CHECK: `ends_at > starts_at` (ensure valid time range)

**Indexes:**
- Primary key index on `id`
- Index on `project_id` (for "get all rehearsals for project" queries)
- Index on `starts_at` (for date range queries)
- Index on `ends_at` (for date range queries)
- Composite index on `(project_id, starts_at, ends_at)` (for optimized project timeline queries)

**CRITICAL TIMEZONE NOTE:**
- `starts_at` and `ends_at` are stored in UTC using TIMESTAMPTZ
- Client must send ISO 8601 strings with timezone info
- PostgreSQL automatically converts to UTC for storage
- On retrieval, PostgreSQL converts to session timezone (default UTC)

**Performance Note:** The composite index on `(project_id, starts_at, ends_at)` dramatically speeds up calendar view queries.

**Migration History:**
- Originally used separate `date`, `start_time`, `end_time` columns
- Migrated to `starts_at`/`ends_at` TIMESTAMPTZ in migrate-rehearsals-to-timestamptz.sql
- Old columns dropped in drop-old-rehearsal-columns.sql
- Added `title` and `description` in add-rehearsal-title-description.sql
- Added `created_by` tracking

---

### 5. native_rehearsal_responses

**Purpose:** Store RSVP responses for rehearsals (participant attendance tracking)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | SERIAL | NO | - | Primary key |
| rehearsal_id | INTEGER | NO | - | Foreign key to native_rehearsals.id |
| user_id | INTEGER | NO | - | Foreign key to native_users.id |
| response | VARCHAR | NO | - | Response: 'yes', 'no', 'maybe' |
| created_at | TIMESTAMPTZ | NO | NOW() | Response creation timestamp |
| updated_at | TIMESTAMPTZ | NO | NOW() | Last update timestamp |

**Constraints:**
- PRIMARY KEY: `id`
- FOREIGN KEY: `rehearsal_id` REFERENCES `native_rehearsals(id)` ON DELETE CASCADE
- FOREIGN KEY: `user_id` REFERENCES `native_users(id)` ON DELETE CASCADE
- UNIQUE: `(rehearsal_id, user_id)` (one response per user per rehearsal)

**Indexes:**
- Primary key index on `id`
- Index on `rehearsal_id` (for "get all responses for rehearsal" queries)
- Index on `user_id` (for "get all responses by user" queries)
- Unique index on `(rehearsal_id, user_id)`

**Usage Note:**
- When creating/updating rehearsals with `participant_ids`, the API automatically creates 'yes' responses
- Edit mode: deletes all existing responses for rehearsal, then inserts new ones based on selected participants
- UPSERT pattern: `ON CONFLICT (rehearsal_id, user_id) DO UPDATE SET response = EXCLUDED.response, updated_at = NOW()`

**Migration History:**
- Added in add-rehearsal-responses-table.sql

---

### 6. native_user_availability

**Purpose:** Store user availability/busy time slots (supports manual entry and calendar imports)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | SERIAL | NO | - | Primary key |
| user_id | INTEGER | NO | - | Foreign key to native_users.id |
| starts_at | TIMESTAMPTZ | NO | - | **Availability start time in UTC** |
| ends_at | TIMESTAMPTZ | NO | - | **Availability end time in UTC** |
| type | VARCHAR | NO | 'busy' | Type: 'busy' or 'available' |
| title | VARCHAR | YES | NULL | Event title (from calendar imports) |
| notes | TEXT | YES | NULL | Additional notes or description |
| is_all_day | BOOLEAN | NO | FALSE | All-day event flag |
| source | VARCHAR | NO | 'manual' | Source: 'manual', 'google', 'apple' |
| external_event_id | VARCHAR | YES | NULL | ID from external calendar (for sync tracking) |
| created_at | TIMESTAMPTZ | NO | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | NO | NOW() | Last update timestamp |

**Constraints:**
- PRIMARY KEY: `id`
- FOREIGN KEY: `user_id` REFERENCES `native_users(id)` ON DELETE CASCADE
- CHECK: `ends_at > starts_at` (ensure valid time range)

**Indexes:**
- Primary key index on `id`
- Index on `user_id` (for "get all availability for user" queries)
- Index on `starts_at` (for date range queries)
- Index on `ends_at` (for date range queries)
- Composite index on `(user_id, starts_at, ends_at)` (for optimized user availability queries)
- Composite index on `(starts_at, ends_at)` (for time range overlap queries)

**CRITICAL TIMEZONE NOTE:**
- Same TIMESTAMPTZ behavior as rehearsals
- All-day availability stored as full day in UTC (00:00:00 to 23:59:00)
- Used for conflict detection when scheduling rehearsals

**Schema Notes:**
- `type` = 'busy': user is unavailable during this time (default)
- `type` = 'available': user explicitly marked as available (for positive availability)
- `source` = 'manual': user created this via app
- `source` = 'google': imported from Google Calendar
- `source` = 'apple': imported from Apple Calendar (via expo-calendar)
- `external_event_id`: stores original event ID for sync tracking (prevents duplicates on re-import)
- `title` and `notes`: populated from calendar event details when importing

**Performance Note:** The time range indexes are critical for conflict detection algorithms.

**Migration History:**
- Originally used `date`, `start_time`, `end_time` columns
- Migrated to `starts_at`/`ends_at` TIMESTAMPTZ in migrate-availability-to-timestamptz.sql
- Old columns dropped in drop-old-availability-columns.sql
- Added `type`, `title`, `notes`, `source`, `external_event_id` for calendar sync support

---

### 7. native_calendar_connections

**Purpose:** Store calendar sync connections (supports both OAuth Google Calendar and device-based Apple Calendar via expo-calendar)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | SERIAL | NO | - | Primary key |
| user_id | INTEGER | NO | - | Foreign key to native_users.id |
| provider | VARCHAR | NO | - | Calendar provider: 'google', 'apple', 'device' |
| access_token | VARCHAR | YES | NULL | OAuth access token (Google Calendar API only) |
| refresh_token | VARCHAR | YES | NULL | OAuth refresh token (Google Calendar API only) |
| token_expires_at | TIMESTAMPTZ | YES | NULL | OAuth token expiration (Google Calendar API only) |
| calendar_id | VARCHAR | YES | NULL | External calendar ID (Google Calendar API only) |
| device_calendar_id | VARCHAR | YES | NULL | Device calendar ID from expo-calendar |
| device_calendar_name | VARCHAR | YES | NULL | Device calendar display name |
| sync_enabled | BOOLEAN | NO | TRUE | Enable/disable sync for this connection |
| created_at | TIMESTAMPTZ | NO | NOW() | Connection creation timestamp |
| updated_at | TIMESTAMPTZ | NO | NOW() | Last update timestamp |

**Constraints:**
- PRIMARY KEY: `id`
- FOREIGN KEY: `user_id` REFERENCES `native_users(id)` ON DELETE CASCADE
- CHECK: `calendar_id IS NOT NULL OR device_calendar_id IS NOT NULL` (at least one ID required)

**Indexes:**
- Primary key index on `id`
- Index on `user_id` (for "get all calendar connections for user" queries)
- Index on `device_calendar_id` (for device calendar lookups)

**Usage Note:**
- OAuth fields (access_token, calendar_id) are nullable for device-based sync (expo-calendar)
- Device fields (device_calendar_id) are used for Apple Calendar sync via system permissions
- Supports both approaches in same table

**Migration History:**
- OAuth fields made nullable in adapt-calendar-tables-for-expo.sql
- Device fields added in adapt-calendar-tables-for-expo.sql

---

### 8. native_calendar_event_mappings

**Purpose:** Track bidirectional mapping between internal events (rehearsals/availability) and external calendar events

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | SERIAL | NO | - | Primary key |
| connection_id | INTEGER | NO | - | Foreign key to native_calendar_connections.id |
| event_type | VARCHAR | NO | - | Internal event type: 'rehearsal' or 'availability' |
| internal_event_id | INTEGER | NO | - | ID of rehearsal or availability record |
| external_event_id | VARCHAR | NO | - | ID of event in external calendar (from expo-calendar or Google API) |
| external_event_etag | VARCHAR | YES | NULL | ETag for change detection (Google Calendar API only) |
| last_sync_direction | VARCHAR | YES | NULL | Last sync direction: 'export' (app→calendar) or 'import' (calendar→app) |
| last_synced_at | TIMESTAMPTZ | YES | NULL | Timestamp of last successful sync |
| created_at | TIMESTAMPTZ | NO | NOW() | Mapping creation timestamp |
| updated_at | TIMESTAMPTZ | NO | NOW() | Last update timestamp |

**Constraints:**
- PRIMARY KEY: `id`
- FOREIGN KEY: `connection_id` REFERENCES `native_calendar_connections(id)` ON DELETE CASCADE
- UNIQUE: `(connection_id, event_type, internal_event_id)` (one mapping per internal event per connection)

**Indexes:**
- Primary key index on `id`
- Index on `connection_id` (for "get all mappings for connection" queries)
- Composite index on `(event_type, internal_event_id)` (for "find mapping for internal event" queries)
- Index on `external_event_id` (for "find mapping by external event ID" queries)

**Usage Note:**
- Used for two-way sync to prevent duplicate events
- Enables updating existing calendar events instead of creating new ones
- ETag used for efficient change detection with Google Calendar API

**Migration History:**
- Created in initial schema
- Comments added in adapt-calendar-tables-for-expo.sql

---

## Performance Optimization

### Critical Indexes for Performance

1. **Calendar View Queries** (most frequent):
   - `native_rehearsals(project_id, starts_at, ends_at)` - Composite index speeds up timeline rendering
   - `native_user_availability(user_id, starts_at, ends_at)` - Critical for availability display

2. **Conflict Detection** (CPU-intensive):
   - `native_user_availability(starts_at, ends_at)` - Enables fast time range overlap queries
   - `native_rehearsal_responses(rehearsal_id)` - Fast participant lookup

3. **Dashboard Queries**:
   - `native_project_members(user_id)` - Fast project list for user
   - `native_rehearsals(project_id, starts_at)` - Fast upcoming rehearsals

### Query Patterns to Watch

**❌ AVOID:**
```sql
-- Don't use LIKE on timestamps
SELECT * FROM native_rehearsals WHERE starts_at::TEXT LIKE '2025-12%';

-- Don't convert timezone in WHERE clause (breaks index usage)
SELECT * FROM native_rehearsals WHERE starts_at AT TIME ZONE 'America/New_York' > NOW();
```

**✅ PREFER:**
```sql
-- Use range queries on TIMESTAMPTZ
SELECT * FROM native_rehearsals
WHERE starts_at >= '2025-12-01T00:00:00Z'
  AND starts_at < '2026-01-01T00:00:00Z';

-- Keep timezone conversion in SELECT only
SELECT *, starts_at AT TIME ZONE 'America/New_York' as local_time
FROM native_rehearsals
WHERE starts_at > NOW();
```

---

## TIMESTAMPTZ and Timezone Handling

### Storage Strategy

- **All timestamps in UTC:** PostgreSQL TIMESTAMPTZ stores internally in UTC
- **Automatic conversion:** Client sends ISO 8601 with timezone → PostgreSQL converts to UTC
- **Query-time conversion:** Session timezone or explicit `AT TIME ZONE` converts on read
- **All-day events:** Stored as 00:00:00 to 23:59:00 UTC with `is_all_day = TRUE` flag

### Client-Server Contract

**Client sends:**
```json
{
  "startsAt": "2025-12-27T14:00:00-05:00",  // ISO 8601 with timezone
  "endsAt": "2025-12-27T16:00:00-05:00"
}
```

**PostgreSQL stores (internally):**
```
starts_at: 2025-12-27 19:00:00+00  (converted to UTC)
ends_at:   2025-12-27 21:00:00+00
```

**Client receives:**
```json
{
  "startsAt": "2025-12-27T19:00:00.000Z",  // UTC ISO string
  "endsAt": "2025-12-27T21:00:00.000Z"
}
```

### Migration Notes

The timezone migration was done in two phases:

1. **Phase 1:** Add `starts_at`/`ends_at` columns, populate from old `date + time` columns
2. **Phase 2:** Drop old `date`, `start_time`, `end_time` columns after code migration

This approach ensured zero-downtime deployment.

---

## Migration Map

Migrations are located in: `server/migrations/`

### Chronological Order

| # | File | Date | Purpose |
|---|------|------|---------|
| 1 | `schema-native.sql` | 2024 | Initial schema (SQLite, for reference only) |
| 2 | `add-rehearsal-responses-table.sql` | 2025-01 | Add RSVP/attendance tracking |
| 3 | `migrate-rehearsals-to-timestamptz.sql` | 2025-12-10 | Add TIMESTAMPTZ columns to rehearsals |
| 4 | `migrate-availability-to-timestamptz.sql` | 2025-12-10 | Add TIMESTAMPTZ columns to availability |
| 5 | `drop-old-rehearsal-columns.sql` | 2025-12-11 | Remove old date/time columns from rehearsals |
| 6 | `drop-old-availability-columns.sql` | 2025-12-11 | Remove old date/time columns from availability |
| 7 | `fix-date-column-types.sql` | 2025-12 | Fix date column types (obsolete, columns later dropped) |
| 8 | `add-rehearsal-title-description.sql` | 2025-12 | Add title and description to rehearsals |
| 9 | `add-is-all-day-flag.sql` | 2025-12 | Add all-day event support |
| 10 | `adapt-calendar-tables-for-expo.sql` | 2025-12 | Adapt for expo-calendar device sync |
| 11 | `add-week-start-preference.sql` | 2026-01-02 | Add week start day preference (Monday/Sunday) |
| 11 | `add-pending-response-status.sql` | 2026-01-01 | Add pending response status |

### Migration Dependencies

```
schema-native.sql (base)
  ├─ add-rehearsal-responses-table.sql
  ├─ migrate-rehearsals-to-timestamptz.sql
  │   └─ drop-old-rehearsal-columns.sql
  ├─ migrate-availability-to-timestamptz.sql
  │   └─ drop-old-availability-columns.sql
  ├─ add-rehearsal-title-description.sql
  ├─ add-is-all-day-flag.sql
  └─ adapt-calendar-tables-for-expo.sql
```

---

## AI Safety Rules for Database Operations

### ⚠️ CRITICAL: Always Use Parameterized Queries

**❌ NEVER DO THIS:**
```javascript
// SQL injection vulnerability!
const query = `SELECT * FROM native_users WHERE email = '${userInput}'`;
await db.query(query);
```

**✅ ALWAYS DO THIS:**
```javascript
// Safe: parameterized query
const query = 'SELECT * FROM native_users WHERE email = $1';
await db.query(query, [userInput]);
```

### Table Name Consistency Rules

1. **Native app tables ALWAYS use `native_` prefix**
   - ✅ `native_users`, `native_rehearsals`, `native_projects`
   - ❌ `users`, `rehearsals`, `projects` (these are legacy Telegram bot tables)

2. **Always verify table names in JOINs**
   ```sql
   -- ✅ CORRECT
   SELECT r.*, u.first_name, u.last_name
   FROM native_rehearsal_responses r
   JOIN native_users u ON r.user_id = u.id

   -- ❌ WRONG (caused 500 error in production)
   SELECT r.*, u.name
   FROM native_rehearsal_responses r
   JOIN users u ON r.user_id = u.id  -- Wrong table name!
   ```

3. **Grep for table references when making changes**
   ```bash
   # Before modifying a table, check all references:
   grep -r "native_users" server/
   ```

### Timezone Handling Rules

1. **Always use TIMESTAMPTZ, never TIMESTAMP**
   - TIMESTAMPTZ stores timezone info (converted to UTC)
   - TIMESTAMP does not (causes timezone bugs)

2. **Always send/receive ISO 8601 strings with timezone**
   - Client → Server: `"2025-12-27T14:00:00-05:00"`
   - Server → Client: `"2025-12-27T19:00:00.000Z"`

3. **Never do timezone math in application code**
   - Let PostgreSQL handle it
   - Use `AT TIME ZONE` in queries if needed

### Foreign Key Cascade Rules

1. **Use CASCADE for ownership relationships:**
   - `native_project_members.project_id` → `ON DELETE CASCADE` (members belong to project)
   - `native_rehearsals.project_id` → `ON DELETE CASCADE` (rehearsals belong to project)

2. **Use SET NULL for optional relationships:**
   - `native_projects.invite_created_by` → `ON DELETE SET NULL` (invite can exist without creator)
   - `native_rehearsals.created_by` → `ON DELETE SET NULL` (rehearsal can exist without creator)

3. **Never manually delete child records before parent**
   - Let CASCADE handle it automatically

### Migration Safety Checklist

Before writing a migration:

- [ ] Does it have safety checks? (e.g., `DO $$ BEGIN ... END $$;` blocks)
- [ ] Does it handle NULL values correctly?
- [ ] Does it preserve existing data?
- [ ] Does it have a rollback plan documented?
- [ ] Does it add necessary indexes?
- [ ] Is it idempotent? (can be run multiple times safely)
- [ ] Does it test with `IF NOT EXISTS` / `IF EXISTS` where appropriate?

---

## Schema Change Checklist

When making database changes, follow this checklist:

### Planning Phase

- [ ] Document the change purpose in a migration file comment
- [ ] Check if change affects existing data
- [ ] Plan for zero-downtime deployment (if production)
- [ ] Design rollback strategy

### Implementation Phase

- [ ] Create migration file with clear name (e.g., `add-column-name.sql`)
- [ ] Add safety checks (verify prerequisites, check for NULL values)
- [ ] Use parameterized queries (always $1, $2, never string concatenation)
- [ ] Add appropriate indexes for new columns
- [ ] Add appropriate constraints (FOREIGN KEY, CHECK, UNIQUE)
- [ ] Test migration on copy of production data

### Code Update Phase

- [ ] Update TypeScript types if schema changed
- [ ] Update API endpoints that use modified tables
- [ ] Update frontend models/types
- [ ] Search codebase for hardcoded column names
- [ ] Update this DB_SCHEMA.md document

### Testing Phase

- [ ] Test migration on development database
- [ ] Verify rollback works
- [ ] Test affected API endpoints
- [ ] Check for N+1 query problems
- [ ] Run performance tests on large dataset

### Deployment Phase

- [ ] Run migration on staging first
- [ ] Monitor error logs during/after deployment
- [ ] Verify indexes are being used (`EXPLAIN ANALYZE`)
- [ ] Update migration map in this document

---

## Common Patterns

### Creating a Rehearsal with Participants

```javascript
// 1. Create rehearsal
const rehearsal = await db.query(
  'INSERT INTO native_rehearsals (project_id, starts_at, ends_at, location, created_by) VALUES ($1, $2::timestamptz, $3::timestamptz, $4, $5) RETURNING *',
  [projectId, startsAt, endsAt, location, userId]
);

// 2. Add participant responses
for (const participantId of participant_ids) {
  await db.query(
    'INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response) VALUES ($1, $2, $3) ON CONFLICT (rehearsal_id, user_id) DO UPDATE SET response = EXCLUDED.response, updated_at = NOW()',
    [rehearsal.id, participantId, 'yes']
  );
}
```

### Updating Rehearsal Participants

```javascript
// 1. Delete existing responses
await db.query('DELETE FROM native_rehearsal_responses WHERE rehearsal_id = $1', [rehearsalId]);

// 2. Insert new responses
for (const userId of newParticipantIds) {
  await db.query(
    'INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response) VALUES ($1, $2, $3)',
    [rehearsalId, userId, 'yes']
  );
}
```

### Checking Availability Conflicts

```javascript
// Find overlapping busy time for users
const conflicts = await db.query(`
  SELECT ua.user_id, ua.starts_at, ua.ends_at, ua.type, ua.title
  FROM native_user_availability ua
  WHERE ua.user_id = ANY($1)
    AND ua.type = 'busy'
    AND ua.starts_at < $3::timestamptz
    AND ua.ends_at > $2::timestamptz
`, [userIds, rehearsalStartsAt, rehearsalEndsAt]);
```

### Bulk Import Calendar Availability

```javascript
// Import busy times from external calendar
for (const event of calendarEvents) {
  await db.query(`
    INSERT INTO native_user_availability
    (user_id, starts_at, ends_at, type, title, source, external_event_id, is_all_day)
    VALUES ($1, $2::timestamptz, $3::timestamptz, $4, $5, $6, $7, $8)
    ON CONFLICT (user_id, external_event_id)
    DO UPDATE SET
      starts_at = EXCLUDED.starts_at,
      ends_at = EXCLUDED.ends_at,
      title = EXCLUDED.title,
      updated_at = NOW()
  `, [
    userId,
    event.start,
    event.end,
    'busy',
    event.title,
    'google', // or 'apple'
    event.id,
    event.isAllDay
  ]);
}
```

---

## Related Documentation

- [../rehearsal-calendar-native/docs/project-info.md](../../rehearsal-calendar-native/docs/project-info.md) - Project overview and architecture
- [DOCUMENTATION_MAP.md](./DOCUMENTATION_MAP.md) - Complete documentation index
- [server/migrations/](../rehearsal-calendar-native/server/migrations/) - Migration files
- [server/database/schema-native.sql](../rehearsal-calendar-native/server/database/schema-native.sql) - SQLite schema (dev reference)

---

**Last Updated:** 2025-12-28
**Schema Version:** v10
**Maintained By:** AI + Development Team
