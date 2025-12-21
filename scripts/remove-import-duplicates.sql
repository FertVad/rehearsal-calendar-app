-- Remove duplicate imported events (keep only the oldest one for each external_event_id)
DELETE FROM native_user_availability
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, external_event_id, source 
             ORDER BY created_at ASC
           ) as row_num
    FROM native_user_availability
    WHERE external_event_id IS NOT NULL
      AND source IN ('apple_calendar', 'google_calendar')
  ) ranked
  WHERE row_num > 1
);
