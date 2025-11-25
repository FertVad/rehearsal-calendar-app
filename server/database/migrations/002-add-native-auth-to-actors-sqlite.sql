-- Migration: Add native app authentication to actors table (SQLite)
-- This allows actors to login via email/password in native app
-- AND via Telegram in mini app - unified user table!

-- Add columns (SQLite doesn't support UNIQUE constraint in ADD COLUMN)
ALTER TABLE actors ADD COLUMN email TEXT;
ALTER TABLE actors ADD COLUMN password_hash TEXT;

-- Create UNIQUE index on email for faster lookups and uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_actors_email_unique ON actors(email) WHERE email IS NOT NULL;
