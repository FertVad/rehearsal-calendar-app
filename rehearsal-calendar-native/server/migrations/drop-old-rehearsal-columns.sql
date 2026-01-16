-- Migration: Drop old DATE + TIME columns from native_rehearsals
-- Date: December 11, 2025
-- Purpose: Cleanup after migrating to TIMESTAMPTZ columns
-- Requires: migrate-rehearsals-to-timestamptz.sql (must be run first)

-- =============================================================================
-- SAFETY CHECKS
-- =============================================================================

-- Verify new columns exist and are populated
DO $$
BEGIN
  -- Check if starts_at and ends_at columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'native_rehearsals'
    AND column_name IN ('starts_at', 'ends_at')
    HAVING COUNT(*) = 2
  ) THEN
    RAISE EXCEPTION 'New TIMESTAMPTZ columns (starts_at, ends_at) do not exist. Run migration first.';
  END IF;

  -- Check if any rows have NULL in new columns
  IF EXISTS (
    SELECT 1 FROM native_rehearsals
    WHERE starts_at IS NULL OR ends_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Found NULL values in starts_at or ends_at. Data migration incomplete.';
  END IF;

  RAISE NOTICE 'Safety checks passed. Proceeding with column removal.';
END $$;

-- =============================================================================
-- DROP OLD COLUMNS
-- =============================================================================

-- Drop old columns that are no longer needed
ALTER TABLE native_rehearsals
  DROP COLUMN IF EXISTS date,
  DROP COLUMN IF EXISTS start_time,
  DROP COLUMN IF EXISTS end_time;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Verify columns are dropped
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'native_rehearsals'
    AND column_name IN ('date', 'start_time', 'end_time')
  ) THEN
    RAISE WARNING 'Old columns still exist in native_rehearsals table';
  ELSE
    RAISE NOTICE 'Successfully dropped old columns from native_rehearsals';
  END IF;
END $$;

-- =============================================================================
-- ROLLBACK PLAN (IF NEEDED)
-- =============================================================================

-- If you need to rollback, you would need to:
-- 1. Restore from database backup
-- OR
-- 2. Re-add columns and populate from starts_at/ends_at:
--
-- ALTER TABLE native_rehearsals
--   ADD COLUMN date DATE,
--   ADD COLUMN start_time TIME,
--   ADD COLUMN end_time TIME;
--
-- UPDATE native_rehearsals
-- SET
--   date = DATE(starts_at AT TIME ZONE 'UTC'),
--   start_time = (starts_at AT TIME ZONE 'UTC')::TIME,
--   end_time = (ends_at AT TIME ZONE 'UTC')::TIME;
--
-- ALTER TABLE native_rehearsals
--   ALTER COLUMN date SET NOT NULL,
--   ALTER COLUMN start_time SET NOT NULL,
--   ALTER COLUMN end_time SET NOT NULL;
