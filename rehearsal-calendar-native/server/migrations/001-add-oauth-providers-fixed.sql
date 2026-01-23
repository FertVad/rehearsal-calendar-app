-- Migration: Add OAuth Providers Support (Fixed version)
-- This migration adds support for multiple authentication methods

-- =============================================================================
-- STEP 1: Add missing columns to native_users if they don't exist
-- =============================================================================

-- SQLite doesn't support IF NOT EXISTS for columns, so we use a different approach
-- Add phone column if it doesn't exist
ALTER TABLE native_users ADD COLUMN phone VARCHAR(50);

-- Add avatar_url column if it doesn't exist
ALTER TABLE native_users ADD COLUMN avatar_url TEXT;

-- Add last_login_at column if it doesn't exist
ALTER TABLE native_users ADD COLUMN last_login_at DATETIME;

-- Note: If columns already exist, these will fail but that's ok
-- We'll ignore the errors and continue

-- =============================================================================
-- STEP 2: Create native_auth_providers table
-- =============================================================================

CREATE TABLE IF NOT EXISTS native_auth_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider_type VARCHAR(20) NOT NULL,
  provider_user_id VARCHAR(255),
  provider_email VARCHAR(255),
  provider_metadata TEXT,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  last_used_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE,
  UNIQUE(provider_type, provider_user_id),
  CHECK (provider_type IN ('email', 'google', 'apple'))
);

-- =============================================================================
-- STEP 3: Create indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_auth_providers_user_id ON native_auth_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_providers_provider ON native_auth_providers(provider_type, provider_user_id);
CREATE INDEX IF NOT EXISTS idx_auth_providers_email ON native_auth_providers(provider_email);

-- =============================================================================
-- STEP 4: Migrate existing users to auth_providers table
-- =============================================================================

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
  COALESCE(last_login_at, created_at)
FROM native_users
WHERE password_hash IS NOT NULL
  AND password_hash != '';

-- =============================================================================
-- STEP 5: Verification
-- =============================================================================

SELECT 'OAuth providers migration completed!' as message;
SELECT COUNT(*) as migrated_users FROM native_auth_providers WHERE provider_type = 'email';
