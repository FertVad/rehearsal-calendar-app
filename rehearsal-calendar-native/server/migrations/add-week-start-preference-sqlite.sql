-- Migration: Add week_start_day preference to native_users table (SQLite version)
-- Date: 2026-01-02
-- Purpose: Allow users to choose whether their calendar week starts on Monday or Sunday

-- Add week_start_day column with default value
ALTER TABLE native_users
ADD COLUMN week_start_day VARCHAR(10) DEFAULT 'monday';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_native_users_week_start_day
ON native_users(week_start_day);

-- Note: Default value 'monday' maintains current app behavior for existing users
-- Note: SQLite doesn't support CHECK constraints on ALTER TABLE, will add in CREATE TABLE
