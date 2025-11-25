-- PostgreSQL version of current SQLite schema
-- Use SERIAL instead of INTEGER PRIMARY KEY AUTOINCREMENT
-- Use TIMESTAMP instead of DATETIME
-- Keep same table structure and relationships

-- Projects (Telegram group chats)
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  chat_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  work_hours_start VARCHAR(5) DEFAULT '09:00',
  work_hours_end VARCHAR(5) DEFAULT '22:00',
  notifications_enabled BOOLEAN DEFAULT FALSE,
  notification_language VARCHAR(2) DEFAULT 'en',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Actors (chat participants)
CREATE TABLE IF NOT EXISTS actors (
  id SERIAL PRIMARY KEY,
  telegram_id TEXT NOT NULL,
  name TEXT NOT NULL,
  project_id INTEGER REFERENCES projects(id),
  is_admin BOOLEAN DEFAULT FALSE,
  ui_language VARCHAR(2) DEFAULT 'en',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Actor availability (manual only - user-created)
CREATE TABLE IF NOT EXISTS availability (
  id SERIAL PRIMARY KEY,
  telegram_id TEXT NOT NULL,
  date TEXT NOT NULL,
  time_ranges TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(telegram_id, date),
  CONSTRAINT availability_time_ranges_json_array
    CHECK (jsonb_typeof(time_ranges::jsonb) = 'array')
);

-- Rehearsals
CREATE TABLE IF NOT EXISTS rehearsals (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id),
  scene TEXT,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  duration TEXT,
  actors TEXT,
  actor_name_snapshot TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
