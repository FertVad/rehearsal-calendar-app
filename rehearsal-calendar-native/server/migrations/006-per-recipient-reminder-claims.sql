-- Claim a reminder per recipient, not per rehearsal.
--
-- The claim stopped two overlapping schedulers announcing the same rehearsal
-- twice, and it did that job. But it retired the whole rehearsal on the first
-- send, so anyone added to the call afterwards never got a reminder at all —
-- and they get no update push either, since a roster-only edit changes none of
-- the fields the change list names. They simply found the rehearsal if they
-- happened to open the app.
--
-- One row per person makes the claim mean what it says: this reminder went to
-- this person. Someone added later has no row, so the next run sends to them
-- and to nobody else.
--
-- Safe to run: the table is empty on production, so the key can change without
-- touching any data. Adding user_id NOT NULL to a populated table would need a
-- backfill first.

ALTER TABLE native_push_reminders
  ADD COLUMN IF NOT EXISTS user_id INTEGER;

ALTER TABLE native_push_reminders
  DROP CONSTRAINT IF EXISTS native_push_reminders_rehearsal_id_reminder_type_key;

DELETE FROM native_push_reminders WHERE user_id IS NULL;

ALTER TABLE native_push_reminders
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE native_push_reminders
  ADD CONSTRAINT native_push_reminders_recipient_key
  UNIQUE (rehearsal_id, user_id, reminder_type);

ALTER TABLE native_push_reminders
  ADD CONSTRAINT native_push_reminders_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE;
