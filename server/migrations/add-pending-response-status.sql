-- Migration: Add 'pending' status to rehearsal responses
-- Created: 2026-01-01
-- Purpose: Allow invited participants to have a pending status before they respond

-- Drop existing constraint
ALTER TABLE native_rehearsal_responses
DROP CONSTRAINT IF EXISTS native_rehearsal_responses_response_check;

-- Add new constraint with 'pending' option
ALTER TABLE native_rehearsal_responses
ADD CONSTRAINT native_rehearsal_responses_response_check
CHECK (response IN ('yes', 'no', 'maybe', 'pending'));

-- Add comment
COMMENT ON COLUMN native_rehearsal_responses.response IS 'Response status: yes (accepted), no (declined), maybe (tentative), pending (invited but not responded)';
