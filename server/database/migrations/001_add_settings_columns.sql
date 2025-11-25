-- Migration: Add settings columns to actors and projects tables
-- Created: 2025-10-18
-- Description: Add user settings (ui_language) and project settings (work_hours, notifications)

-- SQLite version
-- Add ui_language to actors table
ALTER TABLE actors ADD COLUMN ui_language TEXT DEFAULT 'en';

-- Add settings columns to projects table
ALTER TABLE projects ADD COLUMN work_hours_start TEXT DEFAULT '09:00';
ALTER TABLE projects ADD COLUMN work_hours_end TEXT DEFAULT '22:00';
ALTER TABLE projects ADD COLUMN notifications_enabled INTEGER DEFAULT 0; -- BOOLEAN as INTEGER for SQLite
ALTER TABLE projects ADD COLUMN notification_language TEXT DEFAULT 'en';

-- Note: For PostgreSQL, run the corresponding migration from migrations/001_add_settings_columns_pg.sql
