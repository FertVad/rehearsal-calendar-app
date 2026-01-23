-- Migration: Add OAuth Providers Support (PostgreSQL version for Neon)
-- This migration adds support for multiple authentication methods

-- =============================================================================
-- STEP 1: Add missing columns to native_users if they don't exist
-- =============================================================================

-- Add phone column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='native_users' AND column_name='phone') THEN
    ALTER TABLE native_users ADD COLUMN phone VARCHAR(50);
  END IF;
END $$;

-- Add avatar_url column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='native_users' AND column_name='avatar_url') THEN
    ALTER TABLE native_users ADD COLUMN avatar_url TEXT;
  END IF;
END $$;

-- Add last_login_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='native_users' AND column_name='last_login_at') THEN
    ALTER TABLE native_users ADD COLUMN last_login_at TIMESTAMPTZ;
  END IF;
END $$;

-- Make password_hash nullable (for OAuth-only users)
ALTER TABLE native_users ALTER COLUMN password_hash DROP NOT NULL;

-- =============================================================================
-- STEP 2: Create native_auth_providers table
-- =============================================================================

CREATE TABLE IF NOT EXISTS native_auth_providers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  provider_type VARCHAR(20) NOT NULL,
  provider_user_id VARCHAR(255),
  provider_email VARCHAR(255),
  provider_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMPTZ,
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

INSERT INTO native_auth_providers (
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
  AND password_hash != ''
ON CONFLICT (provider_type, provider_user_id) DO NOTHING;

-- =============================================================================
-- STEP 5: Verification
-- =============================================================================

SELECT 'OAuth providers migration completed for PostgreSQL!' as message;
SELECT COUNT(*) as total_users FROM native_users;
SELECT COUNT(*) as migrated_users FROM native_auth_providers WHERE provider_type = 'email';
