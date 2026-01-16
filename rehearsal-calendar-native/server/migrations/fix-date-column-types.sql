-- Fix date column types to prevent timezone conversion
-- Change TIMESTAMP WITH TIME ZONE to DATE for date-only columns

-- Fix native_rehearsals.date column
ALTER TABLE native_rehearsals
  ALTER COLUMN date TYPE DATE USING date::DATE;

-- Fix native_user_availability.date column
ALTER TABLE native_user_availability
  ALTER COLUMN date TYPE DATE USING date::DATE;

-- Note: This migration converts existing TIMESTAMP WITH TIME ZONE values to DATE
-- The USING clause ensures data is preserved during conversion
