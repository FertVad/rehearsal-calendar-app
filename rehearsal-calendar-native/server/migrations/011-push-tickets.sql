-- 011: the tickets Expo gave for pushes it accepted, kept until their receipts
-- are read (R8: G02).
--
-- A ticket says only that Expo took the message. Whether Apple or Google then
-- delivered it — or refused, because the app was uninstalled and the token is
-- dead — is in the receipt, available some minutes later for about a day. One
-- row per accepted ticket, removed once its receipt is read or has expired; a
-- receipt saying the device is gone removes the token as well.
CREATE TABLE native_push_tickets (
  ticket_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES native_users(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_push_tickets_created ON native_push_tickets (created_at);
