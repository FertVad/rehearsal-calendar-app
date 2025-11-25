-- ==========================================
-- NATIVE APP SCHEMA
-- Migration: 003-native-app-schema.sql
-- ==========================================

-- Пользователи (native app)
CREATE TABLE IF NOT EXISTS native_users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    telegram_id BIGINT UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    phone VARCHAR(20),
    avatar_url TEXT,
    timezone VARCHAR(50) DEFAULT 'Europe/Moscow',
    locale VARCHAR(10) DEFAULT 'ru',

    -- Настройки уведомлений
    notifications_enabled BOOLEAN DEFAULT true,
    email_notifications BOOLEAN DEFAULT true,
    push_token TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP
);

-- Проекты
CREATE TABLE IF NOT EXISTS native_projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#A855F7',

    -- Даты проекта
    start_date DATE,
    end_date DATE,
    premiere_date DATE,

    -- Статус
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Участники проекта
CREATE TABLE IF NOT EXISTS native_project_members (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES native_projects(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES native_users(id) ON DELETE CASCADE,

    -- Роль в проекте: owner, admin, member
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'admin', 'member')),

    -- Роль персонажа (опционально)
    character_name VARCHAR(100),

    -- Статус участия
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'invited', 'declined', 'left')),

    invited_at TIMESTAMP DEFAULT NOW(),
    joined_at TIMESTAMP,

    UNIQUE(project_id, user_id)
);

-- Репетиции
CREATE TABLE IF NOT EXISTS native_rehearsals (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES native_projects(id) ON DELETE CASCADE,

    -- Основная информация
    title VARCHAR(255) NOT NULL,
    description TEXT,
    scene VARCHAR(100),

    -- Время
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,

    -- Место
    location VARCHAR(255),
    location_address TEXT,
    location_notes TEXT,

    -- Статус
    status VARCHAR(20) DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled')),

    -- Кто создал
    created_by INTEGER NOT NULL REFERENCES native_users(id),

    -- Повторение
    recurrence_rule TEXT,
    parent_rehearsal_id INTEGER REFERENCES native_rehearsals(id),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Участники репетиции
CREATE TABLE IF NOT EXISTS native_rehearsal_participants (
    id SERIAL PRIMARY KEY,
    rehearsal_id INTEGER NOT NULL REFERENCES native_rehearsals(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES native_users(id) ON DELETE CASCADE,

    -- Статус участия
    status VARCHAR(20) DEFAULT 'invited'
        CHECK (status IN ('invited', 'confirmed', 'declined', 'tentative', 'attended', 'absent')),

    -- Ответ
    response_at TIMESTAMP,
    decline_reason TEXT,
    notes TEXT,

    UNIQUE(rehearsal_id, user_id)
);

-- Доступность пользователей
CREATE TABLE IF NOT EXISTS native_user_availability (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES native_users(id) ON DELETE CASCADE,

    -- Период
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,

    -- Тип: available, busy, tentative
    type VARCHAR(20) NOT NULL CHECK (type IN ('available', 'busy', 'tentative')),

    -- Источник
    source VARCHAR(30) DEFAULT 'manual'
        CHECK (source IN ('manual', 'google_calendar', 'apple_calendar', 'recurring')),

    -- ID внешнего события
    external_event_id VARCHAR(255),

    -- Описание
    title VARCHAR(255),
    notes TEXT,

    -- Повторение
    recurrence_rule TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Подключенные календари
CREATE TABLE IF NOT EXISTS native_calendar_connections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES native_users(id) ON DELETE CASCADE,

    -- Тип календаря
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('google', 'apple', 'outlook')),

    -- OAuth данные
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,

    -- ID календаря
    calendar_id VARCHAR(255) NOT NULL,
    calendar_name VARCHAR(255),

    -- Настройки синхронизации
    sync_enabled BOOLEAN DEFAULT true,
    sync_direction VARCHAR(20) DEFAULT 'both'
        CHECK (sync_direction IN ('import', 'export', 'both')),

    -- Последняя синхронизация
    last_sync_at TIMESTAMP,
    sync_token TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(user_id, provider, calendar_id)
);

-- Маппинг событий
CREATE TABLE IF NOT EXISTS native_calendar_event_mappings (
    id SERIAL PRIMARY KEY,
    connection_id INTEGER NOT NULL REFERENCES native_calendar_connections(id) ON DELETE CASCADE,

    -- Внутреннее событие
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('rehearsal', 'availability')),
    internal_event_id INTEGER NOT NULL,

    -- Внешнее событие
    external_event_id VARCHAR(255) NOT NULL,
    external_event_etag VARCHAR(255),

    -- Синхронизация
    last_sync_direction VARCHAR(10) CHECK (last_sync_direction IN ('import', 'export')),
    last_sync_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(connection_id, event_type, internal_event_id),
    UNIQUE(connection_id, external_event_id)
);

-- Уведомления
CREATE TABLE IF NOT EXISTS native_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES native_users(id) ON DELETE CASCADE,

    -- Тип и содержимое
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    data JSONB,

    -- Статус
    read_at TIMESTAMP,
    sent_at TIMESTAMP,

    -- Связь с сущностью
    related_type VARCHAR(20),
    related_id INTEGER,

    created_at TIMESTAMP DEFAULT NOW()
);

-- Лог активности
CREATE TABLE IF NOT EXISTS native_activity_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES native_users(id) ON DELETE SET NULL,

    -- Что изменилось
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'update', 'delete')),

    -- Детали
    changes JSONB,

    created_at TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- ИНДЕКСЫ
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_native_rehearsals_date ON native_rehearsals(date);
CREATE INDEX IF NOT EXISTS idx_native_rehearsals_project ON native_rehearsals(project_id);
CREATE INDEX IF NOT EXISTS idx_native_rehearsals_status ON native_rehearsals(status);

CREATE INDEX IF NOT EXISTS idx_native_availability_user_date ON native_user_availability(user_id, date);
CREATE INDEX IF NOT EXISTS idx_native_availability_date_range ON native_user_availability(date, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_native_project_members_user ON native_project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_native_project_members_project ON native_project_members(project_id);

CREATE INDEX IF NOT EXISTS idx_native_notifications_user_unread ON native_notifications(user_id, read_at) WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_native_calendar_mappings_external ON native_calendar_event_mappings(connection_id, external_event_id);

CREATE INDEX IF NOT EXISTS idx_native_rehearsal_participants_user ON native_rehearsal_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_native_rehearsal_participants_rehearsal ON native_rehearsal_participants(rehearsal_id);
