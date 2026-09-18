-- One account budget for both join aliases; one IP budget for preview + join.
-- Counts saturate at 21: the first 20 are admitted in each database minute.
CREATE TABLE IF NOT EXISTS native_invite_account_rate_limits (
  user_id INTEGER PRIMARY KEY REFERENCES native_users(id) ON DELETE CASCADE,
  window_start BIGINT NOT NULL CHECK (window_start >= 0 AND window_start % 60 = 0),
  request_count INTEGER NOT NULL CHECK (request_count BETWEEN 1 AND 21)
);

-- Only HMAC-SHA256 digests of normalized addresses are persisted. The portable
-- nested replace check enforces lowercase hexadecimal on SQLite and Postgres.
CREATE TABLE IF NOT EXISTS native_invite_ip_rate_limits (
  ip_key TEXT PRIMARY KEY NOT NULL CHECK (
    length(ip_key) = 64 AND
    length(replace(replace(replace(replace(replace(replace(replace(replace(
      replace(replace(replace(replace(replace(replace(replace(replace(ip_key,
      '0', ''), '1', ''), '2', ''), '3', ''), '4', ''), '5', ''), '6', ''), '7', ''),
      '8', ''), '9', ''), 'a', ''), 'b', ''), 'c', ''), 'd', ''), 'e', ''), 'f', '')) = 0
  ),
  window_start BIGINT NOT NULL CHECK (window_start >= 0 AND window_start % 60 = 0),
  request_count INTEGER NOT NULL CHECK (request_count BETWEEN 1 AND 21)
);
CREATE INDEX IF NOT EXISTS idx_invite_ip_rate_limits_window_start
  ON native_invite_ip_rate_limits(window_start);

-- Serialized allocation enforces 10,000 total IP rows. Request-driven cleanup
-- removes at most 64 expired rows per new key; no timer or production polling.
CREATE TABLE IF NOT EXISTS native_invite_ip_rate_limit_gate (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  key_count INTEGER NOT NULL CHECK (key_count BETWEEN 0 AND 10000)
);
INSERT INTO native_invite_ip_rate_limit_gate (id, key_count)
VALUES (1, 0) ON CONFLICT (id) DO NOTHING;
