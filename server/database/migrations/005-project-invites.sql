-- ==========================================
-- PROJECT INVITES
-- Migration: 005-project-invites.sql
-- ==========================================

-- Add invite_code column to native_project_members
ALTER TABLE native_project_members ADD COLUMN IF NOT EXISTS invite_code VARCHAR(32) UNIQUE;

-- Add expires_at for invite expiration
ALTER TABLE native_project_members ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

-- Create index for fast invite lookup
CREATE INDEX IF NOT EXISTS idx_native_project_members_invite_code ON native_project_members(invite_code) WHERE invite_code IS NOT NULL;
