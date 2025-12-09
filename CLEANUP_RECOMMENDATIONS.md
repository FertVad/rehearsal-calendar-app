# Cleanup Recommendations - Dead Code & Old Files

## 🗑️ Files & Folders to Remove

### 1. ✅ Референсный проект (НЕ УДАЛЯТЬ!)
```bash
# Location: /Users/vadimfertik/Desktop/reh_app/rehearsal_tari_src/
# Purpose: Telegram Mini App - REFERENCE для дизайна и функциональности
# Status: ✅ KEEP - используется как эталон при разработке Native App

# ✅ ВАЖНО: Это рабочее Telegram Mini App, по которому строится Native версия
# Служит источником UI/UX решений и функциональности
# НЕ УДАЛЯТЬ!
```

### 2. ✅ Неактуальные схемы базы данных (УДАЛЕНО)
```bash
# ✅ ВЫПОЛНЕНО - Старые схемы удалены
# server/database/schema.sql - DELETED
# server/database/schema-postgresql.sql - DELETED

# ✅ ОСТАВЛЕНО:
# schema-native.sql - АКТУАЛЬНАЯ схема для Native App
```

### 3. Test файлы (если тесты не запускаются)
```bash
# Проверьте существуют ли тесты и работают ли они
cd server/database/
rm rehearsal.test.js  # Если тесты не используются
```

---

## ✅ Telegram Bot Code (УДАЛЕНО)

### Server Bot Directory
```bash
# ✅ ВЫПОЛНЕНО - Telegram bot код удален
# server/bot/ - DELETED (весь каталог)
# server/server.js - imports удалены

# Telegram bot не используется в Native App
# Код успешно удален из проекта
```

---

## 🔍 Dead Code Analysis Results

### ✅ Активно используемый код

**Frontend (src/)**
- ✅ All feature modules используются
- ✅ Auth, Calendar, Projects, Profile, Availability - все активны
- ✅ Navigation работает
- ✅ Shared components все используются

**Backend (server/)**
- ✅ `routes/native.js` - АКТИВНО используется Native App
- ✅ `database/db.js` - АКТИВНО
- ✅ `middleware/` - АКТИВНО
- ✅ `analytics/` - АКТИВНО (если включена аналитика)
- ⚠️ `routes/telegram.js` - зависит от использования бота
- ⚠️ `bot/` - зависит от использования бота

### ❌ Неиспользуемые файлы

**Database schemas:**
- ❌ `schema.sql` - старая схема для Telegram
- ❌ `schema-postgresql.sql` - старая схема для Telegram

**Data files:**
- ⚠️ `database/data.sqlite` - dev база, можно пересоздать
- ⚠️ `database/seed.js` - проверьте используется ли

---

## 🧹 Recommended Cleanup Steps

### Step 1: Backup Important Data
```bash
# Создайте backup перед удалением
cd /Users/vadimfertik/Desktop/reh_app/
tar -czf backup_$(date +%Y%m%d).tar.gz rehearsal-calendar-native/
```

### Step 2: Remove Dead Schemas
```bash
cd rehearsal-calendar-native/server/database/

# Удалите старые схемы
rm schema.sql
rm schema-postgresql.sql

# Переименуйте актуальную схему для ясности
mv schema-native.sql schema.sql
```

### Step 3: Clean Node Modules (optional)
```bash
# Очистка и переустановка зависимостей
cd rehearsal-calendar-native/
rm -rf node_modules package-lock.json
npm install

cd server/
rm -rf node_modules package-lock.json
npm install
```

### Step 4: Remove Old Project (OPTIONAL)
```bash
# ⚠️ ТОЛЬКО если уверены что старый проект не нужен!
cd /Users/vadimfertik/Desktop/reh_app/
rm -rf rehearsal_tari_src/
```

---

## 📊 Code Duplication Analysis

### ✅ RESOLVED - All Duplicates Removed & Unified (Dec 3, 2024)

**Phase 1: Removed duplicate utility files (3 files)**
```
src/features/availability/utils/
├── calendarUtils.ts      ✅ KEPT
├── validationUtils.ts    ✅ KEPT (now imports from shared)
└── index.ts              ✅ FIXED
```

**Deleted:**
- ❌ `dateUtils.ts` - дубликат calendarUtils
- ❌ `scrollUtils.ts` - дубликат calendarUtils
- ❌ `slotValidation.ts` - дубликат validationUtils

**Phase 2: Unified time/date functions across codebase**

**Single source of truth:** `src/shared/utils/time.ts`

**Added centralized functions:**
- ✅ `timeToMinutes(time: string): number` - convert HH:mm to minutes
- ✅ `minutesToTime(minutes: number): string` - convert minutes to HH:mm
- ✅ `formatDateToStringUTC(date: Date): string` - UTC date formatting
- ✅ `formatTimeUTC(date: Date): string` - UTC time formatting

**Updated files to use shared utilities (5 files):**
- ✅ `shared/utils/timezone.ts` - removed formatDate/formatTime duplicates
- ✅ `shared/utils/conflictDetection.ts` - removed timeToMinutes duplicate
- ✅ `shared/utils/availability.ts` - removed toMinutes/toTimeString duplicates, re-exports from time.ts
- ✅ `features/availability/utils/validationUtils.ts` - removed timeToMinutes duplicate, re-exports from time.ts
- ✅ `features/projects/screens/ProjectDetailScreen.tsx` - removed formatDateToString duplicate

**Before → After:**
- ❌ 3 copies of `timeToMinutes` → ✅ 1 function in `shared/utils/time.ts`
- ❌ 3 copies of `formatDate` → ✅ 2 functions (`formatDateToString` local, `formatDateToStringUTC` for UTC)
- ✅ All modules now import from single source
- ✅ TypeScript compiles without errors
- ✅ DRY principle satisfied

---

## 🔧 Configuration Cleanup

### Environment Files
```bash
server/.env           # ✅ ИСПОЛЬЗУЕТСЯ - основной файл
server/.env.example   # ✅ ОСТАВИТЬ - пример для новых разработчиков
server/.env.temp      # ❌ УДАЛИТЬ - временный файл
```

```bash
rm server/.env.temp
```

### Git Cleanup
```bash
# Удалите неиспользуемые ветки (если есть)
git branch -D old-branch-name

# Очистите git кэш больших файлов
git gc --aggressive --prune=now
```

---

## 📝 Documentation Cleanup

### Old Docs to Archive or Remove
```bash
server/NEON_SETUP.md      # ✅ ОСТАВИТЬ - инструкции по Neon.tech
server/README.md          # ✅ ОСТАВИТЬ - README сервера
```

### New Documentation Created
```bash
PROJECT_INFO.md           # ✅ Полная документация проекта
CLEANUP_RECOMMENDATIONS.md # ✅ Этот файл
```

---

## 🎯 Priority Actions

### High Priority (сделать сейчас)
1. ✅ Удалить `server/database/schema.sql` и `schema-postgresql.sql`
2. ✅ Удалить `server/.env.temp`
3. ✅ Проверить и исправить TypeScript errors в availability utils

### Medium Priority (сделать когда будет время)
1. 📋 Решить судьбу `rehearsal_tari_src/` (архивировать или удалить)
2. 📋 Унифицировать time utils
3. 📋 Очистить неиспользуемые Telegram bot файлы (если бот не используется)

### Low Priority (опционально)
1. 📋 Настроить ESLint для автоматического поиска unused imports
2. 📋 Добавить pre-commit hooks для проверки dead code
3. 📋 Настроить Bundle analyzer для поиска неиспользуемых зависимостей

---

## 🔍 Tools for Dead Code Detection

### Recommended Tools
```bash
# Find unused exports
npm install -g ts-prune
cd src/
ts-prune

# Find unused files
npm install -g unimported
unimported

# Bundle size analysis
npx expo-updates --group-assets-by-extension
```

---

## ✅ Checklist

- [ ] Создан backup проекта
- [ ] Удалены старые DB схемы
- [ ] Удален `.env.temp`
- [ ] Исправлены TypeScript errors
- [ ] Принято решение по `rehearsal_tari_src/`
- [ ] Проверены и удалены неиспользуемые Telegram bot файлы
- [ ] Унифицированы time utilities
- [ ] Запущены тесты после cleanup
- [ ] Приложение работает корректно

---

**Last updated**: December 3, 2024
