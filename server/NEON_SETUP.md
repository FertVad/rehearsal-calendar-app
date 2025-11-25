# Подключение Neon PostgreSQL

Этот гайд поможет подключить базу данных Neon от Telegram Mini App к нативному приложению.

**ВАЖНО:** Вместо создания отдельной таблицы `native_users`, мы расширяем существующую таблицу `actors` для поддержки email/password аутентификации. Это позволяет иметь единую таблицу пользователей для обоих приложений.

## Предварительные требования

- Доступ к Neon консоли (https://console.neon.tech/)
- База данных Telegram Mini App уже создана в Neon с таблицей `actors`

## Шаг 1: Получить connection string из Neon

1. Откройте Neon Console
2. Выберите ваш проект (тот же, что используется для Telegram Mini App)
3. Перейдите в Dashboard
4. Скопируйте Connection String
   - Формат: `postgresql://user:password@host/database?sslmode=require`

## Шаг 2: Добавить в .env

Откройте файл `server/.env` и добавьте/раскомментируйте строку:

```env
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
```

Замените на ваш connection string из Neon.

## Шаг 3: Запустить миграцию

Миграция добавит колонки `email` и `password_hash` в существующую таблицу `actors`:

```bash
cd server
node scripts/migrate-neon.js
```

Вы увидите:
```
🔌 Connecting to Neon PostgreSQL...
✅ Connected to Neon database

📦 Running migration: 002-add-native-auth-to-actors.sql
✅ Migration completed successfully

🔍 Verifying columns...
✅ Columns added to actors table:
   - email (VARCHAR(255) UNIQUE)
   - password_hash (VARCHAR(255))

🎉 Neon database is ready for native app!
```

## Шаг 4: Перезапустить сервер

```bash
npm start
```

При запуске вы увидите:
```
[DB] Connected to PostgreSQL
```

Вместо:
```
[DB] Using SQLite database
```

## Что произойдет

После подключения Neon:

1. ✅ Таблица `actors` будет иметь дополнительные колонки `email` и `password_hash`
2. ✅ Пользователи TG mini app остаются нетронутыми (telegram_id, name, project_id)
3. ✅ Новые пользователи нативного приложения создаются с email/password
4. ✅ Один пользователь может иметь и telegram_id, и email - доступ из обоих приложений!
5. ✅ Все API endpoints работают без изменений

## Обновленная структура таблицы actors

```sql
CREATE TABLE actors (
  id SERIAL PRIMARY KEY,
  -- TG Mini App fields (существующие):
  telegram_id VARCHAR(255) UNIQUE,       -- для TG пользователей
  name VARCHAR(255) NOT NULL,
  project_id INTEGER REFERENCES projects(id),
  is_admin BOOLEAN DEFAULT FALSE,
  ui_language VARCHAR(2) DEFAULT 'en',

  -- Native App fields (новые):
  email VARCHAR(255) UNIQUE,             -- для нативного приложения
  password_hash VARCHAR(255),            -- хеш пароля

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Связь с Telegram Mini App

Три сценария использования:

### 1. Только TG Mini App (существующие пользователи)
```sql
-- Пользователь только в Telegram
INSERT INTO actors (telegram_id, name, project_id)
VALUES ('123456', 'John', 1);

-- email и password_hash = NULL
```

### 2. Только Native App (новые пользователи)
```sql
-- Пользователь регистрируется в нативном приложении
INSERT INTO actors (email, password_hash, name)
VALUES ('john@mail.com', '$2b$10$...', 'John');

-- telegram_id и project_id = NULL
```

### 3. Оба приложения (связанные аккаунты)
```sql
-- Сначала Native App регистрация
INSERT INTO actors (email, password_hash, name)
VALUES ('john@mail.com', '$2b$10$...', 'John');

-- Потом пользователь заходит в TG mini app
UPDATE actors
SET telegram_id = '123456', project_id = 1
WHERE email = 'john@mail.com';

-- Теперь может логиниться через оба приложения!
```

## Откат на SQLite (если нужно)

Просто закомментируйте `DATABASE_URL` в `.env` и перезапустите сервер:

```env
# DATABASE_URL=postgresql://...
```

Сервер автоматически вернется на SQLite.

## Troubleshooting

### Ошибка: "column \"email\" already exists"

Миграция уже была применена ранее. Это безопасно игнорировать.

### Ошибка: "password authentication failed"

Проверьте правильность connection string в `.env`.

### Ошибка: "SSL connection required"

Добавьте `?sslmode=require` в конец connection string.
