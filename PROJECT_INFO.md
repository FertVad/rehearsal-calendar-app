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
- ✅ Многоязычность (i18n)
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
date                DATE NOT NULL           -- Stored in UTC
start_time          TIME NOT NULL           -- Stored in UTC
end_time            TIME NOT NULL           -- Stored in UTC
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
date                DATE NOT NULL             -- Stored in UTC
start_time          TIME NOT NULL             -- Stored in UTC
end_time            TIME NOT NULL             -- Stored in UTC
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
POST   /api/native/projects/:projectId/rehearsals              # Create rehearsal
PUT    /api/native/projects/:projectId/rehearsals/:id          # Update rehearsal
DELETE /api/native/projects/:projectId/rehearsals/:id          # Delete rehearsal
POST   /api/native/rehearsals/:id/respond                      # RSVP response
GET    /api/native/rehearsals/:id/my-response                  # Get my RSVP
GET    /api/native/rehearsals/:id/responses                    # Get all RSVPs (admin)
```

### Availability
```
GET    /api/availability                       # Get user's availability
PUT    /api/availability/:date                 # Set availability for date
POST   /api/availability/bulk                  # Bulk set availability
DELETE /api/availability/:date                 # Delete availability
```

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
- [x] ✅ Упрощена логика работы с таймзонами - добавлен флаг `is_all_day` для целодневных слотов
- [x] ✅ Исправлена работа с БД - приведено в соответствие со схемой production
- [x] ✅ Исправлен `formatTime()` в AddRehearsalScreen - использует ручное форматирование вместо `toLocaleTimeString()`
- [x] ✅ Исправлена логика букирования слотов репетиций - используются колонки `source` и `external_event_id`

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

## 🌐 Timezone Handling

### Архитектура работы с таймзонами

**Принцип**: Все даты и времена хранятся в UTC в базе данных, конвертация происходит на уровне API.

#### Хранение в БД (UTC)
```sql
-- Пример: Репетиция 13 декабря 2025, 08:00-16:00 по местному времени (Asia/Jerusalem = UTC+2)
date: '2025-12-13'        -- Дата в UTC (может отличаться от локальной!)
start_time: '06:00:00'    -- 08:00 Jerusalem = 06:00 UTC
end_time: '14:00:00'      -- 16:00 Jerusalem = 14:00 UTC
```

#### Функции конвертации
**Location**: `server/utils/timezone.js`

- `localToUTC(date, time, timezone)` - конвертирует локальное время в UTC
- `utcToLocal(date, time, timezone)` - конвертирует UTC во время пользователя
- `convertSlotsToUTC(date, slots, timezone)` - конвертирует массив слотов в UTC
- `convertSlotsFromUTC(date, slots, timezone)` - конвертирует массив слотов из UTC

#### All-Day Slots (Целодневные слоты)
Специальная логика для целодневных слотов (00:00-23:59):
- Флаг `is_all_day = TRUE` в таблице `native_user_availability`
- НЕ конвертируются через таймзоны (представляют весь локальный день)
- Всегда возвращаются как `{ start: '00:00', end: '23:59', isAllDay: true }`

#### Как это работает в коде

**1. Создание репетиции (клиент → сервер)**
```typescript
// Клиент отправляет в локальном времени
{ date: '2025-12-13', startTime: '08:00', endTime: '16:00' }

// Сервер конвертирует в UTC перед сохранением
const startUTC = localToUTC('2025-12-13', '08:00', 'Asia/Jerusalem');
// → { date: '2025-12-12', time: '06:00:00' }  // Может быть предыдущий день!
```

**2. Получение репетиций (сервер → клиент)**
```javascript
// Сервер читает из БД (UTC)
{ date: '2025-12-12', start_time: '06:00:00', end_time: '14:00:00' }

// Конвертирует в timezone пользователя перед отправкой
const local = utcToLocal('2025-12-12', '06:00:00', 'Asia/Jerusalem');
// → { date: '2025-12-13', time: '08:00' }
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

**Last updated**: December 9, 2025
**Version**: 1.2.1
**Maintainer**: Vadim Fertik
