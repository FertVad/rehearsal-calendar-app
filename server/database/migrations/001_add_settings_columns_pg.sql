-- Migration: Add settings columns to actors and projects tables (PostgreSQL)
-- Created: 2025-10-18
-- Description: Add user settings (ui_language) and project settings (work_hours, notifications)

-- PostgreSQL version
-- Add ui_language to actors table
ALTER TABLE actors ADD COLUMN IF NOT EXISTS ui_language VARCHAR(2) DEFAULT 'en';

-- Add settings columns to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS work_hours_start VARCHAR(5) DEFAULT '09:00';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS work_hours_end VARCHAR(5) DEFAULT '22:00';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS notification_language VARCHAR(2) DEFAULT 'en';
