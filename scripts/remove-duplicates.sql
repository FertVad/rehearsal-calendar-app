-- Remove duplicate availability entries that were imported from calendar
-- but actually represent exported rehearsals

DELETE FROM native_user_availability
WHERE id IN (
  SELECT a2.id
  FROM native_user_availability a1
  INNER JOIN native_user_availability a2
    ON a1.user_id = a2.user_id
    AND a1.starts_at = a2.starts_at
    AND a1.ends_at = a2.ends_at
  WHERE a1.source = 'rehearsal'
    AND a2.source IN ('apple_calendar', 'google_calendar')
);
