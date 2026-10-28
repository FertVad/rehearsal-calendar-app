-- 013: a push token has one owner (R4, cause fix 11: G01).
--
-- A device token addresses one phone, and one person is signed in on it. The
-- table was unique on (user_id, device_token) only, so the rule lived in the
-- registration handler: delete the other holders, then upsert. Two
-- registrations of one token at once — an account switch with the previous
-- session's late registration still in flight — each deleted before the other
-- had committed its insert, both rows survived, and the previous owner's
-- pushes kept reaching the phone. The token is now unique on its own, and
-- registration is one upsert on it: the later request waits for the earlier
-- and takes the row.
--
-- Tokens held twice keep their most recently active holder (the later row on a
-- tie): the person who last registered from the phone. The pair key is implied
-- by the new one and goes, and so does the plain token index the new key
-- replaces. Same end state as the canonical snapshot.
DELETE FROM native_push_tokens t
USING native_push_tokens newer
WHERE newer.device_token = t.device_token
  AND (newer.last_active_at > t.last_active_at
       OR (newer.last_active_at = t.last_active_at AND newer.id > t.id));
ALTER TABLE native_push_tokens DROP CONSTRAINT native_push_tokens_user_id_device_token_key;
DROP INDEX idx_push_tokens_token;
ALTER TABLE native_push_tokens ADD CONSTRAINT native_push_tokens_device_token_key UNIQUE (device_token);
