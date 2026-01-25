-- Create table to track sent push notification reminders
-- Prevents duplicate reminders from being sent

CREATE TABLE IF NOT EXISTS native_push_reminders (
  id SERIAL PRIMARY KEY,
  rehearsal_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  reminder_type VARCHAR(10) NOT NULL, -- '24h' or '1h'
  sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
  push_token VARCHAR(255),
  status VARCHAR(20) DEFAULT 'sent', -- 'sent', 'failed', 'delivered'
  error_message TEXT,

  FOREIGN KEY (rehearsal_id) REFERENCES native_rehearsals(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE,

  -- Prevent duplicate reminders
  UNIQUE(rehearsal_id, user_id, reminder_type)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_push_reminders_rehearsal
ON native_push_reminders(rehearsal_id);

CREATE INDEX IF NOT EXISTS idx_push_reminders_user
ON native_push_reminders(user_id);

CREATE INDEX IF NOT EXISTS idx_push_reminders_sent_at
ON native_push_reminders(sent_at);
