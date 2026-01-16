-- Migration: Add title and description columns to native_rehearsals
-- Created: 2025-12-07

-- Add title column
ALTER TABLE native_rehearsals
ADD COLUMN IF NOT EXISTS title VARCHAR(255);

-- Add description column
ALTER TABLE native_rehearsals
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add comment
COMMENT ON COLUMN native_rehearsals.title IS 'Title of the rehearsal';
COMMENT ON COLUMN native_rehearsals.description IS 'Description or notes for the rehearsal';
