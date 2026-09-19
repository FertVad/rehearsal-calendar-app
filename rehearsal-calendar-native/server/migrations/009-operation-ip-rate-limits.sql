-- Shared auth/admin IP budgets. Deadlines are anchored by the first request's
-- database time; 21/6 are saturated rejection counts, not extra admissions.
-- Only server-owned namespaces and HMAC-SHA256 address digests are persisted.
CREATE TABLE IF NOT EXISTS native_operation_ip_rate_limits (
  operation TEXT NOT NULL CHECK (operation IN ('auth', 'admin_login')),
  ip_key TEXT NOT NULL CHECK (
    length(ip_key) = 64 AND
    length(replace(replace(replace(replace(replace(replace(replace(replace(
      replace(replace(replace(replace(replace(replace(replace(replace(ip_key,
      '0', ''), '1', ''), '2', ''), '3', ''), '4', ''), '5', ''), '6', ''), '7', ''),
      '8', ''), '9', ''), 'a', ''), 'b', ''), 'c', ''), 'd', ''), 'e', ''), 'f', '')) = 0
  ),
  reset_at BIGINT NOT NULL CHECK (reset_at >= 0 AND reset_at = CAST(reset_at AS BIGINT)),
  request_count INTEGER NOT NULL CHECK (
    request_count = CAST(request_count AS INTEGER) AND
    ((operation = 'auth' AND request_count BETWEEN 1 AND 21) OR
     (operation = 'admin_login' AND request_count BETWEEN 1 AND 6))
  ),
  PRIMARY KEY (operation, ip_key)
);
CREATE INDEX IF NOT EXISTS idx_operation_ip_rate_limits_expiry
  ON native_operation_ip_rate_limits(operation, reset_at, ip_key);

-- Each namespace owns its own 10,000-key cap. Allocation/pruning holds that
-- gate until commit and removes at most 64 expired keys. No scheduled cleanup.
CREATE TABLE IF NOT EXISTS native_operation_ip_rate_limit_gates (
  operation TEXT PRIMARY KEY NOT NULL CHECK (operation IN ('auth', 'admin_login')),
  key_count INTEGER NOT NULL CHECK (
    key_count BETWEEN 0 AND 10000 AND key_count = CAST(key_count AS INTEGER)
  )
);
INSERT INTO native_operation_ip_rate_limit_gates (operation, key_count)
VALUES ('auth', 0), ('admin_login', 0) ON CONFLICT (operation) DO NOTHING;
