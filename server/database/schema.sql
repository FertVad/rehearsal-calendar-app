-- SQLite schema used for local development
-- Projects (Telegram group chats)
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  work_hours_start TEXT DEFAULT '09:00',
  work_hours_end TEXT DEFAULT '22:00',
  notifications_enabled INTEGER DEFAULT 0,
  notification_language TEXT DEFAULT 'en',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Actors (chat participants)
CREATE TABLE IF NOT EXISTS actors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL,
  name TEXT NOT NULL,
  project_id INTEGER,
  is_admin BOOLEAN DEFAULT FALSE,
  ui_language TEXT DEFAULT 'en',
  week_starts_on INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Actor availability (manual only - user-created)
CREATE TABLE IF NOT EXISTS availability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL,
  date TEXT NOT NULL,
  time_ranges TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(telegram_id, date)
);

-- Rehearsals
CREATE TABLE IF NOT EXISTS rehearsals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  scene TEXT,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  duration TEXT,
  actors TEXT,
  actor_name_snapshot TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
