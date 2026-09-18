-- Shared request budget for members/availability: 60 requests per DB-clock
-- minute per authenticated user, across every project and server instance.
-- There is one row per native user, and deleting the user removes it. No
-- request-derived keys, per-window accumulation or scheduled cleanup is needed.
-- 61 is a capped rejection sentinel, not an additional admitted request.
-- A future contract change above 60 must also migrate this constraint.
CREATE TABLE IF NOT EXISTS native_member_availability_rate_limits (
  user_id INTEGER PRIMARY KEY REFERENCES native_users(id) ON DELETE CASCADE,
  window_start BIGINT NOT NULL CHECK (window_start >= 0 AND window_start % 60 = 0),
  request_count INTEGER NOT NULL CHECK (request_count BETWEEN 1 AND 61)
);
