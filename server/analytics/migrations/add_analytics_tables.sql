-- Analytics tables migration
-- Run this migration to add analytics tracking to the database

-- Analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id SERIAL PRIMARY KEY,
  user_id TEXT,
  event_name TEXT NOT NULL,
  properties JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_user_timestamp ON analytics_events(user_id, timestamp DESC);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_analytics_event_timestamp ON analytics_events(event_name, timestamp DESC);

COMMENT ON TABLE analytics_events IS 'Stores all user events for analytics and tracking';
COMMENT ON COLUMN analytics_events.user_id IS 'Telegram user ID';
COMMENT ON COLUMN analytics_events.event_name IS 'Event type: app_opened, rehearsal_created, etc.';
COMMENT ON COLUMN analytics_events.properties IS 'Additional event metadata in JSON format';
COMMENT ON COLUMN analytics_events.timestamp IS 'When the event occurred (server time)';
