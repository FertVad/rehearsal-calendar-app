-- native_notifications was created with `timestamp without time zone`, unlike
-- every other table here. Such a column stores no offset, so PostgreSQL reads
-- it back in the session's zone — the exact trap that made the reminder cron
-- miss a two-hour band on a server running in Jerusalem.
--
-- The table has never been written to, so the conversion has nothing to
-- reinterpret. Values are treated as UTC, which is what the code was writing.

ALTER TABLE native_notifications
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN sent_at    TYPE TIMESTAMPTZ USING sent_at    AT TIME ZONE 'UTC',
  ALTER COLUMN read_at    TYPE TIMESTAMPTZ USING read_at    AT TIME ZONE 'UTC';

-- The inbox is always read as "this user's, newest first", and the badge asks
-- "how many unread". Both are served by this.
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON native_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON native_notifications (user_id) WHERE read_at IS NULL;
