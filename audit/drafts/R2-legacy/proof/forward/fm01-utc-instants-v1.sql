-- Draft explicit DATE + TIME UTC transition. Caller supplies transaction,
-- checked schema/search_path and locks; never execute as an autocommit script.
DO $$
DECLARE tbl TEXT; rel REGCLASS; expected RECORD; n INTEGER;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['native_rehearsals','native_user_availability'] LOOP
    rel := to_regclass(tbl);
    IF rel IS NULL OR NOT EXISTS (SELECT 1 FROM pg_class WHERE oid=rel AND relkind='r') THEN
      RAISE EXCEPTION 'LEGACY_TIME_LAYOUT_UNSUPPORTED';
    END IF;
    FOR expected IN SELECT * FROM (VALUES
      ('date','date'::regtype),('start_time','time without time zone'::regtype),
      ('end_time','time without time zone'::regtype)) AS v(name,typ) LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid=rel AND attname=expected.name
        AND atttypid=expected.typ AND NOT attisdropped AND attgenerated='') THEN
        RAISE EXCEPTION 'LEGACY_TIME_LAYOUT_UNSUPPORTED';
      END IF;
    END LOOP;
    SELECT count(*) INTO n FROM pg_attribute WHERE attrelid=rel
      AND attname IN ('starts_at','ends_at') AND NOT attisdropped;
    IF n NOT IN (0,2) OR EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid=rel
      AND attname IN ('starts_at','ends_at') AND NOT attisdropped
      AND (atttypid <> 'timestamptz'::regtype OR attnotnull OR attgenerated<>'')) THEN
      RAISE EXCEPTION 'LEGACY_TIME_LAYOUT_UNSUPPORTED';
    END IF;
    IF n=2 THEN
      EXECUTE format('SELECT count(*) FROM %I WHERE starts_at IS NOT NULL OR ends_at IS NOT NULL',tbl) INTO n;
      IF n<>0 THEN RAISE EXCEPTION 'LEGACY_TARGET_ALREADY_POPULATED'; END IF;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='native_user_availability'::regclass
    AND attname='is_all_day' AND atttypid='boolean'::regtype AND NOT attisdropped) THEN
    RAISE EXCEPTION 'LEGACY_TIME_LAYOUT_UNSUPPORTED';
  END IF;
  IF EXISTS (SELECT 1 FROM native_rehearsals WHERE date IS NULL OR NOT isfinite(date)
    OR start_time IS NULL OR end_time IS NULL OR start_time>=TIME '24:00' OR end_time>=TIME '24:00'
    OR end_time<=start_time)
    OR EXISTS (SELECT 1 FROM native_user_availability WHERE date IS NULL OR NOT isfinite(date)
      OR is_all_day IS NULL OR (NOT is_all_day AND (start_time IS NULL OR end_time IS NULL
      OR start_time>=TIME '24:00' OR end_time>=TIME '24:00' OR end_time<=start_time))) THEN
    RAISE EXCEPTION 'LEGACY_SOURCE_INVALID';
  END IF;
END $$;

CREATE TEMP TABLE fm01_original_rehearsals ON COMMIT DROP AS
  SELECT id, to_jsonb(t)-'starts_at'-'ends_at' AS original FROM native_rehearsals t;
CREATE TEMP TABLE fm01_original_availability ON COMMIT DROP AS
  SELECT id, to_jsonb(t)-'starts_at'-'ends_at' AS original FROM native_user_availability t;
ALTER TABLE native_rehearsals ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;
ALTER TABLE native_user_availability ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;
UPDATE native_rehearsals SET
  starts_at=(date+start_time) AT TIME ZONE 'UTC',
  ends_at=(date+end_time) AT TIME ZONE 'UTC';
UPDATE native_user_availability SET
  starts_at=(date+CASE WHEN is_all_day THEN TIME '00:00' ELSE start_time END) AT TIME ZONE 'UTC',
  ends_at=(date+CASE WHEN is_all_day THEN TIME '23:59' ELSE end_time END) AT TIME ZONE 'UTC';

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM native_rehearsals WHERE starts_at IS NULL OR ends_at IS NULL
    OR NOT isfinite(starts_at) OR NOT isfinite(ends_at) OR ends_at<=starts_at
    OR abs(extract(epoch FROM starts_at)*1000)>8640000000000000
    OR abs(extract(epoch FROM ends_at)*1000)>8640000000000000
    OR (starts_at AT TIME ZONE 'UTC')::date IS DISTINCT FROM date
    OR (ends_at AT TIME ZONE 'UTC')::date IS DISTINCT FROM date
    OR (starts_at AT TIME ZONE 'UTC')::time IS DISTINCT FROM start_time
    OR (ends_at AT TIME ZONE 'UTC')::time IS DISTINCT FROM end_time)
    OR EXISTS (SELECT 1 FROM native_user_availability WHERE starts_at IS NULL OR ends_at IS NULL
      OR NOT isfinite(starts_at) OR NOT isfinite(ends_at) OR ends_at<=starts_at
      OR abs(extract(epoch FROM starts_at)*1000)>8640000000000000
      OR abs(extract(epoch FROM ends_at)*1000)>8640000000000000
      OR (starts_at AT TIME ZONE 'UTC')::date IS DISTINCT FROM date
      OR (ends_at AT TIME ZONE 'UTC')::date IS DISTINCT FROM date
      OR (starts_at AT TIME ZONE 'UTC')::time IS DISTINCT FROM CASE WHEN is_all_day THEN TIME '00:00' ELSE start_time END
      OR (ends_at AT TIME ZONE 'UTC')::time IS DISTINCT FROM CASE WHEN is_all_day THEN TIME '23:59' ELSE end_time END) THEN
    RAISE EXCEPTION 'LEGACY_ROUNDTRIP_MISMATCH';
  END IF;
  IF EXISTS (SELECT 1 FROM fm01_original_rehearsals s FULL JOIN native_rehearsals t USING(id)
    WHERE s.id IS NULL OR t.id IS NULL OR s.original IS DISTINCT FROM (to_jsonb(t)-'starts_at'-'ends_at'))
    OR EXISTS (SELECT 1 FROM fm01_original_availability s FULL JOIN native_user_availability t USING(id)
    WHERE s.id IS NULL OR t.id IS NULL OR s.original IS DISTINCT FROM (to_jsonb(t)-'starts_at'-'ends_at')) THEN
    RAISE EXCEPTION 'LEGACY_SOURCE_CHANGED';
  END IF;
END $$;

ALTER TABLE native_rehearsals ALTER starts_at SET NOT NULL,ALTER ends_at SET NOT NULL,
  ALTER date DROP NOT NULL,ALTER start_time DROP NOT NULL,ALTER end_time DROP NOT NULL,
  ADD CONSTRAINT fm01_rehearsals_time_order CHECK(ends_at>starts_at);
ALTER TABLE native_user_availability ALTER starts_at SET NOT NULL,ALTER ends_at SET NOT NULL,
  ALTER date DROP NOT NULL,ALTER start_time DROP NOT NULL,ALTER end_time DROP NOT NULL,
  ADD CONSTRAINT fm01_availability_time_order CHECK(ends_at>starts_at);
CREATE INDEX fm01_rehearsals_starts_at ON native_rehearsals(starts_at);
CREATE INDEX fm01_rehearsals_ends_at ON native_rehearsals(ends_at);
CREATE INDEX fm01_rehearsals_time_range ON native_rehearsals(starts_at,ends_at);
CREATE INDEX fm01_availability_starts_at ON native_user_availability(starts_at);
CREATE INDEX fm01_availability_ends_at ON native_user_availability(ends_at);
CREATE INDEX fm01_availability_user_time ON native_user_availability(user_id,starts_at,ends_at);
CREATE INDEX fm01_availability_time_range ON native_user_availability(starts_at,ends_at);
