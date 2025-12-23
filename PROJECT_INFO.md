# Rehearsal Calendar Native App - Project Documentation

## 📱 Project Overview

**Rehearsal Calendar** - это мобильное приложение для планирования театральных репетиций с управлением доступностью участников, автоматическими рекомендациями времени и поддержкой нескольких проектов.

### Основные возможности
- ✅ Аутентификация (Email/Password + Telegram login)
- ✅ Управление проектами (создание, присоединение по invite link)
- ✅ Создание репетиций с проверкой конфликтов
- ✅ Управление доступностью участников
- ✅ RSVP система для репетиций
- ✅ Умные рекомендации времени на основе доступности
- ✅ **Синхронизация с календарем** - экспорт репетиций в iOS/Google Calendar, импорт событий для availability
- ✅ **Полная локализация (Русский/English)** - все экраны, компоненты, уведомления
- ✅ **Оптимизация производительности** - batch API endpoints, 5-10x ускорение загрузки
- ✅ Push-уведомления (готово к интеграции)

---

## 🏗 Technology Stack

### Frontend (React Native)
```json
{
  "framework": "React Native 0.81.5 + Expo SDK 54",
  "navigation": "@react-navigation/native 7.x (Stack + Bottom Tabs)",
  "state": "React Context API",
  "ui": "Custom UI components (Glass morphism design)",
  "http": "Axios 1.13.2",
  "i18n": "i18next + react-i18next",
  "icons": "@expo/vector-icons",
  "storage": "@react-native-async-storage/async-storage"
}
```

### Backend (Node.js)
```json
{
  "runtime": "Node.js >= 18.0.0",
  "framework": "Express.js 4.21.2",
  "database": "PostgreSQL (production) + SQLite (dev)",
  "auth": "JWT (jsonwebtoken 9.0.2)",
  "password": "bcrypt 5.1.1",
  "cors": "cors 2.8.5"
}
```

### Database
- **Production**: PostgreSQL (Neon.tech)
- **Development**: SQLite (better-sqlite3)
- **ORM**: Raw SQL queries (custom abstraction layer)

---

## 📂 Project Structure

```
rehearsal-calendar-native/
├── src/                          # React Native application
│   ├── features/                 # Feature-based modules
│   │   ├── auth/                 # Аутентификация
│   │   ├── calendar/             # Календарь и репетиции
│   │   ├── projects/             # Управление проектами
│   │   ├── profile/              # Профиль пользователя
│   │   └── availability/         # Управление доступностью
│   ├── navigation/               # React Navigation setup
│   ├── contexts/                 # React Context providers
│   ├── shared/                   # Shared utilities
│   │   ├── components/           # Reusable UI components
│   │   ├── constants/            # Colors, spacing, typography
│   │   ├── services/             # API client
│   │   ├── types/                # TypeScript types
│   │   └── utils/                # Helper functions
│   └── i18n/                     # Translations
│
├── server/                       # Express.js backend
│   ├── routes/                   # API routes
│   │   ├── native.js             # Native app API (auth, projects, rehearsals)
│   │   └── telegram.js           # Telegram Mini App API
│   ├── database/                 # Database layer
│   │   ├── db.js                 # Database connection
│   │   ├── schema-native.sql     # Native app schema
│   │   ├── schema-postgresql.sql # PostgreSQL schema
│   │   └── migrations/           # DB migrations
│   ├── bot/                      # Telegram bot
│   ├── middleware/               # Express middleware
│   ├── analytics/                # Usage analytics
│   └── server.js                 # Server entry point
│
├── ios/                          # iOS native code
├── android/                      # Android native code (not configured yet)
└── assets/                       # Images, fonts, etc.
```

---

## 🗄 Database Schema

### Core Tables (Native App)

#### `native_users`
Пользователи с email/password аутентификацией
```sql
id              INTEGER PRIMARY KEY
email           TEXT UNIQUE NOT NULL
password_hash   TEXT NOT NULL
first_name      TEXT NOT NULL
last_name       TEXT
phone           TEXT
timezone        TEXT DEFAULT 'Asia/Jerusalem'
locale          TEXT DEFAULT 'en'
notifications_enabled   BOOLEAN DEFAULT TRUE
email_notifications    BOOLEAN DEFAULT TRUE
telegram_id     TEXT UNIQUE  -- Link to Telegram
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

#### `native_projects`
Проекты (театральные постановки)
```sql
id              INTEGER PRIMARY KEY
name            TEXT NOT NULL
description     TEXT
timezone        TEXT DEFAULT 'Asia/Jerusalem'
created_by      INTEGER REFERENCES native_users(id)
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

#### `native_project_members`
Участники проектов (many-to-many)
```sql
id              INTEGER PRIMARY KEY
project_id      INTEGER REFERENCES native_projects(id) ON DELETE CASCADE
user_id         INTEGER REFERENCES native_users(id) ON DELETE CASCADE
role            TEXT DEFAULT 'member'  -- 'admin' or 'member'
status          TEXT DEFAULT 'active'  -- 'active', 'inactive', 'pending'
joined_at       TIMESTAMP
UNIQUE(project_id, user_id)
```

#### `native_rehearsals`
Репетиции
```sql
id                  INTEGER PRIMARY KEY
project_id          INTEGER REFERENCES native_projects(id) ON DELETE CASCADE
starts_at           TIMESTAMPTZ NOT NULL    -- Start time with timezone (ISO 8601)
ends_at             TIMESTAMPTZ NOT NULL    -- End time with timezone (ISO 8601)
location            VARCHAR                 -- Simple location string
location_address    TEXT                    -- Detailed address (optional)
location_notes      TEXT                    -- Location notes (optional)
status              VARCHAR DEFAULT 'scheduled'  -- 'scheduled', 'cancelled', etc.
created_by          INTEGER REFERENCES native_users(id) NOT NULL
recurrence_rule     TEXT                    -- For recurring rehearsals (optional)
parent_rehearsal_id INTEGER REFERENCES native_rehearsals(id)  -- For recurring instances
created_at          TIMESTAMP DEFAULT NOW()
updated_at          TIMESTAMP DEFAULT NOW()
title               VARCHAR                 -- Optional title (not used in UI)
description         TEXT                    -- Optional description (not used in UI)
```

**Timezone Handling:**
- Uses `TIMESTAMPTZ` (PostgreSQL) - stores UTC timestamps with timezone info
- API sends/receives ISO 8601 format: `"2025-12-10T19:00:00+02:00"`
- Client displays in user's local timezone
- See [MIGRATION_TO_TIMESTAMPTZ.md](MIGRATION_TO_TIMESTAMPTZ.md) for details

#### `native_rehearsal_participants`
Участники репетиций (many-to-many)
```sql
id              INTEGER PRIMARY KEY
rehearsal_id    INTEGER REFERENCES native_rehearsals(id) ON DELETE CASCADE
user_id         INTEGER REFERENCES native_users(id) ON DELETE CASCADE
UNIQUE(rehearsal_id, user_id)
```

#### `native_rehearsal_responses`
RSVP ответы на репетиции
```sql
id              INTEGER PRIMARY KEY
rehearsal_id    INTEGER REFERENCES native_rehearsals(id) ON DELETE CASCADE
user_id         INTEGER REFERENCES native_users(id) ON DELETE CASCADE
response        VARCHAR(10) NOT NULL CHECK (response IN ('yes', 'no', 'maybe'))
notes           TEXT
created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
UNIQUE(rehearsal_id, user_id)
```

#### `native_user_availability`
Доступность пользователей
```sql
id                  INTEGER PRIMARY KEY
user_id             INTEGER REFERENCES native_users(id) ON DELETE CASCADE
starts_at           TIMESTAMPTZ NOT NULL      -- Start time with timezone (ISO 8601)
ends_at             TIMESTAMPTZ NOT NULL      -- End time with timezone (ISO 8601)
type                VARCHAR NOT NULL          -- 'available', 'busy', 'tentative', 'booked'
source              VARCHAR DEFAULT 'manual'  -- 'manual', 'rehearsal', 'external'
external_event_id   VARCHAR                   -- ID of external event (e.g., rehearsal ID)
title               VARCHAR
notes               TEXT
recurrence_rule     TEXT                      -- For recurring availability
is_all_day          BOOLEAN DEFAULT FALSE     -- Flag for all-day slots (00:00-23:59)
created_at          TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
updated_at          TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
```

**Timezone Handling:**
- Uses `TIMESTAMPTZ` (PostgreSQL) - stores UTC timestamps with timezone info
- API accepts date + slots format: `{ "date": "2025-12-10", "slots": [...] }`
- Server converts slots to ISO 8601 timestamps internally
- All-day events: stored as `00:00:00` in user's timezone with `is_all_day: true`
- See [MIGRATION_TO_TIMESTAMPTZ.md](MIGRATION_TO_TIMESTAMPTZ.md) for details

#### `native_invites`
Инвайт-ссылки для проектов
```sql
id              INTEGER PRIMARY KEY
project_id      INTEGER REFERENCES native_projects(id) ON DELETE CASCADE
code            TEXT UNIQUE NOT NULL  -- Random hash
created_by      INTEGER REFERENCES native_users(id)
expires_at      TIMESTAMP
created_at      TIMESTAMP
```

### Indexes
```sql
CREATE INDEX idx_project_members_project ON native_project_members(project_id);
CREATE INDEX idx_project_members_user ON native_project_members(user_id);
CREATE INDEX idx_rehearsals_project ON native_rehearsals(project_id);
CREATE INDEX idx_rehearsals_date ON native_rehearsals(date);
CREATE INDEX idx_rsvp_rehearsal ON native_rsvp_responses(rehearsal_id);
CREATE INDEX idx_rsvp_user ON native_rsvp_responses(user_id);
CREATE INDEX idx_availability_user ON native_user_availability(user_id);
CREATE INDEX idx_availability_date ON native_user_availability(date);
CREATE INDEX idx_invites_code ON native_invites(code);
```

---

## 🔐 Authentication Flow

### Registration & Login
1. **Register**: `POST /api/auth/register`
   - Email, password, firstName, lastName
   - Returns: accessToken, refreshToken, user

2. **Login**: `POST /api/auth/login`
   - Email, password
   - Returns: accessToken, refreshToken, user

3. **Telegram Login**: `POST /api/auth/telegram`
   - Telegram auth data
   - Links or creates account

### Token Management
- **Access Token**: JWT, expires in 15 minutes
- **Refresh Token**: JWT, expires in 7 days
- **Storage**: AsyncStorage (React Native)
- **Auto-refresh**: Axios interceptor handles 401 responses

### Protected Routes
All `/api/native/*` routes require `Authorization: Bearer <token>` header

---

## 🌐 API Endpoints

### Authentication
```
POST   /api/auth/register      # Register new user
POST   /api/auth/login         # Login with email/password
POST   /api/auth/telegram      # Login with Telegram
POST   /api/auth/refresh       # Refresh access token
GET    /api/auth/me            # Get current user
PUT    /api/auth/me            # Update user profile
DELETE /api/auth/me            # Delete account
```

### Projects
```
GET    /api/native/projects                    # Get user's projects
GET    /api/native/projects/:id                # Get single project
POST   /api/native/projects                    # Create project
PUT    /api/native/projects/:id                # Update project
DELETE /api/native/projects/:id                # Delete project
GET    /api/native/projects/:id/members        # Get project members
GET    /api/native/projects/:id/members/availability  # Get members' availability
```

### Invites
```
POST   /api/native/projects/:id/invite         # Create invite link
GET    /api/native/projects/:id/invite         # Get current invite
DELETE /api/native/projects/:id/invite         # Revoke invite
GET    /api/native/invite/:code                # Get invite info (public)
POST   /api/native/invite/:code/join           # Join project via invite
```

### Rehearsals
```
GET    /api/native/projects/:projectId/rehearsals              # Get rehearsals
GET    /api/native/rehearsals/batch?projectIds=1,2,3           # Get rehearsals for multiple projects (batch)
POST   /api/native/projects/:projectId/rehearsals              # Create rehearsal
PUT    /api/native/projects/:projectId/rehearsals/:id          # Update rehearsal
DELETE /api/native/projects/:projectId/rehearsals/:id          # Delete rehearsal
POST   /api/native/rehearsals/:id/respond                      # RSVP response
GET    /api/native/rehearsals/:id/my-response                  # Get my RSVP
GET    /api/native/rehearsals/:id/responses                    # Get all RSVPs (admin)
```

### Availability
```
GET    /api/native/availability                         # Get user's availability
POST   /api/native/availability/bulk                    # Bulk set availability (ISO timestamps)
PUT    /api/native/availability/:date                   # DEPRECATED - use bulk instead
DELETE /api/native/availability/:date                   # Delete manual availability for date
DELETE /api/native/availability/imported/all           # Delete all imported calendar events
GET    /api/native/projects/:id/members/availability    # Get members' availability (range)
```

---

## 📅 Calendar Synchronization

Двусторонняя синхронизация между приложением и календарем устройства (iOS/Google Calendar).

### Export: Rehearsals → Device Calendar

**Что делает:**
- Экспортирует репетиции из приложения в выбранный календарь устройства
- Создает события календаря с деталями репетиции (название, время, место, описание)
- Отслеживает связь rehearsal ↔ calendar event через AsyncStorage
- Поддерживает batch sync для ускорения (10 events в параллель)

**Файлы:**
- [src/shared/services/calendarSync.ts](src/shared/services/calendarSync.ts) - основная логика синхронизации
- [src/shared/utils/calendarStorage.ts](src/shared/utils/calendarStorage.ts) - AsyncStorage tracking
- [src/features/calendar/hooks/useCalendarSync.ts](src/features/calendar/hooks/useCalendarSync.ts) - React hook

**Ключевые функции:**
```typescript
// Синхронизировать все репетиции (batch)
syncAllRehearsals(rehearsals, calendarId, onProgress?)

// Синхронизировать одну репетицию
syncRehearsalToCalendar(rehearsal, calendarId)

// Удалить все экспортированные события (batch)
removeAllExportedEvents(onProgress?)
```

**Performance optimizations:**
- Batch processing: обрабатывает 10 событий параллельно вместо последовательно
- До оптимизации: 50 events × 100ms = 5-10 секунд
- После оптимизации: 1-2 секунды (5x faster)

### Import: Calendar Events → User Availability

**Что делает:**
- Импортирует события из выбранных календарей устройства
- Создает availability записи в БД для занятых промежутков времени
- Помечает availability как `source: 'imported'` для отличия от ручных записей
- Поддерживает batch import (chunk size: 50 events)
- Автоматическая синхронизация при фокусе экрана (если включена)

**Файлы:**
- [src/shared/services/calendarSync.ts](src/shared/services/calendarSync.ts) - функция `importCalendarEvents()`
- [src/shared/utils/calendarStorage.ts](src/shared/utils/calendarStorage.ts) - tracking импортированных событий

**Ключевые функции:**
```typescript
// Импортировать события из календарей
importCalendarEvents(calendarIds, dateRange, onProgress?)

// Удалить все импортированные availability записи
clearImportedAvailability()
```

**Storage tracking:**
```typescript
// AsyncStorage keys
@calendar_sync_settings - настройки синхронизации
@rehearsal_calendar_map - маппинг rehearsalId → eventId (export)
@imported_calendar_events - маппинг eventId → metadata (import)
```

### UI: CalendarSyncSettingsScreen

**Путь:** [src/features/profile/screens/CalendarSyncSettingsScreen.tsx](src/features/profile/screens/CalendarSyncSettingsScreen.tsx)

**Функционал:**
- **Auto Sync Toggle** - включает/выключает автоматическую синхронизацию
  - При включении: выбирает первый доступный календарь для import и export
  - Устанавливает interval = 'always' (синхронизация при каждом фокусе экрана)
- **Manual Sync Button** - запускает синхронизацию вручную
  - Выполняет import и export последовательно
  - Показывает результаты (imported, skipped, exported)
- **Permissions** - запрашивает разрешения на доступ к календарю
- **Calendar Selection** - выбор календарей для import/export (Phase 2)

**Hook:** `useCalendarSync()`
```typescript
const {
  // State
  hasPermission,
  calendars,
  settings,
  isSyncing,
  isImporting,
  syncedCount,
  importedCount,
  lastSyncTime,
  lastImportTime,

  // Actions
  requestPermissions,
  updateSettings,
  syncAll,           // Export all rehearsals
  removeAll,         // Remove all exported events
  importNow,         // Import calendar events
  clearImported,     // Clear imported availability
  refresh,
} = useCalendarSync();
```

### Batch API Optimization

**Problem:** N+1 queries при загрузке репетиций из нескольких проектов

**Solution:** Batch endpoint `/api/native/rehearsals/batch`

**До оптимизации:**
```typescript
// N sequential requests (медленно!)
for (const project of projects) {
  await rehearsalsAPI.getAll(project.id);
}
// 5 projects × 400ms = 2000ms
```

**После оптимизации:**
```typescript
// 1 batch request (быстро!)
const response = await rehearsalsAPI.getBatch(projectIds);
// 1 request = 400ms (5x faster)
```

**Используется в:**
- [src/features/calendar/hooks/useRehearsals.ts:49-58](src/features/calendar/hooks/useRehearsals.ts#L49-L58) - загрузка всех репетиций
- [src/features/profile/screens/CalendarSyncSettingsScreen.tsx:176-189](src/features/profile/screens/CalendarSyncSettingsScreen.tsx#L176-L189) - экспорт в календарь

**Performance improvement:** 5-10x ускорение загрузки данных

---

## 🎨 Design System

### Color Palette
```typescript
Colors = {
  bg: {
    primary: '#0A0A0F',    // Dark background
    secondary: '#16161F',  // Card background
  },
  glass: {
    bg: 'rgba(255, 255, 255, 0.05)',
    border: 'rgba(255, 255, 255, 0.1)',
  },
  accent: {
    purple: '#A855F7',     // Primary brand color
    blue: '#3B82F6',
    green: '#10B981',
    red: '#EF4444',
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#A1A1AA',
    tertiary: '#52525B',
  }
}
```

### Typography
```typescript
FontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
}

FontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
}
```

### Spacing
```typescript
Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
}
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18.0.0
- npm or yarn
- Xcode (for iOS development)
- PostgreSQL (for production) or SQLite (auto-installed)

### Installation

1. **Clone repository**
```bash
git clone <repo-url>
cd rehearsal-calendar-native
```

2. **Install dependencies**
```bash
# Frontend
npm install

# Backend
cd server
npm install
```

3. **Setup environment**
```bash
# Copy server/.env.example to server/.env
cp server/.env.example server/.env

# Edit server/.env with your settings
```

4. **Initialize database**
```bash
cd server
npm run migrate:dev   # For SQLite (development)
# or
npm run migrate:neon  # For PostgreSQL (production)
```

5. **Start development servers**
```bash
# Terminal 1: Backend server
cd server
node server.js

# Terminal 2: Metro bundler
npx expo start -c

# Terminal 3: iOS simulator (Xcode required)
# Open ios/rehearsalcalendarnative.xcworkspace in Xcode
# Press ⌘R to build and run
```

### Environment Variables

**server/.env**
```env
NODE_ENV=development
PORT=3001

# PostgreSQL (production)
DATABASE_URL=postgresql://user:pass@host/db

# JWT
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# Telegram Bot (optional)
TELEGRAM_BOT_TOKEN=your-bot-token
ENABLE_NOTIFICATIONS=false
```

**src/shared/services/api.ts**
```typescript
// Development: Use your computer's IP address
const API_URL = 'http://192.168.1.39:3001/api';

// Production: Use deployed URL
const API_URL = 'https://your-app.com/api';
```

---

## 🧪 Testing

```bash
# Run tests
npm test

# Type checking
npx tsc --noEmit

# Lint
npm run lint
```

---

## 📦 Deployment

### Backend Deployment (Render.com)
1. Create PostgreSQL database on Neon.tech
2. Create Web Service on Render.com
3. Set environment variables
4. Deploy server code

### Mobile App Deployment

**iOS (App Store)**
```bash
# Build with Xcode
# Product → Archive → Distribute App
```

**Android (Google Play)**
```bash
# Configure android/ folder
npx expo run:android
# Build release APK/AAB
```

---

## 🔧 Key Features Implementation

### Smart Time Recommendations
**Location**: `src/features/calendar/hooks/useTimeRecommendations.ts`

Алгоритм находит оптимальное время для репетиции:
1. Получает доступность всех участников
2. Находит пересечения свободных слотов
3. Сортирует по приоритету (все свободны > большинство свободны)
4. Возвращает топ-3 рекомендации

### Conflict Detection
**Location**: `src/shared/utils/conflictDetection.ts`

Проверяет конфликты при создании репетиции:
1. Сравнивает время репетиции с "busy" слотами участников
2. Генерирует human-readable сообщения о конфликтах
3. Показывает Alert перед созданием репетиции

### Invite Links
**Location**: `server/routes/native.js`

1. Генерация: создается случайный hash-код
2. Sharing: через Deep Links (`rehearsalapp://invite/:code`)
3. Join: код валидируется, пользователь добавляется в проект

---

## 🐛 Known Issues & TODO

### Issues
- [ ] TypeScript errors в availability utils (duplicate exports)
- [ ] Android не настроен (только iOS)

### Recent Fixes (December 2024)
- [x] ✅ **MAJOR**: Миграция на TIMESTAMPTZ - все даты/времена теперь используют ISO 8601 с timezone
- [x] ✅ Упрощена логика работы с таймзонами - добавлен флаг `is_all_day` для целодневных слотов
- [x] ✅ Исправлена работа с БД - приведено в соответствие со схемой production
- [x] ✅ Исправлен `formatTime()` в AddRehearsalScreen - использует ручное форматирование вместо `toLocaleTimeString()`
- [x] ✅ Исправлена логика букирования слотов репетиций - используются колонки `source` и `external_event_id`
- [x] ✅ Добавлен Smart Planner - умный планировщик с анализом доступности и рекомендациями времени
- [x] ✅ Добавлен DateRangePicker - компонент выбора диапазона дат для custom периодов
- [x] ✅ Унификация UI календарных карточек - TodayRehearsals теперь использует те же стили что и Upcoming Events
- [x] ✅ Исправлена RSVP функциональность - корректная сигнатура handleRSVP с callback паттерном
- [x] ✅ Удалены emoji иконки из Smart Planner (Период, Участники)
- [x] ✅ Добавлены quick action кнопки в MemberFilter для быстрого выбора всех/очистки участников
- [x] ✅ **MAJOR**: Полная локализация приложения (Русский/English)
  - Все экраны переведены на оба языка
  - Динамические календарные компоненты (месяцы, дни недели)
  - Локализованные DateTimePicker и Calendar компоненты
  - Компонент ActorSelector с переводами статусов доступности
  - Unified i18n система с централизованными переводами

### TODO
- [ ] Push notifications (Expo Notifications)
- [ ] Offline mode (Redux + Redux Persist)
- [ ] Calendar export (iCal format)
- [ ] Analytics integration

---

## 🔧 Troubleshooting

### Connection Timeout Issues (РЕШЕНО ✅)

**Проблема**: Приложение не могло подключиться к серверу, получало timeout ошибки.

**Найденные причины:**
1. **Xcode собирал в Release mode** - схема была настроена на `buildConfiguration = "Release"` для LaunchAction
   - **Симптомы**: `__DEV__` возвращал `false`, из-за чего приложение пыталось подключиться к production серверу
   - **Решение**: Изменено на `buildConfiguration = "Debug"` в [ios/rehearsalcalendarnative.xcodeproj/xcshareddata/xcschemes/rehearsalcalendarnative.xcscheme](ios/rehearsalcalendarnative.xcodeproj/xcshareddata/xcschemes/rehearsalcalendarnative.xcscheme#L44)

2. **Неправильный IP адрес** - fallback IP в api.ts был `192.168.1.38`, но машина была в другой сети
   - **Симптомы**: Сервер слушал на `0.0.0.0:3001`, но приложение не могло подключиться по старому IP
   - **Решение**: Изменён fallback IP на `localhost` в [src/shared/services/api.ts](src/shared/services/api.ts#L20) (работает для iOS симулятора)

3. **Сервер не перезапустился после изменений** - старый процесс слушал только на `127.0.0.1`
   - **Решение**: Перезапущен сервер для применения изменений (`app.listen(PORT, '0.0.0.0')`)

**Текущая конфигурация:**
- Сервер слушает на `0.0.0.0:3001` (доступен по всем интерфейсам)
- API URL: `http://localhost:3001/api` (для iOS симулятора)
- Xcode схема настроена на Debug mode
- `__DEV__` корректно возвращает `true` в режиме разработки

**Как проверить:**
```bash
# 1. Проверить что сервер слушает на всех интерфейсах
lsof -i :3001  # Должен показать *:redwood-broker (LISTEN)

# 2. Проверить подключение через localhost
curl http://localhost:3001/api/auth/me  # Должен вернуть 401 (это ok, не передали токен)

# 3. В логах Xcode должно быть:
# '[API] __DEV__:', true
# '[API] API_URL:', 'http://localhost:3001/api'
```

---

## 🗂 Dead Code Analysis

### Старые файлы (можно удалить)
```
/rehearsal_tari_src/   # Старый веб-проект (не используется)
```

### Неиспользуемые схемы БД
- `server/database/schema.sql` - старая SQLite схема для Telegram bot
- `server/database/schema-postgresql.sql` - старая PostgreSQL схема

**Актуальные схемы:**
- `schema-native.sql` - используется для native app

---

## 📞 Support & Contact

- **Issues**: GitHub Issues
- **Docs**: This file + inline code comments
- **API**: See Postman collection (if available)

---

## 📄 License

Private project - All rights reserved

---

## 🌍 Internationalization (i18n)

### Система локализации

Приложение полностью поддерживает два языка: **Русский** и **English**.

**Location**: `src/i18n/translations.ts`, `src/contexts/I18nContext.tsx`

### Архитектура

**1. Translations File** (`src/i18n/translations.ts`)
```typescript
export type Language = 'ru' | 'en';

export interface Translations {
  common: { save, cancel, delete, ... },
  nav: { calendar, projects, ... },
  auth: { login, register, ... },
  calendar: { ... },
  projects: { ... },
  rehearsals: { ... },
  availability: { ... },
  smartPlanner: { ... },
  profile: { ... },
  days: { monday, tuesday, ..., short: { ... } },
  months: string[]
}

const ru: Translations = { ... };
const en: Translations = { ... };
```

**2. I18n Context** (`src/contexts/I18nContext.tsx`)
```typescript
const { t, language, changeLanguage } = useI18n();

// Использование
<Text>{t.common.save}</Text>
<Text>{t.rehearsals.selectedCount(5, 10)}</Text>
<Text>{t.months[monthIndex]}</Text>
```

**3. Dynamic Functions**
Некоторые переводы - это функции для динамического текста:
```typescript
// В translations.ts
selectedCount: (selected: number, total: number) => `Выбрано: ${selected} из ${total}`

// Использование
t.rehearsals.selectedCount(3, 10) // "Выбрано: 3 из 10"
```

### Локализованные компоненты

**1. CalendarMonth** - Календарная сетка
- Динамические названия месяцев (`t.months[month]`)
- Локализованные дни недели (`t.days.short.*`)
- Location: `src/features/availability/components/calendar/CalendarMonth.tsx`

**2. DateRangePicker** - Выбор диапазона дат
- Использует `react-native-calendars` с локализацией
- Настроенные LocaleConfig для ru/en
- Location: `src/shared/components/DateRangePicker.tsx`

**3. DateTimePicker** - Выбор даты/времени
- Пропс `locale` зависит от текущего языка
- Location: используется в AddRehearsalScreen, AvailabilityScreen

**4. ActorSelector** - Выбор участников
- Статусы доступности: "Свободен"/"Available", "Занят весь день"/"Busy all day"
- Контролы: "Выбрать всех"/"Select All", "Развернуть"/"Expand"
- Location: `src/features/calendar/components/ActorSelector.tsx`

### Переключение языка

Язык выбирается в ProfileScreen:
```typescript
// ProfileScreen.tsx
<TouchableOpacity onPress={() => changeLanguage('en')}>
  <Text>English</Text>
</TouchableOpacity>

<TouchableOpacity onPress={() => changeLanguage('ru')}>
  <Text>Русский</Text>
</TouchableOpacity>
```

Язык сохраняется в AsyncStorage и автоматически применяется при следующем запуске.

### Форматирование дат

Динамическое форматирование на основе locale:
```typescript
const locale = language === 'ru' ? 'ru-RU' : 'en-US';
date.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
```

### Добавление новых переводов

См. подробную инструкцию: [LOCALIZATION_GUIDE.md](LOCALIZATION_GUIDE.md)

**Краткий алгоритм:**
1. Добавить ключ в интерфейс `Translations`
2. Добавить переводы в объекты `ru` и `en`
3. Использовать в компоненте через `t.section.key`

---

## 🌐 Timezone Handling

### ВАЖНО: Миграция на TIMESTAMPTZ (December 2024)

**НОВАЯ АРХИТЕКТУРА**: Все даты и времена теперь используют PostgreSQL `TIMESTAMPTZ` и ISO 8601 формат.

См. подробную документацию: [MIGRATION_TO_TIMESTAMPTZ.md](MIGRATION_TO_TIMESTAMPTZ.md)

### Архитектура работы с таймзонами

**Принцип**: Все даты и времена хранятся в UTC с timezone информацией в базе данных, конвертация происходит автоматически PostgreSQL.

#### Хранение в БД (TIMESTAMPTZ)
```sql
-- Пример: Репетиция 13 декабря 2025, 08:00-16:00 по местному времени (Asia/Jerusalem = UTC+2)
starts_at: '2025-12-13T08:00:00+02:00'::timestamptz  -- ISO 8601 с timezone
ends_at:   '2025-12-13T16:00:00+02:00'::timestamptz  -- PostgreSQL хранит в UTC автоматически
```

#### Функции конвертации
**Location**: `server/utils/timezone.js`

**TIMESTAMPTZ Utilities:**
- `timestampToLocal(isoTimestamp, timezone)` - ISO 8601 → {date, time} в user timezone
- `localToTimestamp(date, time, timezone)` - {date, time} → ISO 8601 в UTC
- `timestampToISO(timestamp)` - Date object → ISO 8601 string
- `formatAvailabilitySlotsResponse(slots, timezone)` - форматирует слоты для API ответа
- `formatRehearsalResponse(rehearsal)` - форматирует репетицию для API ответа

**Устаревшие (для legacy кода):**
- `localToUTC(date, time, timezone)` - конвертирует локальное время в UTC
- `utcToLocal(date, time, timezone)` - конвертирует UTC во время пользователя

#### All-Day Slots (Целодневные слоты)
Специальная логика для целодневных слотов (00:00-23:59):
- Флаг `is_all_day = TRUE` в таблице `native_user_availability`
- НЕ конвертируются через таймзоны (представляют весь локальный день)
- Всегда возвращаются как `{ start: '00:00', end: '23:59', isAllDay: true }`

#### Как это работает в коде

**1. Создание репетиции (клиент → сервер)**
```typescript
// Клиент отправляет ISO 8601 timestamp с timezone offset
{
  startsAt: '2025-12-13T08:00:00+02:00',
  endsAt: '2025-12-13T16:00:00+02:00'
}

// Сервер сохраняет в PostgreSQL TIMESTAMPTZ
// PostgreSQL автоматически конвертирует в UTC для хранения
```

**2. Получение репетиций (сервер → клиент)**
```javascript
// Сервер читает из БД (PostgreSQL возвращает Date object в UTC)
{ starts_at: Date('2025-12-13T06:00:00.000Z'), ends_at: Date('2025-12-13T14:00:00.000Z') }

// Конвертирует в ISO 8601 для отправки клиенту
{
  startsAt: '2025-12-13T06:00:00.000Z',
  endsAt: '2025-12-13T14:00:00.000Z'
}

// Клиент отображает в локальном времени браузера/устройства
```

#### Важные нюансы

1. **Дата может меняться** при конвертации через таймзоны:
   - 23:00 сегодня в одной зоне = 01:00 завтра в другой

2. **Проект имеет timezone**:
   - Хранится в `native_projects.timezone`
   - По умолчанию: `'Asia/Jerusalem'`
   - Используется для всех репетиций проекта

3. **Пользователь имеет timezone**:
   - Хранится в `native_users.timezone`
   - Используется для доступности пользователя

---

## 🏛 Architecture Improvements (December 2024)

### Timezone Conversion Refactoring

Улучшена архитектура работы с timezone для лучшей поддерживаемости и расширяемости кода.

#### Новые файлы

**1. [server/constants/timezone.js](server/constants/timezone.js)** - Централизованные константы
```javascript
// Константы для типов доступности
AVAILABILITY_TYPES = {
  FREE: 'free',
  BUSY: 'busy',
  TENTATIVE: 'tentative',
}

// Источники для availability slots
AVAILABILITY_SOURCES = {
  MANUAL: 'manual',
  REHEARSAL: 'rehearsal',
  GOOGLE: 'google_calendar',
  APPLE: 'apple_calendar',
}

// RSVP status mapping между DB и клиентом
RSVP_STATUS_DB = { YES: 'yes', NO: 'no', MAYBE: 'maybe', INVITED: 'invited' }
RSVP_STATUS_CLIENT = { CONFIRMED: 'confirmed', DECLINED: 'declined', TENTATIVE: 'tentative', INVITED: 'invited' }

// Функции-мапперы для конвертации статусов
mapDBStatusToClient(dbStatus)
mapClientStatusToDB(clientStatus)

// Default timezone
DEFAULT_TIMEZONE = 'Asia/Jerusalem'
```

**2. [server/middleware/timezoneMiddleware.js](server/middleware/timezoneMiddleware.js)** - Middleware для конвертации
```javascript
// Конвертация запроса клиента (local → UTC)
convertRehearsalRequest(rehearsalData) → { date, startTime, endTime, startUTC, endUTC }

// Конвертация ответа сервера (UTC → local)
convertRehearsalResponse(rehearsal, timezone) → { ...rehearsal, localDate, localStartTime, localEndTime }

// Массовая конвертация ответов
convertRehearsalsResponse(rehearsals, timezone) → Array<Rehearsal>

// Валидация timezone
isValidTimezone(timezone) → boolean
```

**3. [server/utils/timezone.js](server/utils/timezone.js)** - Добавлены JSDoc type annotations
```javascript
/**
 * @typedef {Object} DateTimeResult
 * @property {string} date - Date in YYYY-MM-DD format
 * @property {string} time - Time in HH:mm format
 */

/**
 * @typedef {Object} AvailabilitySlot
 * @property {string} start - Start time in HH:mm format
 * @property {string} end - End time in HH:mm format
 * @property {boolean} [isAllDay] - Whether this is an all-day slot
 * ...
 */

// Все функции теперь имеют полные JSDoc аннотации с типами параметров и возврата
```

#### Улучшения в существующих файлах

**[server/routes/native/rehearsals.js](server/routes/native/rehearsals.js)**
- Добавлены импорты констант и middleware
- Заменены magic strings на константы: `AVAILABILITY_TYPES.BUSY`, `AVAILABILITY_SOURCES.REHEARSAL`, `DEFAULT_TIMEZONE`
- Добавлены JSDoc аннотации для всех функций
- Использование параметризованных SQL запросов с константами

**Преимущества новой архитектуры:**

1. **Централизация** - все константы в одном месте, легко поддерживать
2. **Type Safety** - JSDoc аннотации помогают избежать ошибок
3. **Расширяемость** - легко добавить новые типы availability или источники
4. **Читаемость** - код самодокументируется через именованные константы
5. **Переиспользование** - middleware функции можно использовать в разных endpoint'ах

**Пример использования:**
```javascript
// До рефакторинга
await db.run(
  `INSERT INTO native_user_availability (...) VALUES (..., 'busy', 'rehearsal', ...)`,
  [...]
);

// После рефакторинга
import { AVAILABILITY_TYPES, AVAILABILITY_SOURCES } from '../../constants/timezone.js';

await db.run(
  `INSERT INTO native_user_availability (...) VALUES (..., $5, $6, ...)`,
  [..., AVAILABILITY_TYPES.BUSY, AVAILABILITY_SOURCES.REHEARSAL, ...]
);
```

---

### Database Schema Fix: DATE Column Types

**Проблема**: Колонки `date` в таблицах `native_rehearsals` и `native_user_availability` имели тип `TIMESTAMP WITH TIME ZONE`, что вызывало нежелательную timezone конвертацию при сохранении дат.

**Симптом**: При создании репетиции на дату X, она сохранялась как дата X-1 из-за timezone conversion PostgreSQL.

**Решение**: Создана миграция [server/migrations/fix-date-column-types.sql](server/migrations/fix-date-column-types.sql), которая изменяет тип колонок с `TIMESTAMP WITH TIME ZONE` на `DATE`:

```sql
-- Fix native_rehearsals.date column
ALTER TABLE native_rehearsals
  ALTER COLUMN date TYPE DATE USING date::DATE;

-- Fix native_user_availability.date column
ALTER TABLE native_user_availability
  ALTER COLUMN date TYPE DATE USING date::DATE;
```

**Результат**:
- Даты теперь сохраняются корректно без timezone conversion
- Колонка `date` хранит только дату (YYYY-MM-DD) без временной части
- Timezone conversion применяется только к колонкам `start_time` и `end_time`

**Дополнительно**:
- Добавлены импорты timezone conversion utilities в [server/routes/native/availability.js](server/routes/native/availability.js)
- Реализована полная timezone конвертация для availability endpoints (GET/POST/PUT/DELETE)
- Все availability slots теперь конвертируются из local timezone → UTC при сохранении
- Все availability slots конвертируются из UTC → local timezone при чтении

---

## 📅 Calendar Components

### TodayRehearsals Component
**Location**: `src/features/calendar/components/TodayRehearsals.tsx`

Компонент отображения репетиций для выбранной даты.

**Особенности UI:**
- Использует те же стили что и "Ближайшие события" (upcomingCard, upcomingTimeRow, etc.)
- Показывает время, проект, локацию с соответствующими иконками
- Админ-контроли расположены справа вертикально: badge "Админ", кнопка удаления, кнопка редактирования
- RSVP кнопки или статус подтверждения
- Статистика RSVP для админов (confirmed/declined/pending)

**RSVP Integration:**
```typescript
// Правильная сигнатура handleRSVP
onRSVP(rehearsalId, status, (id, status) => {
  setRsvpResponses(prev => ({ ...prev, [id]: status }));
  updateAdminStats(id);
})
```

**Props:**
- `rehearsals: Rehearsal[]` - массив репетиций для даты
- `selectedDate: string` - выбранная дата (YYYY-MM-DD)
- `loading: boolean` - состояние загрузки
- `projects: Project[]` - все проекты пользователя
- `rsvpResponses: Record<string, 'confirmed' | 'declined'>` - RSVP ответы
- `respondingId: string | null` - ID репетиции в процессе RSVP
- `adminStats: Record<string, AdminStats>` - статистика для админов
- `onRSVP: (id, status, onSuccess) => Promise<void>` - обработчик RSVP
- `onDeleteRehearsal: (id) => void` - обработчик удаления
- `setRsvpResponses` - setter для RSVP ответов
- `updateAdminStats: (id) => Promise<void>` - обновление статистики

### RSVP Hook
**Location**: `src/features/calendar/hooks/useRSVP.ts`

```typescript
const { respondingId, handleRSVP } = useRSVP();

// Использование
handleRSVP(rehearsalId, 'confirmed', (id, status) => {
  // Callback вызывается после успешного RSVP
  setRsvpResponses(prev => ({ ...prev, [id]: status }));
  updateAdminStats(id);
});
```

**Параметры handleRSVP:**
1. `rehearsalId: string` - ID репетиции
2. `status: 'confirmed' | 'declined'` - статус ответа
3. `onSuccess: (id, status) => void` - callback после успешного ответа

---

## 🎯 Smart Planner

**Location**: `src/features/smart-planner/`

Smart Planner - это умный планировщик репетиций, который анализирует доступность участников и предлагает оптимальные временные слоты.

### Функциональность

1. **Анализ доступности**:
   - Загружает доступность всех участников проекта за выбранный период
   - Учитывает существующие репетиции как "busy" слоты
   - Поддерживает фильтрацию по участникам

2. **Категории слотов**:
   - 🟢 **Идеально** (perfect): Все участники свободны
   - 🟡 **Хорошо** (good): Большинство (80%+) свободны
   - 🟠 **Возможно** (possible): Половина (50%+) свободны
   - 🔴 **Сложно** (difficult): Менее половины свободны

3. **Периоды планирования**:
   - Неделя (7 дней)
   - Две недели (14 дней)
   - Месяц (30 дней)
   - Свой период (выбор диапазона дат)

4. **DateRangePicker**:
   - Компонент выбора диапазона дат
   - Календарный интерфейс с выбором начала и конца периода
   - Минимальная дата (не раньше сегодня)
   - Валидация: конец не может быть раньше начала

### API

**Endpoints**:
```
GET /api/native/projects/:projectId/members/availability?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&userIds=1,2,3
```

**Response**:
```json
{
  "availability": [
    {
      "userId": "2",
      "firstName": "Вадим",
      "lastName": "Ферт",
      "email": "test@mail.com",
      "dates": [
        {
          "date": "2025-12-12",
          "timeRanges": [
            {
              "start": "21:10",
              "end": "23:10",
              "type": "busy",
              "isAllDay": false
            }
          ]
        }
      ]
    }
  ]
}
```

### Компоненты

- `SmartPlannerScreen.tsx` - Главный экран планировщика
  - Период выбора (Неделя/Месяц/Свой)
  - Фильтр участников с quick actions
  - Отображение рекомендованных слотов по дням

- `DayCard.tsx` - Карточка дня с слотами
  - Группировка слотов по категориям
  - Счетчик слотов в каждой категории
  - Сворачивание/разворачивание категорий

- `SlotItem.tsx` - Карточка временного слота
  - Цветовой индикатор категории
  - Время слота или "Весь день"
  - Статус занятости участников
  - Кнопка "Добавить" для создания репетиции

- `MemberFilter.tsx` - Фильтр по участникам
  - **Quick Actions**: кнопки "Все" и "Очистить" рядом с основным фильтром
  - Модальное окно с чекбоксами участников
  - Отображение количества выбранных участников
  - Props: `onSelectAll` и `onClearAll` для быстрых действий

- `DateRangePicker.tsx` - Выбор диапазона дат
  - Календарный интерфейс
  - Выбор начальной и конечной даты
  - Валидация диапазона
  - Минимальная дата (не раньше сегодня)

### Hooks

- `useSmartPlanner.ts` - Основная логика планировщика
  - Загрузка данных
  - Генерация слотов
  - Фильтрация по категориям и участникам
  - Мерж доступности с репетициями

### Утилиты

- `src/shared/utils/availability.ts` - Утилиты для работы с доступностью
  - `mergeAvailabilityWithRehearsals()` - Объединяет availability с rehearsals
  - `generateTimeSlots()` - Генерирует временные слоты на основе доступности
  - `categorizeSlot()` - Определяет категорию слота
  - `filterSlotsByCategory()` - Фильтрует слоты по категориям

---

## 🔒 Security Checklist (Before Production)

**Status**: ⚠️ Pending - сделать перед публичным релизом

### Critical (обязательно, ~20 минут)
- [ ] **JWT секреты** - добавить обязательные JWT_ACCESS_SECRET и JWT_REFRESH_SECRET в .env
  ```bash
  # server/.env
  JWT_ACCESS_SECRET=<generate-random-256-bit-string>
  JWT_REFRESH_SECRET=<generate-different-random-string>

  # server/middleware/auth.js - добавить проверку при старте
  if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT secrets are required in production');
  }
  ```

- [ ] **XSS патч на /invite** - экранировать expoHost в inline-скрипте
  ```js
  // server/server.js (строка ~140)
  const safeHost = expoHost ? JSON.stringify(String(expoHost)) : 'null';
  const html = `<script>const expoHost = ${safeHost}; /* ... */</script>`;
  ```

- [ ] **CORS белый список** - ограничить origin для API
  ```js
  // server/server.js
  const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:19006'];
  app.use(cors({ origin: allowedOrigins, methods: ['GET','POST','PUT','DELETE'] }));
  ```

- [ ] **Helmet + security headers** - базовые security headers
  ```bash
  npm install helmet
  ```
  ```js
  // server/server.js
  const helmet = require('helmet');
  app.use(helmet({ contentSecurityPolicy: false }));
  ```

### High Priority (важно, ~1-2 часа)
- [ ] **Rate limiting на auth** - защита от брутфорса
  ```bash
  npm install express-rate-limit
  ```
  ```js
  const rateLimit = require('express-rate-limit');
  app.use('/api/auth', rateLimit({ windowMs: 15*60*1000, max: 20 }));
  app.use('/api/native/invite', rateLimit({ windowMs: 15*60*1000, max: 50 }));
  ```

- [ ] **Смена пароля с подтверждением** - требовать currentPassword при смене
  ```js
  // server/routes/native/auth.js PUT /auth/me
  if (password !== undefined) {
    if (!currentPassword) return res.status(400).json({ error: 'Current password required' });
    // verify currentPassword with bcrypt.compare
  }
  ```

- [ ] **expo-secure-store для токенов** - заменить AsyncStorage на SecureStore
  ```bash
  npx expo install expo-secure-store
  ```
  ```js
  // src/shared/services/storage.ts
  import * as SecureStore from 'expo-secure-store';
  // Использовать SecureStore.setItemAsync/getItemAsync для токенов
  ```

- [ ] **Валидация входных данных** - добавить zod/joi для валидации
  ```bash
  npm install zod
  ```

- [ ] **Лимиты размера body** - защита от больших payloads
  ```js
  app.use(express.json({ limit: '100kb' }));
  ```

### Medium Priority (можно позже)
- [ ] **Индексы БД** - оптимизация запросов
  - `native_rehearsals(project_id, starts_at)`
  - `native_user_availability(user_id, starts_at, ends_at)`
  - `native_project_members(project_id, user_id, status)`

- [ ] **Отключить логи в проде** - не логировать PII/credentials
  ```js
  // src/shared/services/api.ts
  if (__DEV__) { console.log(...) }
  ```

---

## 📋 Recent Updates

### Version 1.5.0 - Calendar Sync & Performance Optimization (December 23, 2024)
- ✅ **Calendar Synchronization** - двусторонняя синхронизация с iOS/Google Calendar
  - Export: репетиции → события календаря (batch processing)
  - Import: события календаря → availability пользователей
  - AsyncStorage tracking для связей rehearsal ↔ event
  - CalendarSyncSettingsScreen с auto-sync режимом
- ✅ **Performance Optimization** - устранение N+1 query проблем
  - Batch API endpoint для загрузки репетиций из нескольких проектов
  - Batch calendar sync (10 events в параллель)
  - 5-10x ускорение загрузки данных (2-3s → 400-600ms)
  - Оптимизация useRehearsals и CalendarSyncSettingsScreen

### Version 1.4.0 - Full i18n Implementation (December 17, 2024)
- ✅ Полная локализация всех экранов (Русский/English)
- ✅ I18nContext с поддержкой смены языка
- ✅ Локализованные уведомления и сообщения

---

**Last updated**: December 23, 2024
**Version**: 1.5.0 - Calendar Sync & Performance Optimization
**Maintainer**: Vadim Fertik
