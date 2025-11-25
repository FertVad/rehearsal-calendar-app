-- Migration: 004-add-project-timezone.sql
-- Add timezone field to projects table

ALTER TABLE projects ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Europe/Moscow';
