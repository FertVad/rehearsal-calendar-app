-- Schema for native app (SQLite for development)
-- This extends the existing schema from Telegram Mini App

-- Native users table (email/password authentication)
CREATE TABLE IF NOT EXISTS native_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  telegram_id TEXT UNIQUE, -- Optional: link to Telegram account
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User projects (many-to-many relationship)
CREATE TABLE IF NOT EXISTS user_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES native_users(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'admin' or 'member'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, project_id)
);

-- Projects table (shared with Telegram Mini App)
-- Modify chat_id to be optional for native-only projects
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT UNIQUE, -- Optional for native projects
  name TEXT NOT NULL,
  work_hours_start TEXT DEFAULT '09:00',
  work_hours_end TEXT DEFAULT '22:00',
  notifications_enabled BOOLEAN DEFAULT FALSE,
  notification_language TEXT DEFAULT 'en',
  week_starts_on INTEGER DEFAULT 1, -- 0=Sunday, 1=Monday
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Actors table (participants in projects)
CREATE TABLE IF NOT EXISTS actors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  telegram_id TEXT, -- Optional: for Telegram users
  native_user_id INTEGER REFERENCES native_users(id) ON DELETE SET NULL, -- Link to native user
  name TEXT NOT NULL,
  username TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Rehearsals table (existing, no changes needed)
CREATE TABLE IF NOT EXISTS rehearsals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene TEXT,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  duration TEXT,
  start_time TEXT,
  end_time TEXT,
  actors TEXT, -- JSON array of actor IDs
  actor_name_snapshot TEXT, -- JSON array of {id, name}
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Availability table (existing, no changes needed)
CREATE TABLE IF NOT EXISTS availability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  time_ranges TEXT, -- JSON: [{"start":"09:00","end":"18:00"}]
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(actor_id, date)
);

-- User settings table (extend to support both Telegram and native users)
CREATE TABLE IF NOT EXISTS user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT UNIQUE,
  native_user_id INTEGER UNIQUE REFERENCES native_users(id) ON DELETE CASCADE,
  ui_language TEXT DEFAULT 'en',
  week_starts_on INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CHECK (telegram_id IS NOT NULL OR native_user_id IS NOT NULL)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_projects_user_id ON user_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_user_projects_project_id ON user_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_actors_project_id ON actors(project_id);
CREATE INDEX IF NOT EXISTS idx_actors_native_user_id ON actors(native_user_id);
CREATE INDEX IF NOT EXISTS idx_rehearsals_project_id ON rehearsals(project_id);
CREATE INDEX IF NOT EXISTS idx_rehearsals_date ON rehearsals(date);
CREATE INDEX IF NOT EXISTS idx_availability_actor_id ON availability(actor_id);
CREATE INDEX IF NOT EXISTS idx_availability_date ON availability(date);
