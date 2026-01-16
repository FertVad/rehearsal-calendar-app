-- Add is_all_day flag to native_user_availability table
-- This simplifies handling of all-day busy/available slots

-- Add the column (defaults to false for existing records)
ALTER TABLE native_user_availability
ADD COLUMN IF NOT EXISTS is_all_day BOOLEAN DEFAULT FALSE;

-- Update existing records where start_time='00:00' and end_time='23:59'
-- These are all-day slots
UPDATE native_user_availability
SET is_all_day = TRUE
WHERE (start_time = '00:00:00' OR start_time = '00:00')
  AND (end_time = '23:59:00' OR end_time = '23:59');

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_availability_is_all_day
ON native_user_availability(is_all_day);

-- Note: When is_all_day=true, start_time and end_time values are ignored
-- We can keep them as '00:00' and '23:59' for backwards compatibility
