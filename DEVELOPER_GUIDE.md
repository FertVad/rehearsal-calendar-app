# Rehearsal Calendar - Руководство разработчика

## 📋 Содержание
1. [О проекте](#о-проекте)
2. [Технический стек](#технический-стек)
3. [Архитектура](#архитектура)
4. [Быстрый старт](#быстрый-старт)
5. [Деплой](#деплой)
6. [Важные особенности](#важные-особенности)
7. [Структура проекта](#структура-проекта)
8. [API](#api)
9. [Deep Linking](#deep-linking)
10. [Troubleshooting](#troubleshooting)

---

## О проекте

**Rehearsal Calendar** - мобильное приложение для управления репетициями творческих коллективов.

### Основной функционал:
- Создание и управление проектами
- Планирование репетиций с датами и временем
- RSVP система (подтверждение участия)
- Система приглашений через ссылки
- Календарь доступности участников
- Аутентификация через email/password

---

## Технический стек

### Frontend (React Native)
- **Framework**: React Native with Expo (New Architecture enabled)
- **Navigation**: @react-navigation/native + @react-navigation/native-stack
- **State Management**: React Context API
- **HTTP Client**: Axios
- **Storage**: @react-native-async-storage/async-storage
- **Deep Linking**: expo-web-browser
- **Language**: TypeScript

### Backend (Node.js)
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database (Dev)**: SQLite3 (better-sqlite3)
- **Database (Prod)**: PostgreSQL (pg)
- **Auth**: JWT (jsonwebtoken) + bcrypt
- **Type**: ES Modules (type: "module")

### Infrastructure
- **Hosting**: Render.com (Free tier)
- **Region**: Frankfurt
- **Repository**: GitHub
- **CI/CD**: Automatic deploy on push to `dev` branch

---

## Архитектура

```
rehearsal-calendar-native/
├── src/                      # React Native app
│   ├── components/           # Переиспользуемые компоненты
│   ├── contexts/            # React Context (Auth, Projects)
│   ├── features/            # Фичи по доменам
│   │   └── projects/
│   │       └── screens/     # Экраны проектов
│   ├── navigation/          # Навигация
│   ├── screens/             # Глобальные экраны
│   └── shared/              # Shared код
│       ├── constants/       # Константы (colors, etc.)
│       ├── services/        # API клиент
│       ├── types/           # TypeScript типы
│       └── utils/           # Утилиты
│
├── server/                   # Backend
│   ├── database/            # DB setup и миграции
│   ├── middleware/          # JWT auth middleware
│   ├── routes/              # API routes
│   │   ├── auth.js         # Аутентификация
│   │   ├── native.js       # Native app endpoints
│   │   └── telegram.js     # Telegram bot (not used)
│   ├── scripts/             # Migration scripts
│   └── server.js            # Entry point
│
├── assets/                   # Иконки, изображения
├── app.json                 # Expo конфигурация
└── render.yaml              # Render.com deploy config
```

---

## Быстрый старт

### Требования
- Node.js 18+
- npm или yarn
- Xcode (для iOS) или Android Studio (для Android)
- Expo Go app на телефоне (опционально)

### Установка

```bash
# Клонируем репозиторий
git clone https://github.com/FertVad/rehearsal-calendar-app.git
cd rehearsal-calendar-app

# Устанавливаем зависимости
npm install

# Устанавливаем зависимости сервера
cd server
npm install
cd ..
```

### Настройка Backend

```bash
cd server

# Создаём .env файл
cat > .env << EOF
PORT=3001
NODE_ENV=development

# JWT secrets (generate your own!)
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-key-here

# Database (SQLite for dev)
DATABASE_URL=./database.sqlite

# Telegram (optional, not used)
TELEGRAM_BOT_TOKEN=
WEBHOOK_URL=http://localhost:3001
EOF

# Запускаем миграции для SQLite
npm run migrate:native

# Запускаем сервер
npm start
# Или с hot reload:
npm run dev
```

Сервер запустится на `http://localhost:3001`

### Запуск Mobile App

```bash
# В корневой директории проекта
npm start

# Или сразу открыть iOS симулятор:
npx expo start --ios

# Или Android эмулятор:
npx expo start --android
```

### Проверка работы

1. Откройте `http://localhost:3001/api/health` - должен вернуть `{"status":"ok"}`
2. В приложении создайте аккаунт через Register
3. Создайте проект
4. Попробуйте создать репетицию

---

## Деплой

### Production Environment

**URL**: https://rehearsal-calendar-app.onrender.com

**Деплой происходит автоматически** при push в ветку `dev`:

```bash
git add .
git commit -m "Your message"
git push origin dev
```

Render.com автоматически:
1. Обнаруживает изменения в GitHub
2. Запускает build процесс
3. Деплоит новую версию (2-3 минуты)
4. База данных PostgreSQL сохраняется между деплоями

### Конфигурация Render.com

Настройки в файле `render.yaml`:

```yaml
services:
  - type: web
    name: rehearsal-calendar-api
    env: node
    region: frankfurt
    plan: free
    rootDir: server
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /api/health

databases:
  - name: rehearsal-calendar-db
    databaseName: rehearsal_calendar
    plan: free
    region: frankfurt
```

### Environment Variables (Production)

Настраиваются в Render.com Dashboard:
- `NODE_ENV=production`
- `PORT=10000`
- `DATABASE_URL` - автоматически из Render PostgreSQL
- `JWT_SECRET` - auto-generated
- `JWT_REFRESH_SECRET` - auto-generated
- `WEBHOOK_URL=https://rehearsal-calendar-api.onrender.com`

---

## Важные особенности

### 1. Authentication Flow

**JWT + Refresh Token система:**

```typescript
// Токены хранятся в AsyncStorage
accessToken: string (expires in 15 min)
refreshToken: string (expires in 7 days)

// Автоматический refresh через axios interceptor
// См. src/shared/services/api.ts:34-73
```

**Важно**: При logout очищаем ALL AsyncStorage для предотвращения утечки данных между пользователями.

### 2. Deep Linking System

**Проблема**: Safari блокирует автоматические редиректы на custom URL schemes (`rehearsalapp://`)

**Решение**: HTML landing page с кнопкой

```
Пользователь получает: https://rehearsal-calendar-app.onrender.com/invite/CODE
                         ↓
                  Открывает в браузере
                         ↓
            Видит страницу с кнопкой "Открыть приложение"
                         ↓
                  Нажимает кнопку
                         ↓
              Открывается: rehearsalapp://invite/CODE
                         ↓
                  Приложение принимает
```

**Конфигурация** (app.json):
```json
{
  "scheme": "rehearsalapp",
  "ios": {
    "bundleIdentifier": "com.rehearsal.app",
    "associatedDomains": ["applinks:rehearsal-calendar-app.onrender.com"]
  },
  "android": {
    "package": "com.rehearsal.app",
    "intentFilters": [...]
  }
}
```

**Обработка в приложении** (`App.tsx`):
```typescript
Linking.addEventListener('url', (event) => {
  const url = event.url;
  // Парсим rehearsalapp://invite/CODE
  // Навигация на JoinProjectScreen
});
```

### 3. Date Handling

⚠️ **КРИТИЧНО**: Используем custom функцию `parseDateString` для дат

```typescript
// ❌ НЕПРАВИЛЬНО - UTC conversion сдвигает даты:
new Date('2024-11-30') // => 2024-11-29 23:00:00 (в некоторых timezone)

// ✅ ПРАВИЛЬНО - парсим компоненты:
parseDateString('2024-11-30') // => 2024-11-30 00:00:00 (local)
```

См. `src/shared/utils/time.ts:1-13`

### 4. Database Strategy

**Development**: SQLite (быстро, просто)
**Production**: PostgreSQL (Render.com managed)

Миграции различаются:
```bash
# Dev (SQLite)
npm run migrate:native

# Production (PostgreSQL)
npm run migrate:neon
```

**Важно**: Схемы идентичны, но синтаксис слегка отличается (AUTO_INCREMENT vs SERIAL)

### 5. API URL Configuration

```typescript
// src/shared/services/api.ts:8-10
const API_URL = __DEV__
  ? 'http://localhost:3001/api'  // Development
  : 'https://rehearsal-calendar-app.onrender.com/api';  // Production
```

**Development iOS**: `localhost` работает в симуляторе
**Development Android**: Используйте `10.0.2.2` вместо `localhost`

---

## Структура проекта

### Frontend Components

```
src/
├── components/
│   ├── RSVPStatus.tsx          # RSVP статус бейдж
│   └── DateBadge.tsx           # Отображение даты
│
├── contexts/
│   ├── AuthContext.tsx         # Auth state, login/logout
│   └── ProjectContext.tsx      # Projects state, refresh
│
├── features/projects/screens/
│   ├── ProjectsScreen.tsx      # Список проектов
│   ├── ProjectDetailScreen.tsx # Детали + репетиции
│   ├── CreateProjectScreen.tsx # Создание проекта
│   ├── CreateRehearsalScreen.tsx # Создание репетиции
│   └── JoinProjectScreen.tsx   # Присоединение по invite
│
├── screens/
│   ├── HomeScreen.tsx          # Dashboard
│   ├── LoginScreen.tsx         # Вход
│   ├── RegisterScreen.tsx      # Регистрация
│   └── ProfileScreen.tsx       # Профиль + настройки
│
└── shared/
    ├── services/api.ts         # Axios + API endpoints
    ├── types/index.ts          # TypeScript interfaces
    ├── utils/time.ts           # Date utilities
    └── constants/colors.ts     # Design system
```

### Backend Routes

```
server/routes/
├── auth.js          # POST /api/auth/register, /login, /me
├── native.js        # Native app routes:
│                    #   GET /api/native/projects
│                    #   POST /api/native/projects/:id/rehearsals
│                    #   POST /api/native/projects/:id/invite
│                    #   GET /api/native/invite/:code
│                    #   POST /api/native/invite/:code/join
│                    #   POST /api/native/rehearsals/:id/respond
└── telegram.js      # (Not used) Telegram bot routes
```

### HTML Landing Page

```
GET /invite/:code
→ server/server.js:158-222
→ Возвращает красивую HTML страницу с кнопкой
```

---

## API

### Authentication

```typescript
// Register
POST /api/auth/register
Body: { email, password, firstName, lastName? }
Response: { user, accessToken, refreshToken }

// Login
POST /api/auth/login
Body: { email, password }
Response: { user, accessToken, refreshToken }

// Get current user
GET /api/auth/me
Headers: { Authorization: Bearer <accessToken> }
Response: { user }
```

### Projects

```typescript
// Get all user projects
GET /api/native/projects
Response: { projects: Project[] }

// Get single project
GET /api/native/projects/:projectId
Response: { project, rehearsals, members }

// Create project
POST /api/native/projects
Body: { name, description?, timezone? }
Response: { project }
```

### Rehearsals

```typescript
// Get project rehearsals
GET /api/native/projects/:projectId/rehearsals
Response: { rehearsals: Rehearsal[] }

// Create rehearsal
POST /api/native/projects/:projectId/rehearsals
Body: {
  title,
  description?,
  date: 'YYYY-MM-DD',
  startTime: 'HH:mm',
  endTime: 'HH:mm',
  location?
}
Response: { rehearsal }

// RSVP to rehearsal
POST /api/native/rehearsals/:rehearsalId/respond
Body: { status: 'confirmed' | 'declined' | 'tentative', notes? }
Response: { response }

// Get RSVP responses
GET /api/native/rehearsals/:rehearsalId/responses
Response: { responses: Response[] }
```

### Invites

```typescript
// Create invite link
POST /api/native/projects/:projectId/invite
Body: { expiresInDays?: number }
Response: { inviteUrl: string, inviteCode: string }

// Get invite info (public)
GET /api/native/invite/:code
Response: { projectId, projectName, projectDescription }

// Join project via invite
POST /api/native/invite/:code/join
Headers: { Authorization: Bearer <accessToken> }
Response: { project }
```

---

## Deep Linking

### URL Schemes

```
// Web URL (для шаринга)
https://rehearsal-calendar-app.onrender.com/invite/CODE

// Deep link URL (открывает app)
rehearsalapp://invite/CODE
```

### Как работает

1. **Генерация invite** (server/routes/native.js:12-18):
```javascript
function generateInviteUrl(inviteCode) {
  return `https://rehearsal-calendar-app.onrender.com/invite/${inviteCode}`;
}
```

2. **Landing page** (server/server.js:158-222):
```html
<a href="rehearsalapp://invite/CODE">
  Открыть приложение
</a>
```

3. **App обработка** (App.tsx):
```typescript
Linking.addEventListener('url', (event) => {
  const { hostname, path } = Linking.parse(event.url);
  if (hostname === 'invite') {
    const code = path?.split('/')[1];
    navigation.navigate('JoinProject', { code });
  }
});
```

4. **JoinProjectScreen**:
- Показывает информацию о проекте
- Кнопка "Присоединиться"
- Добавляет пользователя в проект

### Важно для тестирования

```bash
# iOS Simulator
xcrun simctl openurl booted "rehearsalapp://invite/TEST_CODE"

# Android
adb shell am start -W -a android.intent.action.VIEW \
  -d "rehearsalapp://invite/TEST_CODE"
```

---

## Troubleshooting

### 1. "Cannot connect to server" в приложении

**iOS Simulator**:
```typescript
// api.ts должен использовать localhost
const API_URL = 'http://localhost:3001/api'
```

**Android Emulator**:
```typescript
// Замените localhost на:
const API_URL = 'http://10.0.2.2:3001/api'
```

**Real Device**:
```typescript
// Используйте IP вашего компьютера
const API_URL = 'http://192.168.1.XXX:3001/api'
```

### 2. "Token expired" ошибки

Refresh token interceptor должен работать автоматически. Если нет:
```bash
# Проверьте server logs
# Убедитесь что JWT_REFRESH_SECRET установлен
# Очистите AsyncStorage в app
```

### 3. Deep links не работают

**iOS**:
- Проверьте `app.json` → `scheme: "rehearsalapp"`
- Проверьте `CFBundleURLSchemes` в Info.plist (Expo генерирует)

**Android**:
- Проверьте `app.json` → `intentFilters`
- Rebuild app после изменений в app.json

**В браузере**:
- Убедитесь что HTML landing page деплоилась
- Проверьте `/invite/:code` endpoint

### 4. Dates показывают неправильный день

Всегда используйте `parseDateString()`:
```typescript
import { parseDateString } from '@/shared/utils/time';

// ❌ Wrong
new Date(dateString)

// ✅ Correct
parseDateString(dateString)
```

### 5. Database migration errors (Production)

```bash
# Render.com Shell
cd server
npm run migrate:neon

# Или проверьте логи в Render Dashboard
```

### 6. "Free tier asleep" на Render

Render усыпляет free tier сервисы после 15 минут неактивности. Первый запрос будет медленным (cold start ~30 сек).

**Решения**:
- Платный план ($7/мес)
- Или держать localhost для dev

---

## Git Workflow

### Branches
- `main` - stable production (если нужно)
- `dev` - основная ветка, автодеплой на Render

### Commit Messages

Используем conventional commits:
```
feat: Add RSVP functionality
fix: Fix date timezone issue
docs: Update developer guide
refactor: Extract auth logic to context
```

Коммиты с Claude Code помечаются:
```
feat: Add invite system

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Полезные команды

```bash
# Frontend
npm start                    # Запуск Expo dev server
npx expo start --ios        # Запуск iOS simulator
npx expo start --android    # Запуск Android emulator
npx expo start --clear      # Очистить cache

# Backend
cd server
npm start                   # Запуск сервера
npm run dev                 # Запуск с hot reload
npm run migrate:native      # SQLite миграции
npm run migrate:neon        # PostgreSQL миграции

# Database
sqlite3 server/database.sqlite  # Открыть SQLite
.tables                          # Показать таблицы
SELECT * FROM users;             # Query

# Git
git status
git add .
git commit -m "message"
git push origin dev         # Деплой на Render

# iOS Simulator
xcrun simctl list devices   # Список симуляторов
xcrun simctl openurl booted "URL"  # Открыть URL

# Debug
npx react-native log-ios    # iOS logs
npx react-native log-android  # Android logs
```

---

## Контакты

- **Repository**: https://github.com/FertVad/rehearsal-calendar-app
- **Production**: https://rehearsal-calendar-app.onrender.com
- **API Health**: https://rehearsal-calendar-app.onrender.com/api/health

---

## Чеклист для нового разработчика

- [ ] Склонировал репозиторий
- [ ] Установил Node.js 18+
- [ ] Установил зависимости (`npm install` в корне и `server/`)
- [ ] Создал `server/.env` с секретами
- [ ] Запустил миграции (`npm run migrate:native`)
- [ ] Запустил backend (`npm start` в `server/`)
- [ ] Запустил frontend (`npm start` в корне)
- [ ] Создал тестовый аккаунт в приложении
- [ ] Создал тестовый проект
- [ ] Проверил что invite links работают
- [ ] Прочитал секцию "Важные особенности"
- [ ] Понял как работает Deep Linking
- [ ] Знаю где смотреть логи

---

**Последнее обновление**: 2025-11-25
