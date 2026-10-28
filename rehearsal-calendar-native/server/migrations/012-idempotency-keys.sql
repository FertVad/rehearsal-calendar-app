-- 012: requests that create something, by the key the client sent with them
-- (R4, cause fix 10: B02, D03).
--
-- A create whose answer is lost — a timeout, a dropped connection — is tapped
-- again, and the second request made a second project or rehearsal. The client
-- now sends an Idempotency-Key with each create and keeps it until the create
-- succeeds. The first request with a key records it in the same transaction as
-- what it creates, with the answer it gave; a repeat gets that answer back and
-- creates nothing. The primary key is what makes two concurrent requests with
-- one key create once: the second waits on the first one's row.
--
-- response is filled in the transaction that inserts the row, so no committed
-- row is without one. Rows older than a day are removed by their owner's next
-- create; a retry comes within minutes.
CREATE TABLE native_idempotency_keys (
  user_id INTEGER NOT NULL REFERENCES native_users(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  operation TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, idempotency_key)
);
