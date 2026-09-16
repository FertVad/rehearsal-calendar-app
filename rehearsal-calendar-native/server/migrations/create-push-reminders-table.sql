-- Track which reminders have been sent, so two schedulers cannot announce the
-- same rehearsal twice.
--
-- Superseded, and rewritten on 2026-09-05 to say what production actually has.
-- It used to declare a per-recipient shape — `user_id NOT NULL` and
-- `UNIQUE(rehearsal_id, user_id, reminder_type)` — while a later migration
-- declared a per-rehearsal one, and both used CREATE TABLE IF NOT EXISTS, so
-- neither corrected the other and the repo could not say which was live.
--
-- Production was read directly: no user_id, unique on (rehearsal_id,
-- reminder_type). That is the shape the scheduler claims against, which is why
-- reminders work. The claim belongs to the rehearsal rather than to each
-- recipient — one send covers the whole roster.
--
-- Left correct rather than deleted: it is recorded as applied, so it will not
-- run again, but a wrong file is a trap for anyone reading the history or
-- building a database from the migrations alone.

CREATE TABLE IF NOT EXISTS native_push_reminders (
  id SERIAL PRIMARY KEY,
  rehearsal_id INTEGER NOT NULL,
  reminder_type VARCHAR(10) NOT NULL, -- '24h' or '1h'
  sent_at TIMESTAMPTZ NOT NULL,

  FOREIGN KEY (rehearsal_id) REFERENCES native_rehearsals(id) ON DELETE CASCADE,

  -- Claimed before the push goes out; a failed send releases it.
  UNIQUE(rehearsal_id, reminder_type)
);

CREATE INDEX IF NOT EXISTS idx_push_reminders_rehearsal
ON native_push_reminders(rehearsal_id);

CREATE INDEX IF NOT EXISTS idx_push_reminders_sent_at
ON native_push_reminders(sent_at);
