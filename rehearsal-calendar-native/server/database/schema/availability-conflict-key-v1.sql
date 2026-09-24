-- Explicit forward repair: the named predecessor profile verified modern columns,
-- no existing imported-event conflict key, and zero duplicate non-NULL keys.
-- The runner holds the table lock through this DDL and the history commit.
-- Do not deduplicate, delete or reinterpret any availability row here.
CREATE UNIQUE INDEX idx_availability_imported_event
  ON native_user_availability (user_id, external_event_id, source);
