-- Migration: Add native_rehearsal_responses table for RSVP functionality
-- Created: 2025-12-07

-- Create native_rehearsal_responses table
CREATE TABLE IF NOT EXISTS native_rehearsal_responses (
  id SERIAL PRIMARY KEY,
  rehearsal_id INTEGER NOT NULL REFERENCES native_rehearsals(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES native_users(id) ON DELETE CASCADE,
  response VARCHAR(10) NOT NULL CHECK (response IN ('yes', 'no', 'maybe')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(rehearsal_id, user_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_rehearsal_responses_rehearsal_id
  ON native_rehearsal_responses(rehearsal_id);

CREATE INDEX IF NOT EXISTS idx_rehearsal_responses_user_id
  ON native_rehearsal_responses(user_id);

-- Add comment
COMMENT ON TABLE native_rehearsal_responses IS 'Stores RSVP responses for rehearsals';
