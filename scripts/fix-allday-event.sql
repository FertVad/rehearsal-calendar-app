-- Remove incorrectly imported all-day event
-- Event ID: F8D3F630-6839-4FDB-BCBB-BB5B9F4D4740
-- This event was saved with wrong times (22:00 - 21:59:59 instead of 00:00 - 23:59)

DELETE FROM native_user_availability
WHERE external_event_id = 'F8D3F630-6839-4FDB-BCBB-BB5B9F4D4740'
  AND source IN ('apple_calendar', 'google_calendar');

-- Show remaining events to verify
SELECT
  id,
  starts_at,
  ends_at,
  is_all_day,
  title,
  source,
  external_event_id
FROM native_user_availability
WHERE user_id = 3
  AND source IN ('apple_calendar', 'google_calendar')
ORDER BY starts_at;
