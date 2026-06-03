-- Add token_version to native_users for session revocation.
-- When a user logs out or changes password, this is incremented.
-- JWTs embed the version at issue time; middleware rejects if the embedded
-- version is less than the current value in DB.
ALTER TABLE native_users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1;
