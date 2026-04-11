# Аудит зависимостей

## Frontend (rehearsal-calendar-native/package.json)

### Можно удалить (не найдено ни одного импорта):
- `i18next` — не используется. Проект использует собственный I18nContext.tsx. Размер: 584K
- `react-i18next` — не используется. Своя система i18n через контекст. Размер: 1.1MB

### Под вопросом (косвенные зависимости):
- `react-native-gesture-handler` — нет прямых импортов в src/, используется косвенно через react-navigation. Уже добавлен в knip.json ignoreDependencies. **Не удалять.**
- `react-native-screens` — аналогично, косвенная зависимость react-navigation. **Не удалять.**
- `react-native-svg` — используется только в одном файле (SubscriptionScreen.tsx). Возможно осталось от экспериментов, но используется.

### Используются активно (всё ок):
- @expo/vector-icons (36 файлов)
- @react-native-async-storage/async-storage (9 файлов)
- date-fns + date-fns-tz (форматирование дат)
- axios (4 файла)
- react-native-calendars (основная функциональность)
- react-native-webview (платёжный WebView)
- @testing-library/react-native (тесты)
- Все expo-* пакеты активно используются

## Backend (server/package.json)

### Всё в порядке — все зависимости используются:
- bcrypt → routes/auth.js
- jsonwebtoken → middleware/jwtMiddleware.js, adminAuth.js
- node-cron → server.js, reminderScheduler.js
- date-fns-tz → utils/timezone.js
- cors → server.js
- pg → database/db.js
- better-sqlite3 → database/db.js и тесты
- expo-server-sdk → pushTokens.js, pushNotificationService.js
- google-auth-library → oauthVerification.js
- apple-signin-auth → oauthVerification.js
- dotenv → server.js

## Примерная экономия
- Пакеты к удалению: i18next + react-i18next ≈ **1.7 MB**
- Общий node_modules frontend: 609 MB — экономия незначительная по объёму, но устраняет неиспользуемые зависимости
