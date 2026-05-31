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
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
