-- ==========================================
-- FIX: Move invite code to projects table
-- Migration: 006-project-invite-fix.sql
-- ==========================================

-- Add invite columns to native_projects table
ALTER TABLE native_projects ADD COLUMN IF NOT EXISTS invite_code VARCHAR(32) UNIQUE;
ALTER TABLE native_projects ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMP;
ALTER TABLE native_projects ADD COLUMN IF NOT EXISTS invite_created_by INTEGER REFERENCES native_users(id);

-- Create index for invite lookup
CREATE INDEX IF NOT EXISTS idx_native_projects_invite_code ON native_projects(invite_code) WHERE invite_code IS NOT NULL;

-- Remove the old invite columns from members table (if they exist)
-- Note: We'll leave them for now to avoid losing data, but they won't be used
