-- Migration: Add onboarding_completed field to native_users table
-- This field tracks whether the user has completed the onboarding flow
-- Run this migration on Neon database

ALTER TABLE native_users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Optional: Update existing users to have onboarding_completed = TRUE
-- (assuming existing users have already used the app without onboarding)
-- Uncomment the line below if you want to mark existing users as having completed onboarding:
-- UPDATE native_users SET onboarding_completed = TRUE WHERE onboarding_completed IS NULL;
