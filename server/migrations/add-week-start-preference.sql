-- Migration: Add week_start_day preference to native_users table
-- Date: 2026-01-02
-- Purpose: Allow users to choose whether their calendar week starts on Monday or Sunday

-- Add week_start_day column with validation constraint
ALTER TABLE native_users
ADD COLUMN week_start_day VARCHAR(10) DEFAULT 'monday'
CHECK (week_start_day IN ('monday', 'sunday'));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_native_users_week_start_day
ON native_users(week_start_day);

-- Note: Default value 'monday' maintains current app behavior for existing users
-- PostgreSQL-specific comment (ignored by SQLite)
COMMENT ON COLUMN native_users.week_start_day IS
'User preference for calendar week start day: monday or sunday';
