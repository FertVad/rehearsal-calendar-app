-- Migration: Add OAuth Providers Support
-- This migration adds support for multiple authentication methods (email, Google, Apple)
-- per user account with automatic linking based on email.

-- =============================================================================
-- CREATE native_auth_providers TABLE
-- =============================================================================
-- This table stores all authentication providers linked to a user account.
-- A user can have multiple providers (email + Google + Apple).

-- SQLite version:
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

-- PostgreSQL version (for Neon production):
-- CREATE TABLE IF NOT EXISTS native_auth_providers (
--   id SERIAL PRIMARY KEY,
--   user_id INTEGER NOT NULL,
--   provider_type VARCHAR(20) NOT NULL,
--   provider_user_id VARCHAR(255),
--   provider_email VARCHAR(255),
--   provider_metadata JSONB,
--   created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   last_used_at TIMESTAMPTZ,
--   FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE,
--   UNIQUE(provider_type, provider_user_id),
--   CHECK (provider_type IN ('email', 'google', 'apple'))
-- );

-- =============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_auth_providers_user_id
  ON native_auth_providers(user_id);

CREATE INDEX IF NOT EXISTS idx_auth_providers_provider
  ON native_auth_providers(provider_type, provider_user_id);

CREATE INDEX IF NOT EXISTS idx_auth_providers_email
  ON native_auth_providers(provider_email);

-- =============================================================================
-- ADD MISSING FIELDS TO native_users (if needed)
-- =============================================================================
-- These fields are referenced in auth.js but may not be in the schema.
-- SQLite doesn't support IF NOT EXISTS for columns, so we need conditional logic.
-- If columns already exist, these statements will fail silently.

-- For manual execution, check if these columns exist first:
-- phone, avatar_url, last_login_at

-- SQLite doesn't support ALTER COLUMN to make password_hash nullable,
-- so we'll handle nullable password_hash programmatically in the application.
-- OAuth-only users will have password_hash set to NULL or empty string.

-- =============================================================================
-- MIGRATE EXISTING USERS TO AUTH_PROVIDERS TABLE
-- =============================================================================
-- Create 'email' provider entries for all existing users with passwords.
-- This allows them to continue using email/password login and optionally
-- link Google/Apple accounts later.

INSERT OR IGNORE INTO native_auth_providers (
  user_id,
  provider_type,
  provider_email,
  created_at,
  updated_at,
  last_used_at
)
SELECT
  id,
  'email',
  email,
  created_at,
  updated_at,
  last_login_at
FROM native_users
WHERE password_hash IS NOT NULL
  AND password_hash != '';

-- For PostgreSQL, use ON CONFLICT instead of INSERT OR IGNORE:
-- INSERT INTO native_auth_providers (...)
-- SELECT ... FROM native_users ...
-- ON CONFLICT (provider_type, provider_user_id) DO NOTHING;

-- =============================================================================
-- VERIFICATION QUERY
-- =============================================================================
-- Check how many users were migrated

SELECT
  'OAuth providers migration completed!' as message,
  COUNT(*) as migrated_users
FROM native_auth_providers
WHERE provider_type = 'email';
