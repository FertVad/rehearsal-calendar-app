-- Migration: Create push notification tables (PostgreSQL)
-- Description: Add tables for storing push tokens and tracking sent reminders

-- Table for storing push notification tokens
CREATE TABLE IF NOT EXISTS native_push_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES native_users(id) ON DELETE CASCADE,
  device_token VARCHAR(255) NOT NULL,
  device_type VARCHAR(20),
  device_name VARCHAR(100),
  last_active_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, device_token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON native_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON native_push_tokens(device_token);

-- Table for tracking sent reminders
CREATE TABLE IF NOT EXISTS native_push_reminders (
  id SERIAL PRIMARY KEY,
  rehearsal_id INTEGER NOT NULL REFERENCES native_rehearsals(id) ON DELETE CASCADE,
  reminder_type VARCHAR(10) NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL,
  UNIQUE(rehearsal_id, reminder_type)
);

CREATE INDEX IF NOT EXISTS idx_push_reminders_rehearsal ON native_push_reminders(rehearsal_id);
CREATE INDEX IF NOT EXISTS idx_push_reminders_sent_at ON native_push_reminders(sent_at);
