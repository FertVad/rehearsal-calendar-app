-- Show schema of native_user_availability table
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'native_user_availability'
ORDER BY ordinal_position;
