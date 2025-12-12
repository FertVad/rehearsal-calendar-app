-- Migration: Add TIMESTAMPTZ columns to native_rehearsals
-- Date: 2025-12-10
-- Purpose: Migrate from DATE + TIME columns to TIMESTAMPTZ for timezone-aware storage

-- =============================================================================
-- UP MIGRATION
-- =============================================================================

-- Step 1: Add new TIMESTAMPTZ columns (nullable for now)
ALTER TABLE native_rehearsals
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;

-- Step 2: Migrate existing data from (date, start_time, end_time) to (starts_at, ends_at)
-- Note: We assume existing data is in UTC (as per current server logic)
-- If data is not in UTC, adjust the timezone parameter accordingly
UPDATE native_rehearsals
SET
  starts_at = (date + start_time)::TIMESTAMPTZ,
  ends_at = (date + end_time)::TIMESTAMPTZ
WHERE starts_at IS NULL;

-- Step 3: Verify data integrity (run manually after migration)
-- SELECT COUNT(*) as unmigrated_count FROM native_rehearsals WHERE starts_at IS NULL OR ends_at IS NULL;

-- Step 4: Make new columns NOT NULL after data migration
ALTER TABLE native_rehearsals
  ALTER COLUMN starts_at SET NOT NULL,
  ALTER COLUMN ends_at SET NOT NULL;

-- Step 5: Add indexes on new columns for performance
CREATE INDEX IF NOT EXISTS idx_rehearsals_starts_at ON native_rehearsals(starts_at);
CREATE INDEX IF NOT EXISTS idx_rehearsals_ends_at ON native_rehearsals(ends_at);
CREATE INDEX IF NOT EXISTS idx_rehearsals_time_range ON native_rehearsals(starts_at, ends_at);

-- Step 6: Add check constraint to ensure ends_at > starts_at
ALTER TABLE native_rehearsals
  ADD CONSTRAINT chk_rehearsals_time_order
  CHECK (ends_at > starts_at);

-- =============================================================================
-- VERIFICATION QUERIES (run these manually after migration)
-- =============================================================================

-- Check sample data
-- SELECT id, date, start_time, end_time, starts_at, ends_at
-- FROM native_rehearsals
-- LIMIT 10;

-- Check for any time inconsistencies
-- SELECT COUNT(*) as inconsistent_rows
-- FROM native_rehearsals
-- WHERE DATE(starts_at) != date
--    OR starts_at::TIME != start_time
--    OR ends_at::TIME != end_time;

-- =============================================================================
-- DOWN MIGRATION (ROLLBACK)
-- =============================================================================

-- To rollback this migration:
-- ALTER TABLE native_rehearsals DROP CONSTRAINT IF EXISTS chk_rehearsals_time_order;
-- DROP INDEX IF EXISTS idx_rehearsals_time_range;
-- DROP INDEX IF EXISTS idx_rehearsals_ends_at;
-- DROP INDEX IF EXISTS idx_rehearsals_starts_at;
-- ALTER TABLE native_rehearsals DROP COLUMN IF EXISTS ends_at;
-- ALTER TABLE native_rehearsals DROP COLUMN IF EXISTS starts_at;

-- =============================================================================
-- NOTES
-- =============================================================================

-- 1. Old columns (date, start_time, end_time) are kept for backward compatibility
--    They will be removed in Phase 5 after all code is updated
--
-- 2. PostgreSQL TIMESTAMPTZ stores timestamps in UTC internally
--    Timezone conversion happens at query time based on session timezone
--
-- 3. This migration assumes current data is already in UTC
--    If data is in a different timezone, adjust the conversion logic in Step 2
--
-- 4. After this migration, update application code to use starts_at/ends_at
--    before removing the old columns
