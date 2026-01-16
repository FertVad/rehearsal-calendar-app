-- Migration: Add TIMESTAMPTZ columns to native_user_availability
-- Date: 2025-12-10
-- Purpose: Migrate from DATE + TIME columns to TIMESTAMPTZ for timezone-aware storage

-- =============================================================================
-- UP MIGRATION
-- =============================================================================

-- Step 1: Add new TIMESTAMPTZ columns (nullable for now)
ALTER TABLE native_user_availability
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;

-- Step 2: Migrate existing data from (date, start_time, end_time) to (starts_at, ends_at)
-- Note: We assume existing data is in UTC (as per current server logic)
-- Special handling for all-day events: they should span the full day in UTC
UPDATE native_user_availability
SET
  starts_at = CASE
    WHEN is_all_day THEN date::TIMESTAMPTZ
    ELSE (date + start_time)::TIMESTAMPTZ
  END,
  ends_at = CASE
    WHEN is_all_day THEN (date + INTERVAL '23 hours 59 minutes')::TIMESTAMPTZ
    ELSE (date + end_time)::TIMESTAMPTZ
  END
WHERE starts_at IS NULL;

-- Step 3: Verify data integrity (run manually after migration)
-- SELECT COUNT(*) as unmigrated_count FROM native_user_availability WHERE starts_at IS NULL OR ends_at IS NULL;

-- Step 4: Make new columns NOT NULL after data migration
ALTER TABLE native_user_availability
  ALTER COLUMN starts_at SET NOT NULL,
  ALTER COLUMN ends_at SET NOT NULL;

-- Step 5: Add indexes on new columns for performance
CREATE INDEX IF NOT EXISTS idx_availability_starts_at ON native_user_availability(starts_at);
CREATE INDEX IF NOT EXISTS idx_availability_ends_at ON native_user_availability(ends_at);
CREATE INDEX IF NOT EXISTS idx_availability_user_time ON native_user_availability(user_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_availability_time_range ON native_user_availability(starts_at, ends_at);

-- Step 6: Add check constraint to ensure ends_at > starts_at
ALTER TABLE native_user_availability
  ADD CONSTRAINT chk_availability_time_order
  CHECK (ends_at > starts_at);

-- =============================================================================
-- VERIFICATION QUERIES (run these manually after migration)
-- =============================================================================

-- Check sample data
-- SELECT id, date, start_time, end_time, starts_at, ends_at, is_all_day
-- FROM native_user_availability
-- LIMIT 10;

-- Check for any time inconsistencies
-- SELECT COUNT(*) as inconsistent_rows
-- FROM native_user_availability
-- WHERE (NOT is_all_day)
--   AND (DATE(starts_at) != date
--    OR starts_at::TIME != start_time
--    OR ends_at::TIME != end_time);

-- Check all-day events
-- SELECT id, date, starts_at, ends_at, is_all_day
-- FROM native_user_availability
-- WHERE is_all_day = true;

-- =============================================================================
-- DOWN MIGRATION (ROLLBACK)
-- =============================================================================

-- To rollback this migration:
-- ALTER TABLE native_user_availability DROP CONSTRAINT IF EXISTS chk_availability_time_order;
-- DROP INDEX IF EXISTS idx_availability_time_range;
-- DROP INDEX IF EXISTS idx_availability_user_time;
-- DROP INDEX IF EXISTS idx_availability_ends_at;
-- DROP INDEX IF EXISTS idx_availability_starts_at;
-- ALTER TABLE native_user_availability DROP COLUMN IF EXISTS ends_at;
-- ALTER TABLE native_user_availability DROP COLUMN IF EXISTS starts_at;

-- =============================================================================
-- NOTES
-- =============================================================================

-- 1. Old columns (date, start_time, end_time) are kept for backward compatibility
--    They will be removed in Phase 5 after all code is updated
--
-- 2. PostgreSQL TIMESTAMPTZ stores timestamps in UTC internally
--    Timezone conversion happens at query time based on session timezone
--
-- 3. All-day events are stored as full day in UTC (00:00:00 to 23:59:00)
--    The is_all_day flag indicates how to display them in the UI
--
-- 4. After this migration, update application code to use starts_at/ends_at
--    before removing the old columns
