-- R0 diagnostic subset, NOT a production bootstrap or migration replacement.
-- Native PostgreSQL types/constraints for A02/B02/D01; no SQL translation.
-- The runner creates a fresh disposable database before executing this file.
CREATE TABLE native_users (
  id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, first_name TEXT NOT NULL,
  last_name TEXT, token_version INTEGER NOT NULL DEFAULT 1,
  notifications_enabled BOOLEAN DEFAULT TRUE, locale TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE native_projects (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC', invite_code TEXT,
  invite_expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE native_project_members (
  id SERIAL PRIMARY KEY, project_id INTEGER REFERENCES native_projects(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES native_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', status TEXT NOT NULL DEFAULT 'active',
  invited_at TIMESTAMPTZ, joined_at TIMESTAMPTZ, UNIQUE(project_id, user_id)
);
CREATE TABLE native_rehearsals (
  id SERIAL PRIMARY KEY, project_id INTEGER REFERENCES native_projects(id) ON DELETE CASCADE,
  title TEXT, description TEXT, starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL,
  location TEXT, created_by INTEGER REFERENCES native_users(id),
  is_all_day BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);
CREATE TABLE native_rehearsal_responses (
  id SERIAL PRIMARY KEY, rehearsal_id INTEGER REFERENCES native_rehearsals(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES native_users(id) ON DELETE CASCADE,
  response TEXT NOT NULL CHECK(response IN ('yes', 'no')),
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rehearsal_id, user_id)
);
CREATE TABLE native_user_availability (
  id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES native_users(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL, source TEXT NOT NULL, external_event_id TEXT, title TEXT,
  is_all_day BOOLEAN NOT NULL DEFAULT FALSE, CHECK(ends_at > starts_at)
);
CREATE TABLE native_push_tokens (
  id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES native_users(id),
  device_token TEXT NOT NULL, last_active_at TIMESTAMPTZ
);
CREATE TABLE native_notifications (
  id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES native_users(id), type TEXT,
  title TEXT, body TEXT, data JSONB, related_type TEXT, related_id INTEGER,
  read_at TIMESTAMPTZ, sent_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE r0_transaction_probe (id SERIAL PRIMARY KEY, value TEXT NOT NULL);

-- Reproducible synthetic seed: owner=1, member=2, outsider=3, project=1.
INSERT INTO native_users(email, first_name) VALUES
  ('owner@r0.invalid', 'Owner'), ('member@r0.invalid', 'Member'), ('outsider@r0.invalid', 'Outsider');
INSERT INTO native_projects(name, timezone) VALUES ('R0 seeded project', 'UTC');
INSERT INTO native_project_members(project_id, user_id, role, status) VALUES
  (1, 1, 'owner', 'active'), (1, 2, 'member', 'active');
