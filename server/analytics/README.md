# Analytics Module

Система аналитики для отслеживания активности пользователей и событий в приложении.

## Структура

```
server/analytics/
├── migrations/          # SQL миграции
│   ├── add_analytics_tables.sql     # SQLite миграция
│   └── create_analytics_neon.sql    # PostgreSQL миграция
├── routes/              # API endpoints
│   ├── track.js         # POST /api/analytics/track (запись событий)
│   ├── admin.js         # GET /api/analytics/admin/* (статистика)
│   └── auth.js          # POST /api/analytics/admin/auth/login
├── services/            # Бизнес-логика
│   ├── trackingService.js   # Запись событий, батчинг
│   └── analyticsService.js  # Расчет DAU/MAU/статистики
├── queries/             # SQL queries для аналитики
│   └── userActivity.js      # Метрики активности пользователей
├── middleware/          # Express middleware
│   ├── adminAuth.js         # Защита admin routes
│   └── rateLimiter.js       # Rate limiting для tracking
├── scripts/             # Утилиты
│   └── migrate.js           # Миграция БД
└── index.js             # Точка входа, инициализация БД
```

## События (Events)

### Базовые:
- `app_opened` - открытие приложения
- `page_view` - просмотр страницы (calendar/add/smart-planning/tutorial)

### Репетиции:
- `rehearsal_created` - создание репетиции
- `rehearsal_edited` - редактирование
- `rehearsal_deleted` - удаление

### Доступность:
- `availability_saved` - сохранение доступности актера

### Планировщик:
- `smart_planning_used` - использование умного планировщика

### UI Interactions:
- `day_details_opened` - открытие модалки деталей дня
- `my_rehearsals_opened` - открытие списка "Мои репетиции"
- `tutorial_viewed` - просмотр обучающей страницы
- `availability_editor_opened` - открытие редактора доступности

### Конверсии:
- `first_rehearsal_created` - создание первой репетиции пользователем

### Сессии:
- `session_duration` - длительность сессии (при закрытии)

## API Endpoints

### Tracking (Public)
```bash
POST /api/analytics/track
Body: {
  "events": [
    {
      "event": "rehearsal_created",
      "userId": "123456789",
      "properties": { "date": "2025-01-15" }
    }
  ]
}
```

### Admin Authentication
```bash
POST /api/analytics/admin/auth/login
Body: { "password": "admin_password" }

POST /api/analytics/admin/auth/logout
Headers: { "Authorization": "Bearer <token>" }

GET /api/analytics/admin/auth/check
Headers: { "Authorization": "Bearer <token>" }
```

### Admin Analytics (Protected)
```bash
GET /api/analytics/admin/overview
GET /api/analytics/admin/events
GET /api/analytics/admin/user-activity-summary
GET /api/analytics/admin/stats
GET /api/analytics/admin/dau?date=2025-01-15
GET /api/analytics/admin/mau?year=2025&month=1
```

## Миграция

```bash
# Локально (SQLite)
npm run migrate:analytics

# Production (PostgreSQL/Neon)
# Автоматически при `npm start` (prestart hook)
# Или создать таблицу вручную в Neon SQL Editor
```

## Схема БД

```sql
CREATE TABLE analytics_events (
  id SERIAL PRIMARY KEY,
  user_id TEXT,
  event_name TEXT NOT NULL,
  properties JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analytics_timestamp ON analytics_events(timestamp DESC);
CREATE INDEX idx_analytics_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_event_name ON analytics_events(event_name);
CREATE INDEX idx_analytics_user_timestamp ON analytics_events(user_id, timestamp DESC);
CREATE INDEX idx_analytics_event_timestamp ON analytics_events(event_name, timestamp DESC);
```

## Метрики

### User Activity Metrics
- **Total Users** - всего зарегистрировано (хоть раз открыли app)
- **Active (7d)** - активные за последние 7 дней
- **Active (30d)** - активные за последние 30 дней
- **Inactive (30d+)** - не активны больше 30 дней
- **Churn Rate** - процент оттока (были активны 30-60д назад, но не в последние 30д)

### System Metrics
- **DAU** - Daily Active Users
- **MAU** - Monthly Active Users
- **Total Events** - всего событий
- **Total Projects** - количество проектов (групп)

## Frontend Integration

### Tracking Functions (src/shared/utils/analytics.ts)

```typescript
import {
  trackAppOpen,
  trackPageView,
  trackRehearsalCreated,
  trackRehearsalEdited,
  trackRehearsalDeleted,
  trackAvailabilitySaved,
  trackDayDetailsOpened,
  trackMyRehearsalsOpened,
  trackTutorialViewed,
  trackAvailabilityEditorOpened,
  trackFirstRehearsalCreated,
} from '@/shared/utils/analytics';

// Использование
trackAppOpen();
trackRehearsalCreated({ date: '2025-01-15', hasBand: true });
```

### Batching
События батчатся на клиенте:
- Отправляются по 10 событий
- Или каждые 5 секунд
- Или при закрытии страницы (beforeunload)

## Admin Dashboard

**URL:** `https://your-domain.com/admin`

**Features:**
- User Activity Summary (total, active, inactive, churn)
- System Stats (events, projects, DAU, MAU)
- Event Breakdown с процентами
- Refresh button для обновления данных

**Authentication:**
- Вход по паролю (из `ADMIN_PASSWORD` env variable)
- Сессия на 24 часа
- Token хранится в localStorage

## Security

- Admin routes защищены middleware `requireAdminAuth`
- Session-based auth с проверкой токена и expiry
- Rate limiting на tracking endpoint (100 req/min per user/IP)
- Tracking endpoint публичный (без авторизации)

## Environment Variables

```env
ADMIN_PASSWORD=your_secure_password_here
```

## Production Setup

1. Создать таблицу в Neon SQL Editor:
   ```bash
   cat server/analytics/migrations/create_analytics_neon.sql
   # Скопировать и выполнить в Neon
   ```

2. Настроить ADMIN_PASSWORD в Vercel Environment Variables

3. Деплой автоматически запустит миграции через prestart hook
