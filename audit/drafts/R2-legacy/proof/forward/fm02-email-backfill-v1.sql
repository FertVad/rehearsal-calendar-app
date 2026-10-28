-- Draft modern duplicate-free registry transition. No trust/verification claim.
-- Caller supplies transaction, schema check and native_users/providers locks.
DO $$ BEGIN
  IF EXISTS (SELECT user_id FROM native_auth_providers WHERE provider_type='email'
    GROUP BY user_id HAVING count(*)>1) THEN RAISE EXCEPTION 'EMAIL_PROVIDER_DUPLICATES'; END IF;
  IF EXISTS (SELECT 1 FROM native_auth_providers p JOIN native_users u ON u.id=p.user_id
    WHERE p.provider_type='email' AND (p.provider_user_id IS NOT NULL
      OR u.password_hash IS NULL OR u.password_hash=''
      OR (p.provider_email IS NOT NULL AND p.provider_email<>u.email))) THEN
    RAISE EXCEPTION 'EMAIL_PROVIDER_SOURCE_INCONSISTENT';
  END IF;
  IF EXISTS (SELECT 1 FROM native_users WHERE password_hash IS NOT NULL AND password_hash<>''
    AND char_length(email)>255) THEN RAISE EXCEPTION 'EMAIL_PROVIDER_SOURCE_UNREPRESENTABLE'; END IF;
END $$;
CREATE TEMP TABLE fm02_original_users ON COMMIT DROP AS
  SELECT id,to_jsonb(t) AS original FROM native_users t;
CREATE TEMP TABLE fm02_original_providers ON COMMIT DROP AS
  SELECT id,to_jsonb(t) AS original FROM native_auth_providers t;
CREATE TEMP TABLE fm02_expected_users ON COMMIT DROP AS
  SELECT id FROM native_users WHERE password_hash IS NOT NULL AND password_hash<>'';

DO $$
DECLARE rel REGCLASS; att SMALLINT;
BEGIN
  rel := to_regclass('native_auth_providers_one_email_per_user');
  SELECT attnum INTO att FROM pg_attribute WHERE attrelid='native_auth_providers'::regclass AND attname='user_id';
  IF rel IS NULL THEN
    CREATE UNIQUE INDEX native_auth_providers_one_email_per_user ON native_auth_providers(user_id)
      WHERE provider_type='email';
  ELSIF NOT EXISTS (SELECT 1 FROM pg_index i WHERE indexrelid=rel
    AND indrelid='native_auth_providers'::regclass AND indisunique AND indisvalid AND indisready AND indimmediate
    AND indnkeyatts=1 AND indnatts=1 AND indkey[0]=att AND indexprs IS NULL
    AND regexp_replace(pg_get_expr(indpred,indrelid),'[()[:space:]]','','g')='provider_type::text=''email''::text') THEN
    RAISE EXCEPTION 'EMAIL_PROVIDER_KEY_DRIFT';
  END IF;
END $$;

INSERT INTO native_auth_providers
  (user_id,provider_type,provider_user_id,provider_email,provider_metadata,created_at,updated_at,last_used_at)
SELECT id,'email',NULL,email,NULL,transaction_timestamp(),transaction_timestamp(),NULL
FROM native_users u WHERE password_hash IS NOT NULL AND password_hash<>''
  AND NOT EXISTS (SELECT 1 FROM native_auth_providers p WHERE p.user_id=u.id AND p.provider_type='email')
ON CONFLICT(user_id) WHERE provider_type='email' DO NOTHING;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM fm02_expected_users u WHERE
    (SELECT count(*) FROM native_auth_providers p WHERE p.user_id=u.id AND p.provider_type='email')<>1)
    OR EXISTS (SELECT user_id FROM native_auth_providers WHERE provider_type='email' GROUP BY user_id HAVING count(*)>1) THEN
    RAISE EXCEPTION 'EMAIL_PROVIDER_POSTCONDITION_FAILED';
  END IF;
  IF EXISTS (SELECT 1 FROM fm02_original_users s FULL JOIN native_users t USING(id)
    WHERE s.id IS NULL OR t.id IS NULL OR s.original IS DISTINCT FROM to_jsonb(t))
    OR EXISTS (SELECT 1 FROM fm02_original_providers s LEFT JOIN native_auth_providers t USING(id)
    WHERE t.id IS NULL OR s.original IS DISTINCT FROM to_jsonb(t))
    OR EXISTS (SELECT 1 FROM native_auth_providers p LEFT JOIN fm02_original_providers s ON s.id=p.id
      WHERE s.id IS NULL AND (p.provider_type<>'email' OR p.provider_user_id IS NOT NULL
        OR p.provider_metadata IS NOT NULL OR p.last_used_at IS NOT NULL
        OR p.created_at<>transaction_timestamp() OR p.updated_at<>transaction_timestamp()
        OR NOT EXISTS (SELECT 1 FROM fm02_expected_users e WHERE e.id=p.user_id))) THEN
    RAISE EXCEPTION 'EMAIL_PROVIDER_SOURCE_CHANGED';
  END IF;
END $$;
