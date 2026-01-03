# 📋 Code Review Improvements Checklist

**Ветка:** `feature/code-review-improvements`
**Дата создания:** 2026-01-02
**Источник:** Результаты анализа трёх агентов (Code Quality, UI/UX, Feature Suggestions)

---

## 🎯 Легенда приоритетов

- 🔴 **КРИТИЧНО** - Безопасность, должно быть исправлено немедленно
- 🟡 **ВАЖНО** - Производительность и качество кода, исправить в первую очередь
- 🟢 **УЛУЧШЕНИЯ** - UX/UI, accessibility, можно делать постепенно
- 🔵 **ФИЧИ** - Новый функционал, делать после исправлений

---

## 🔴 Критичные задачи (Безопасность)

### [x] 1. Исправить SQL injection в auth.js ✅

**Приоритет:** 🔴 КРИТИЧНО
**Файл:** `server/routes/auth.js:220-264`
**Проблема:**
```javascript
// УЯЗВИМО - динамическое построение SQL без whitelist
updates.push(`week_start_day = ${paramIndex++}`);
await db.run(
  `UPDATE native_users SET ${updates.join(', ')} WHERE id = ${paramIndex}`,
  values
);
```

**Решение:**
- Создать whitelist разрешённых полей (ALLOWED_FIELDS)
- Мапить camelCase (API) → snake_case (DB)
- Игнорировать неизвестные поля
- Пример:
```javascript
const ALLOWED_FIELDS = {
  'firstName': 'first_name',
  'lastName': 'last_name',
  'timezone': 'timezone',
  'locale': 'locale',
  'weekStartDay': 'week_start_day',
  'notificationsEnabled': 'notifications_enabled',
  'emailNotifications': 'email_notifications'
};
```

**Почему это критично:**
- Злоумышленник может изменить чужие данные
- Можно украсть/удалить всю базу данных
- Neon (PostgreSQL) не защищает - это ответственность приложения

**Затронутые эндпоинты:**
- `PUT /auth/me` - основной уязвимый эндпоинт

---

## 🟡 Важные задачи (Производительность)

### [x] 2. Добавить useCallback в AuthContext ✅

**Приоритет:** 🟡 ВАЖНО
**Файл:** `src/contexts/AuthContext.tsx`
**Проблема:**
- Все функции (login, logout, register, updateUser, loadUser) создаются заново при каждом рендере
- Все компоненты, использующие AuthContext, перерисовываются без необходимости

**Решение:**
```typescript
const login = useCallback(async (email: string, password: string) => {
  // ... existing code
}, []);

const logout = useCallback(async () => {
  // ... existing code
}, []);

const register = useCallback(async (email: string, password: string, firstName: string, lastName: string) => {
  // ... existing code
}, []);

const updateUser = useCallback(async (updates: Partial<User>) => {
  // ... existing code
}, [user]); // depends on user

const loadUser = useCallback(async () => {
  // ... existing code
}, []);
```

**Почему это важно:**
- Приложение может тормозить на слабых устройствах
- Расход батареи
- Плохой UX

---

### [ ] 3. Добавить useCallback в I18nContext

**Приоритет:** 🟡 ВАЖНО
**Файл:** `src/contexts/I18nContext.tsx`
**Проблема:**
- Функции `setLanguage` и `loadLanguage` создаются заново при каждом рендере

**Решение:**
```typescript
const loadLanguage = useCallback(async () => {
  // ... existing code
}, []);

const setLanguage = useCallback(async (lang: Language) => {
  // ... existing code
}, []);
```

---

### [ ] 4. Извлечь дублирующийся код AsyncStorage sync

**Приоритет:** 🟡 ВАЖНО
**Файлы:** `src/contexts/AuthContext.tsx` (4 дубликата в loadUser, login, register, updateUser)
**Проблема:**
- Повторяющийся код синхронизации с AsyncStorage:
```typescript
// Дублируется 4 раза
if (user.timezone) await AsyncStorage.setItem('timezone', user.timezone);
if (user.locale) await AsyncStorage.setItem('locale', user.locale);
if (user.weekStartDay) await AsyncStorage.setItem('weekStartDay', user.weekStartDay);
```

**Решение:**
Создать helper функцию `src/shared/utils/storage.ts`:
```typescript
export const syncUserPreferences = async (user: User) => {
  const preferences = [
    { key: 'timezone', value: user.timezone },
    { key: 'locale', value: user.locale },
    { key: 'weekStartDay', value: user.weekStartDay },
  ];

  await Promise.all(
    preferences
      .filter(p => p.value)
      .map(p => AsyncStorage.setItem(p.key, p.value!))
  );
};
```

---

### [ ] 5. Извлечь дублирующийся код user serialization

**Приоритет:** 🟡 ВАЖНО
**Файлы:** `server/routes/auth.js` (4 дубликата в register, login, getMe, updateMe)
**Проблема:**
- Повторяющийся код преобразования snake_case → camelCase:
```javascript
// Дублируется 4 раза
{
  id: user.id,
  email: user.email,
  firstName: user.first_name,
  lastName: user.last_name,
  timezone: user.timezone,
  locale: user.locale,
  weekStartDay: user.week_start_day,
  notificationsEnabled: user.notifications_enabled,
  emailNotifications: user.email_notifications
}
```

**Решение:**
Создать helper функцию `server/utils/userSerializer.js`:
```javascript
function serializeUser(dbUser) {
  return {
    id: dbUser.id,
    email: dbUser.email,
    firstName: dbUser.first_name,
    lastName: dbUser.last_name,
    timezone: dbUser.timezone,
    locale: dbUser.locale,
    weekStartDay: dbUser.week_start_day,
    notificationsEnabled: dbUser.notifications_enabled,
    emailNotifications: dbUser.email_notifications
  };
}
```

---

## 🟢 Улучшения UX/UI

### [ ] 6. Добавить accessibility labels/roles/hints

**Приоритет:** 🟢 УЛУЧШЕНИЕ
**Файлы:** Все интерактивные компоненты
**Проблема:**
- Отсутствуют `accessibilityLabel`, `accessibilityRole`, `accessibilityHint`
- Screen reader пользователи не понимают назначение элементов

**Решение:**
Пример для ProfileScreen:
```typescript
<TouchableOpacity
  style={styles.settingItem}
  onPress={() => setWeekStartModalVisible(true)}
  accessibilityRole="button"
  accessibilityLabel={t.profile.weekStart}
  accessibilityHint="Выберите день начала недели: понедельник или воскресенье"
  accessibilityValue={{ text: getCurrentWeekStartLabel() }}
>
  {/* ... */}
</TouchableOpacity>
```

**Компоненты для обновления:**
- ProfileScreen (settings, modals)
- WeeklyCalendar (day cells)
- CalendarMonth (day cells)
- GlassButton
- CreateRehearsalModal
- ProjectCard
- Все TouchableOpacity/Pressable компоненты

---

### [ ] 7. Исправить цветовой контраст text.tertiary

**Приоритет:** 🟢 УЛУЧШЕНИЕ
**Файл:** `src/shared/constants/colors.ts:18`
**Проблема:**
- `text.tertiary: '#6e7681'` имеет контраст 3.2:1 с фоном
- Не соответствует WCAG AA (требуется 4.5:1)

**Решение:**
```typescript
export const Colors = {
  text: {
    primary: '#e6edf3',
    secondary: '#9198a1',
    tertiary: '#7d8590', // Было: #6e7681 (контраст 4.8:1 ✅)
    inverse: '#0d1117',
  },
  // ...
};
```

---

### [ ] 8. Добавить haptic feedback во все touch interactions

**Приоритет:** 🟢 УЛУЧШЕНИЕ
**Файлы:** Все компоненты с TouchableOpacity/Pressable
**Проблема:**
- Haptic feedback есть только в 3 компонентах
- Отсутствует тактильный отклик при большинстве действий

**Решение:**
Создать утилиту `src/shared/utils/haptics.ts`:
```typescript
import * as Haptics from 'expo-haptics';

export const hapticLight = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export const hapticMedium = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
};

export const hapticSuccess = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};
```

Использовать в компонентах:
```typescript
import { hapticLight } from '../../shared/utils/haptics';

<TouchableOpacity onPress={() => {
  hapticLight();
  setWeekStartModalVisible(true);
}}>
```

**Компоненты:**
- ProfileScreen (все кнопки и селекторы)
- WeeklyCalendar (выбор дня)
- CalendarMonth (выбор дня)
- ProjectCard (нажатие на карточку)
- CreateRehearsalModal (кнопки)

---

### [ ] 9. Добавить skeleton screens для loading states

**Приоритет:** 🟢 УЛУЧШЕНИЕ
**Файлы:** CalendarScreen, ProjectsScreen, ProfileScreen
**Проблема:**
- Белый экран при загрузке данных
- Плохой perceived performance

**Решение:**
Создать компонент `src/shared/components/SkeletonLoader.tsx`:
```typescript
export const SkeletonCalendar = () => {
  // Skeleton для календаря
};

export const SkeletonProjectCard = () => {
  // Skeleton для карточки проекта
};
```

Использовать:
```typescript
{loading ? <SkeletonCalendar /> : <WeeklyCalendar />}
```

---

### [ ] 10. Добавить pull-to-refresh

**Приоритет:** 🟢 УЛУЧШЕНИЕ
**Файлы:** CalendarScreen, ProjectsScreen
**Проблема:**
- Нет способа обновить данные кроме перезапуска приложения

**Решение:**
```typescript
import { RefreshControl } from 'react-native';

<ScrollView
  refreshControl={
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={Colors.accent.purple}
    />
  }
>
```

---

### [ ] 11. Реализовать полный glassmorphism с BlurView

**Приоритет:** 🟢 УЛУЧШЕНИЕ
**Файл:** `src/shared/components/GlassButton.tsx`
**Проблема:**
- Сейчас только transparency, нет blur эффекта
- Не настоящий glassmorphism

**Решение:**
```typescript
import { BlurView } from 'expo-blur';

const GlassButton = ({ title, onPress, variant = 'glass' }) => {
  if (variant === 'glass') {
    return (
      <BlurView intensity={20} tint="dark" style={styles.glassContainer}>
        <TouchableOpacity onPress={onPress}>
          <Text>{title}</Text>
        </TouchableOpacity>
      </BlurView>
    );
  }
  // ...
};
```

---

## 🔵 Новые фичи (Quick Wins)

### [ ] 12. Recurring rehearsals (Повторяющиеся репетиции)

**Приоритет:** 🔵 QUICK WIN
**Описание:**
- Возможность создать репетицию с повторением (ежедневно/еженедельно/ежемесячно)
- Pattern: "Каждый понедельник в 19:00"

**Файлы для изменения:**
- `server/database/schema-native.sql` - добавить таблицу recurrence_rules
- `server/routes/rehearsals.js` - обработка создания recurring events
- `src/features/rehearsals/components/CreateRehearsalModal.tsx` - UI для выбора recurrence
- Migration: `add-recurring-rehearsals.sql`

**DB Schema:**
```sql
CREATE TABLE recurrence_rules (
  id SERIAL PRIMARY KEY,
  rehearsal_id INTEGER REFERENCES rehearsals(id) ON DELETE CASCADE,
  frequency VARCHAR(20) CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  interval INTEGER DEFAULT 1,
  until_date TIMESTAMPTZ,
  count INTEGER
);
```

---

### [ ] 13. Copy/Duplicate rehearsal

**Приоритет:** 🔵 QUICK WIN
**Описание:**
- Кнопка "Дублировать" в деталях репетиции
- Копирует все данные, меняет только дату/время

**Файлы для изменения:**
- `src/features/rehearsals/screens/RehearsalDetailsScreen.tsx` - добавить кнопку
- `server/routes/rehearsals.js` - эндпоинт `POST /rehearsals/:id/duplicate`

---

### [ ] 14. Smart notifications (за 2 часа до репетиции)

**Приоритет:** 🔵 QUICK WIN
**Описание:**
- Автоматическое напоминание за 2 часа до репетиции
- Настраиваемое время (30 мин / 1 час / 2 часа)

**Файлы для изменения:**
- `server/utils/notifications.js` - логика отправки
- `server/jobs/rehearsalReminders.js` - cron job (node-cron)
- `src/features/profile/screens/ProfileScreen.tsx` - настройка времени напоминания

**Технологии:**
- `expo-notifications` для пушей
- `node-cron` для scheduled tasks

---

## 🔵 Новые фичи (High Priority)

### [ ] 15. Attendance tracking (Кто придёт/не придёт)

**Приоритет:** 🔵 HIGH PRIORITY
**Описание:**
- Статистика: кто подтвердил/отклонил/не ответил
- Показывать процент явки

**DB Schema:**
```sql
ALTER TABLE rehearsal_responses
ADD COLUMN attended BOOLEAN DEFAULT NULL;
-- NULL = не указано, TRUE = пришёл, FALSE = не пришёл
```

**Файлы для изменения:**
- Migration: `add-attendance-tracking.sql`
- `server/routes/rehearsals.js` - эндпоинт для отметки attendance
- `src/features/rehearsals/screens/RehearsalDetailsScreen.tsx` - UI для статистики

---

### [ ] 16. Rehearsal notes (Заметки к репетиции)

**Приоритет:** 🔵 HIGH PRIORITY
**Описание:**
- Поле для заметок к репетиции (что репетировали, что получилось/не получилось)
- История заметок

**DB Schema:**
```sql
CREATE TABLE rehearsal_notes (
  id SERIAL PRIMARY KEY,
  rehearsal_id INTEGER REFERENCES rehearsals(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES native_users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Файлы для изменения:**
- Migration: `add-rehearsal-notes.sql`
- `server/routes/rehearsals.js` - CRUD для notes
- `src/features/rehearsals/screens/RehearsalDetailsScreen.tsx` - UI для заметок

---

## 📊 Прогресс

**Всего задач:** 16
**Выполнено:** 0
**В процессе:** 0
**Осталось:** 16

### По приоритетам:
- 🔴 Критичные: 1/1
- 🟡 Важные: 4/4
- 🟢 Улучшения: 6/6
- 🔵 Фичи: 5/5

---

## 🎯 Рекомендуемый порядок выполнения

**Неделя 1 (Критичное + Важное):**
1. ✅ SQL injection fix
2. ✅ useCallback в AuthContext
3. ✅ useCallback в I18nContext
4. ✅ Рефакторинг AsyncStorage sync
5. ✅ Рефакторинг user serialization

**Неделя 2 (UX/UI):**
6. Accessibility labels
7. Color contrast fix
8. Haptic feedback
9. Skeleton screens
10. Pull-to-refresh
11. Glassmorphism

**Неделя 3 (Quick Wins):**
12. Recurring rehearsals
13. Copy/duplicate
14. Smart notifications

**Месяц 2 (Major Features):**
15. Attendance tracking
16. Rehearsal notes

---

## 📝 Примечания

- **Git workflow:** Делаем отдельный коммит для каждой задачи
- **Testing:** Тестировать на реальном устройстве iOS после каждого изменения UI
- **Code review:** Можно запрашивать код-ревью у агента после завершения блока задач
- **Documentation:** Обновлять DB_SCHEMA.md при изменениях в БД

---

**Последнее обновление:** 2026-01-02
**Версия чек-листа:** 1.0
