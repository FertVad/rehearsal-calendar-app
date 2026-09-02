-- One row per imported calendar event.
--
-- The bulk endpoint checks whether an event is already stored before inserting
-- it, and that check is correct within a request: the same event twice in one
-- payload yields one row. It cannot survive two requests overlapping. Both ask
-- "is this here yet", both are told no, both insert — which is what happened
-- when a pull-to-refresh landed on top of a sync already in flight, and the
-- same Apple Calendar event was written twice, four hours out from a release.
--
-- A race is not won by looking before you leap. The constraint belongs here.
--
-- external_event_id is NULL for hand-entered rows, and NULLs are distinct in a
-- unique index on both PostgreSQL and SQLite, so the manual editor is untouched
-- by this and needs no partial predicate.

-- Keep the earliest of each set; the rows are identical apart from their id.
DELETE FROM native_user_availability
WHERE external_event_id IS NOT NULL
  AND id NOT IN (
    SELECT MIN(id) FROM native_user_availability
    WHERE external_event_id IS NOT NULL
    GROUP BY user_id, external_event_id, source
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_availability_imported_event
  ON native_user_availability (user_id, external_event_id, source);
