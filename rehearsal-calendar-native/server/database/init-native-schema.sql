-- ============================================================================
-- Base schema for a new environment.
--
-- Verified against production on 2026-09-05 — every column and every live table
-- read off the database rather than written from memory, because this file had
-- drifted badly and nobody could have known: it is never run against an
-- existing database, so it fails silently and only when someone provisions a
-- new one.
--
-- What it deliberately leaves out:
--   * native_subscription_plans, native_user_subscriptions,
--     native_payment_transactions, native_allpay_webhook_events — the payment
--     integration was removed; these survive on production because dropping
--     them is irreversible and buys nothing, but a new environment needs none.
--   * native_rehearsal_participants — the predecessor of
--     native_rehearsal_responses. Empty, and nothing reads it.
--   * native_activity_log — empty, and nothing reads it.
--
-- Setting up a new database: run this, then `npm run migrate -- --baseline`.
-- The baseline records the migrations as done *without running them*, which is
-- why everything they create has to be here too.
-- ============================================================================

-- Initialize Native App Schema
-- Creates all native_* tables for the React Native application

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS native_calendar_event_mappings;
DROP TABLE IF EXISTS native_calendar_connections;
DROP TABLE IF EXISTS native_user_availability;
DROP TABLE IF EXISTS native_rehearsal_responses;
DROP TABLE IF EXISTS native_rehearsals;
DROP TABLE IF EXISTS native_project_members;
DROP TABLE IF EXISTS native_projects;
-- Don't drop native_users as it might already exist

-- Create native_users table (if not exists)
CREATE TABLE IF NOT EXISTS native_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR,                    -- Nullable for OAuth-only users
  first_name VARCHAR NOT NULL,
  last_name VARCHAR,
  phone VARCHAR(50),                        -- User phone number
  avatar_url TEXT,                          -- Profile avatar URL (from OAuth or manual)
  timezone VARCHAR DEFAULT 'UTC',
  locale VARCHAR DEFAULT 'en',
  week_start_day VARCHAR(10) DEFAULT 'monday',
  notifications_enabled BOOLEAN DEFAULT 1,
  email_notifications BOOLEAN DEFAULT 1,
  onboarding_completed BOOLEAN DEFAULT 0,
  token_version INTEGER NOT NULL DEFAULT 1, -- Incremented to revoke all sessions
  last_login_at DATETIME,                   -- Track last login timestamp
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- Present on production and missing here until 2026-09-05.
  telegram_id BIGINT,
  push_token TEXT
);

-- Create native_auth_providers table (OAuth support)
CREATE TABLE IF NOT EXISTS native_auth_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider_type VARCHAR(20) NOT NULL,       -- 'email', 'google', 'apple'
  provider_user_id VARCHAR(255),            -- External OAuth user ID (NULL for email provider)
  provider_email VARCHAR(255),              -- Email from OAuth provider
  provider_metadata TEXT,                   -- JSON metadata from provider (optional)
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  last_used_at DATETIME,                    -- Track when this provider was last used
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE,
  UNIQUE(provider_type, provider_user_id),  -- Prevent duplicate OAuth accounts
  CHECK (provider_type IN ('email', 'google', 'apple'))
);

-- Create native_projects table
CREATE TABLE native_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR NOT NULL,
  description TEXT,
  timezone VARCHAR NOT NULL DEFAULT 'UTC',
  invite_code VARCHAR(32) UNIQUE,
  invite_expires_at DATETIME,
  invite_created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- Present on production and missing here until 2026-09-05.
  color VARCHAR(7) DEFAULT '#A855F7',
  start_date DATE,
  end_date DATE,
  premiere_date DATE,
  status VARCHAR(20) DEFAULT 'active',
  FOREIGN KEY (invite_created_by) REFERENCES native_users(id) ON DELETE SET NULL
);

-- Create native_project_members table
CREATE TABLE native_project_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  role VARCHAR NOT NULL DEFAULT 'member',
  status VARCHAR NOT NULL DEFAULT 'active',
  invited_at DATETIME,
  joined_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- character_name is selected by GET /projects/:id/members, so a database built without it answered 500.
  character_name VARCHAR(100),
  invite_code VARCHAR(32),
  expires_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES native_projects(id) ON DELETE CASCADE,
  UNIQUE(user_id, project_id)
);

-- Create native_rehearsals table
CREATE TABLE native_rehearsals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  title VARCHAR,
  description TEXT,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  location VARCHAR,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- Present on production and missing here until 2026-09-05.
  location_address TEXT,
  location_notes TEXT,
  status VARCHAR(20) DEFAULT 'scheduled',
  recurrence_rule TEXT,
  parent_rehearsal_id INTEGER,
  is_all_day BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (project_id) REFERENCES native_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES native_users(id) ON DELETE SET NULL,
  CHECK (ends_at > starts_at)
);

-- Create native_rehearsal_responses table
CREATE TABLE native_rehearsal_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rehearsal_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  response VARCHAR NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rehearsal_id) REFERENCES native_rehearsals(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE,
  UNIQUE(rehearsal_id, user_id)
);

-- Create native_user_availability table
CREATE TABLE native_user_availability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  type VARCHAR NOT NULL DEFAULT 'busy',
  title VARCHAR,
  notes TEXT,
  is_all_day BOOLEAN NOT NULL DEFAULT 0,
  source VARCHAR NOT NULL DEFAULT 'manual',
  external_event_id VARCHAR,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- Present on production and missing here until 2026-09-05.
  recurrence_rule TEXT,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE,
  CHECK (ends_at > starts_at)
);

-- Create native_calendar_connections table
CREATE TABLE native_calendar_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider VARCHAR NOT NULL,
  access_token VARCHAR,
  refresh_token VARCHAR,
  calendar_id VARCHAR,
  calendar_name VARCHAR,
  device_calendar_id VARCHAR,
  device_calendar_name VARCHAR,
  sync_enabled BOOLEAN NOT NULL DEFAULT 1,
  sync_direction VARCHAR NOT NULL DEFAULT 'both',
  last_sync_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- Present on production and missing here until 2026-09-05.
  token_expires_at TIMESTAMP,
  sync_token TEXT,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE,
  CHECK (calendar_id IS NOT NULL OR device_calendar_id IS NOT NULL)
);

-- Create native_calendar_event_mappings table
CREATE TABLE native_calendar_event_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  connection_id INTEGER NOT NULL,
  event_type VARCHAR NOT NULL,
  internal_event_id INTEGER NOT NULL,
  external_event_id VARCHAR NOT NULL,
  external_event_etag VARCHAR,
  last_sync_at DATETIME,
  last_sync_direction VARCHAR,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (connection_id) REFERENCES native_calendar_connections(id) ON DELETE CASCADE
);


-- ============================================================================
-- Tables that were only ever created by hand or by a migration.
--
-- A fresh environment used to come up without them. The documented procedure is
-- to run this file and then `migrate --baseline`, which records every migration
-- as done *without running it* — so anything a migration created was never
-- created, and four more tables were made straight on production and written
-- down nowhere at all. The notification inbox, push delivery, reminders and bug
-- reports were all missing from a database built by the book.
--
-- Read off production on 2026-09-05 rather than written from memory.
-- ============================================================================

-- Push tokens: one row per device per account. The unique pair is what lets a
-- device be handed to a different person without their notifications following.
CREATE TABLE native_push_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  device_token VARCHAR(255) NOT NULL,
  device_type VARCHAR(20),
  device_name VARCHAR(100),
  last_active_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, device_token),
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE
);

-- Reminders already sent. The unique pair is claimed before the push goes out,
-- so two overlapping schedulers cannot announce the same rehearsal twice.
CREATE TABLE native_push_reminders (
  id SERIAL PRIMARY KEY,
  rehearsal_id INTEGER NOT NULL,
  reminder_type VARCHAR(10) NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL,
  UNIQUE (rehearsal_id, reminder_type),
  FOREIGN KEY (rehearsal_id) REFERENCES native_rehearsals(id) ON DELETE CASCADE
);

-- The notification inbox. One row per intended recipient, written before the
-- push is sent — including recipients with no device registered, who would
-- otherwise never learn what happened.
CREATE TABLE native_notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  data JSONB,
  read_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  related_type VARCHAR(20),
  related_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE
);

-- Beta bug reports, reachable from the banner on every tab screen.
CREATE TABLE native_bug_reports (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  screen VARCHAR(255),
  status VARCHAR(20) DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX idx_auth_providers_user_id ON native_auth_providers(user_id);
CREATE INDEX idx_auth_providers_provider ON native_auth_providers(provider_type, provider_user_id);
CREATE INDEX idx_auth_providers_email ON native_auth_providers(provider_email);
CREATE INDEX idx_project_members_user_id ON native_project_members(user_id);
CREATE INDEX idx_project_members_project_id ON native_project_members(project_id);
CREATE INDEX idx_rehearsals_project_id ON native_rehearsals(project_id);
CREATE INDEX idx_rehearsals_starts_at ON native_rehearsals(starts_at);
CREATE INDEX idx_rehearsals_ends_at ON native_rehearsals(ends_at);
CREATE INDEX idx_rehearsal_responses_rehearsal_id ON native_rehearsal_responses(rehearsal_id);
CREATE INDEX idx_rehearsal_responses_user_id ON native_rehearsal_responses(user_id);
CREATE INDEX idx_user_availability_user_id ON native_user_availability(user_id);
CREATE INDEX idx_user_availability_starts_at ON native_user_availability(starts_at);
CREATE INDEX idx_calendar_connections_user_id ON native_calendar_connections(user_id);
CREATE INDEX idx_calendar_event_mappings_connection_id ON native_calendar_event_mappings(connection_id);
CREATE INDEX idx_calendar_event_mappings_internal_event ON native_calendar_event_mappings(event_type, internal_event_id);

-- Success message
SELECT 'Native schema initialized successfully!' as message;
