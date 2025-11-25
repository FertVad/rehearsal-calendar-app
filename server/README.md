# Rehearsal Calendar - Backend API

Backend для нативного мобильного приложения Rehearsal Calendar.

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
cd server
npm install
```

### 2. Настройка окружения

```bash
# Скопируйте .env.example в .env
cp .env.example .env

# Отредактируйте .env и установите:
# - JWT_SECRET (минимум 32 символа)
# - DATABASE_URL (если используете PostgreSQL)
```

### 3. Инициализация базы данных

```bash
# Создаст таблицы в SQLite (для разработки)
npm run migrate

# Или вручную:
# sqlite3 database/data.sqlite < database/schema-native.sql
```

### 4. Запуск сервера

```bash
# Production
npm start

# Development (с авто-перезагрузкой)
npm run dev
```

Сервер запустится на `http://localhost:3001`

---

## 📡 API Endpoints

### Authentication

#### POST /api/auth/register
Регистрация нового пользователя

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2025-01-17T10:00:00.000Z"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

#### POST /api/auth/login
Вход в систему

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

#### POST /api/auth/refresh
Обновление access token

**Request:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

#### GET /api/auth/me
Получить информацию о текущем пользователе

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2025-01-17T10:00:00.000Z"
  }
}
```

#### PUT /api/auth/me
Обновить информацию о пользователе

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com"
}
```

#### DELETE /api/auth/me
Удалить аккаунт

**Headers:**
```
Authorization: Bearer <accessToken>
```

---

### Проекты, репетиции, участники

Те же endpoints что и в Telegram Mini App, но с JWT авторизацией:
- `GET /api/project/:projectId` - получить проект
- `GET /api/rehearsals/:projectId` - получить репетиции
- `POST /api/rehearsals` - создать репетицию
- И т.д.

---

## 🗄️ База данных

### Структура таблиц

#### native_users
Пользователи нативного приложения (email/password авторизация)

```sql
CREATE TABLE native_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  telegram_id TEXT UNIQUE, -- опционально
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### user_projects
Связь пользователей с проектами (many-to-many)

```sql
CREATE TABLE user_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES native_users(id),
  project_id INTEGER REFERENCES projects(id),
  role TEXT DEFAULT 'member', -- 'admin' или 'member'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, project_id)
);
```

#### projects
Проекты (группы/команды)

```sql
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT UNIQUE, -- опционально для native
  name TEXT NOT NULL,
  work_hours_start TEXT DEFAULT '09:00',
  work_hours_end TEXT DEFAULT '22:00',
  notifications_enabled BOOLEAN DEFAULT FALSE,
  notification_language TEXT DEFAULT 'en',
  week_starts_on INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Остальные таблицы: `actors`, `rehearsals`, `availability` - те же что в Telegram Mini App.

---

## 🔐 Безопасность

### JWT Токены

- **Access Token:** Короткий срок жизни (15 минут)
- **Refresh Token:** Длинный срок жизни (7 дней)

### Пароли

- Хешируются с помощью bcrypt (10 раундов)
- Минимальная длина: 6 символов

### Переменные окружения

**ОБЯЗАТЕЛЬНО** измените в production:
```env
JWT_SECRET=ваш-очень-секретный-ключ-минимум-32-символа
```

---

## 🔧 Разработка

### SQLite (по умолчанию для dev)

Файл БД: `server/database/data.sqlite`

Создается автоматически при первом запуске.

### PostgreSQL (для production)

Установите переменную окружения:

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
```

Запустите миграцию:

```bash
psql $DATABASE_URL < database/schema-native.sql
```

---

## 📝 Логирование

Включить подробные логи:

```env
DEBUG=true
LOG_REQUESTS=true
```

---

## 🐛 Отладка

### Проверка соединения с БД

```bash
node -e "import('./database/db.js').then(m => m.testConnection())"
```

### Проверка JWT токена

```bash
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📦 Деплой

### Heroku

```bash
# Добавьте PostgreSQL addon
heroku addons:create heroku-postgresql:mini

# Установите env variables
heroku config:set JWT_SECRET=your-secret-key
heroku config:set NODE_ENV=production

# Deploy
git push heroku main
```

### Railway

```bash
# Подключите PostgreSQL
# Установите переменные окружения в Railway dashboard
# Deploy через GitHub integration
```

### Vercel (serverless)

Можно использовать Vercel Serverless Functions, но нужна адаптация под serverless архитектуру.

---

## 🔄 Миграции

При обновлении схемы БД:

1. Создайте новую миграцию в `database/migrations/`
2. Запустите: `npm run migrate`

---

## 📞 Поддержка

Вопросы и проблемы: создайте issue в GitHub

---

**Версия:** 1.0.0
**Дата создания:** 2025-01-17
