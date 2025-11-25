-- Migration: Add native app authentication to actors table (PostgreSQL)
-- This allows actors to login via email/password in native app
-- AND via Telegram in mini app - unified user table!

-- Make telegram_id nullable (so native-only users can exist)
ALTER TABLE actors ALTER COLUMN telegram_id DROP NOT NULL;

-- Add email and password columns to actors
ALTER TABLE actors
  ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_actors_email ON actors(email);

-- Note:
-- - telegram_id is nullable for native-only users (will be NULL until they connect TG)
-- - email/password_hash are nullable for TG-only users (will be NULL until they register in native app)
-- - When user exists in both: they can login with either method
-- - Use telegram_id to link TG mini app user to native app user

-- Example flows:
-- 1. User registers in native app:
--    INSERT INTO actors (name, email, password_hash) VALUES ('John', 'john@mail.com', 'hash')
--    Later when they use TG mini app: UPDATE actors SET telegram_id = '12345' WHERE email = 'john@mail.com'
--
-- 2. User already in TG mini app:
--    Actor exists with telegram_id='12345', name='John'
--    They register in native app: UPDATE actors SET email='john@mail.com', password_hash='hash' WHERE telegram_id='12345'
--
-- 3. Linking accounts:
--    Native user: SELECT * FROM actors WHERE email = 'john@mail.com'
--    Add TG: UPDATE actors SET telegram_id = '12345' WHERE id = <user_id>
