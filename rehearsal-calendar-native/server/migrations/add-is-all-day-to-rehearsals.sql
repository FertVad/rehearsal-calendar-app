-- Add is_all_day flag to native_rehearsals table
-- Allows marking rehearsals as all-day events (no specific start/end time)

-- Add the column (defaults to false for existing records)
ALTER TABLE native_rehearsals
ADD COLUMN IF NOT EXISTS is_all_day BOOLEAN DEFAULT FALSE;

-- Create index for faster queries on reminder scheduler
CREATE INDEX IF NOT EXISTS idx_rehearsals_is_all_day
ON native_rehearsals(is_all_day);

-- Note: When is_all_day=true, the exact time in starts_at/ends_at is ignored
-- The date component is still used to determine the rehearsal day
