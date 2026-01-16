# Руководство по локализации / Localization Guide

**Last Updated:** December 24, 2024

## 📋 Обзор / Overview

Приложение Rehearsal Calendar поддерживает многоязычность через систему i18n.
The Rehearsal Calendar app supports multi-language functionality through the i18n system.

**Поддерживаемые языки / Supported Languages:**
- 🇷🇺 Русский (Russian) - `ru`
- 🇬🇧 Английский (English) - `en`

**Recent Changes:**
- ✅ Removed outdated 3-state RSVP translations (rsvpConfirmed, rsvpDeclined, rsvpPending, willAttend, wontAttend, etc.)
- ✅ Migrated to Telegram-style like system (binary: liked or not liked)
- ✅ Simplified response UI - no complex RSVP status translations needed

---

## 🚀 Быстрый старт / Quick Start

### 1. Использование переводов в компонентах / Using translations in components

```typescript
import { useI18n } from '../../../contexts/I18nContext';

export default function MyComponent() {
  const { t, language, setLanguage } = useI18n();

  return (
    <View>
      <Text>{t.common.save}</Text>
      <Text>{t.auth.loginButton}</Text>
      <Text>{t.projects.title}</Text>
    </View>
  );
}
```

### 2. Переключение языка / Switching language

```typescript
const { language, setLanguage } = useI18n();

// Switch to English
setLanguage('en');

// Switch to Russian
setLanguage('ru');
```

---

## 📁 Структура файлов / File Structure

```
src/
├── i18n/
│   └── translations.ts          # Все переводы
├── contexts/
│   └── I18nContext.tsx          # Контекст локализации
└── features/
    └── [feature]/
        └── screens/
            └── [Screen].tsx     # Используют useI18n()
```

---

## 📝 Структура переводов / Translation Structure

Файл [src/i18n/translations.ts](src/i18n/translations.ts) содержит все переводы, разделенные по категориям:

### Доступные категории / Available Categories:

#### `common` - Общие фразы
- `save`, `cancel`, `delete`, `add`, `edit`, `close`
- `today`, `loading`, `error`, `noData`
- `apply`, `or`, `selectAll`, `clear`, `change`

#### `auth` - Авторизация и регистрация
- `login`, `register`, `email`, `password`, `firstName`, `lastName`
- `loginButton`, `registerButton`, `createAccount`
- `loginWithTelegram`, `registerWithTelegram`
- Валидация: `fillAllFields`, `invalidEmail`, `passwordMinLength`, `passwordsMismatch`

#### `calendar` - Календарь
- `title`, `rehearsalsFor`, `noRehearsals`, `myRehearsals`
- `allProjects`, `filterByProject`, `upcomingEvents`

#### `projects` - Проекты
- `title`, `noProjects`, `createFirst`, `admin`
- `createProject`, `projectName`, `projectDescription`
- `inviteLink`, `copyLink`, `linkCopied`

#### `rehearsals` - Репетиции
- `addRehearsal`, `editRehearsal`, `location`, `project`
- `startTime`, `endTime`, `selectDate`, `selectStartTime`, `selectEndTime`
- `creating`, `created`, `createError`
- `deleteConfirm`, `deleteTitle`, `deleteMessage`
- **Like System** (Telegram-style): Binary like system - no RSVP translations needed
  - Like/unlike handled via heart icon with optimistic updates and haptic feedback
  - Stats shown as "confirmed" (liked) and "invited" (no response)

#### `smartPlanner` - Умный планировщик
- `title`, `period`, `members`, `recommendations`
- `week`, `twoWeeks`, `month`, `custom`
- `perfect`, `good`, `possible`, `difficult`
- `available`, `busy`, `allDay`, `addButton`

#### `profile` - Профиль
- `title`, `settings`, `notifications`, `language`
- `theme`, `themeDark`, `themeLight`
- `availability`, `about`, `version`, `help`, `logout`

#### `days` - Дни недели
- Полные: `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, `sunday`
- Короткие: `days.short.monday`, `days.short.tuesday`, etc.

#### `months` - Месяцы
- Массив месяцев: `t.months[0]` - `t.months[11]`

---

## 🔧 Примеры использования / Usage Examples

### Пример 1: LoginScreen ✅ (Уже готов / Already Done)

```typescript
import { useI18n } from '../../../contexts/I18nContext';

export default function LoginScreen({ navigation }) {
  const { t } = useI18n();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t.common.error, t.auth.fillAllFields);
      return;
    }

    try {
      await login(email, password);
    } catch (err) {
      Alert.alert(t.auth.loginError, err.message);
    }
  };

  return (
    <View>
      <Text>{t.auth.loginTitle}</Text>
      <Text>{t.auth.loginSubtitle}</Text>

      <TextInput placeholder={t.auth.emailPlaceholder} />
      <TextInput placeholder={t.auth.passwordPlaceholder} />

      <Button title={t.auth.loginButton} onPress={handleLogin} />
      <Button title={t.auth.createAccount} onPress={goToRegister} />
    </View>
  );
}
```

### Пример 2: ProjectsScreen (Требует обновления / Needs Update)

**До / Before:**
```typescript
<Text style={styles.title}>Мои проекты</Text>
<Text style={styles.emptyTitle}>Нет проектов</Text>
<Text style={styles.loadingText}>Загрузка проектов...</Text>
```

**После / After:**
```typescript
import { useI18n } from '../../../contexts/I18nContext';

const { t } = useI18n();

<Text style={styles.title}>{t.projects.title}</Text>
<Text style={styles.emptyTitle}>{t.projects.noProjects}</Text>
<Text style={styles.loadingText}>{t.projects.loading}</Text>
```

### Пример 3: Smart Planner (Требует обновления / Needs Update)

**До / Before:**
```typescript
<Text>Smart Planner</Text>
<Text>Период</Text>
<Text>Участники</Text>
<Text>Неделя</Text>
<Text>Месяц</Text>
```

**После / After:**
```typescript
import { useI18n } from '../../../contexts/I18nContext';

const { t } = useI18n();

<Text>{t.smartPlanner.title}</Text>
<Text>{t.smartPlanner.period}</Text>
<Text>{t.smartPlanner.members}</Text>
<Text>{t.smartPlanner.week}</Text>
<Text>{t.smartPlanner.month}</Text>
```

---

## ✅ Что уже сделано / What's Already Done

1. ✅ **Создана система i18n** - [src/i18n/translations.ts](src/i18n/translations.ts)
2. ✅ **Создан контекст I18nContext** - [src/contexts/I18nContext.tsx](src/contexts/I18nContext.tsx)
3. ✅ **Добавлен I18nProvider в App.tsx** - обёртка для всего приложения
4. ✅ **Полные переводы для всех экранов** - русский и английский
5. ✅ **Обновлён LoginScreen** - работает как пример
6. ✅ **Like System Migration (December 24, 2024)** - Removed outdated RSVP translations
   - Deleted: rsvpConfirmed, rsvpDeclined, rsvpPending
   - Deleted: willAttend, wontAttend, confirmAttendance, declineAttendance
   - Simplified to Telegram-style like system (heart icon, no text needed)

---

## 📋 Что нужно сделать / TODO

Обновить следующие файлы для использования `useI18n()`:

### Auth (Авторизация)
- [ ] [src/features/auth/screens/RegisterScreen.tsx](src/features/auth/screens/RegisterScreen.tsx)
- [ ] [src/features/auth/components/TelegramLoginButton.tsx](src/features/auth/components/TelegramLoginButton.tsx)

### Calendar (Календарь)
- [ ] [src/features/calendar/screens/CalendarScreen.tsx](src/features/calendar/screens/CalendarScreen.tsx)
- [ ] [src/features/calendar/screens/AddRehearsalScreen.tsx](src/features/calendar/screens/AddRehearsalScreen.tsx)
- [ ] [src/features/calendar/components/TodayRehearsals.tsx](src/features/calendar/components/TodayRehearsals.tsx)
- [ ] [src/features/calendar/components/MyRehearsalsModal.tsx](src/features/calendar/components/MyRehearsalsModal.tsx)
- [ ] [src/features/calendar/components/DayDetailsModal.tsx](src/features/calendar/components/DayDetailsModal.tsx)

### Projects (Проекты)
- [ ] [src/features/projects/screens/ProjectsScreen.tsx](src/features/projects/screens/ProjectsScreen.tsx)
- [ ] [src/features/projects/screens/CreateProjectScreen.tsx](src/features/projects/screens/CreateProjectScreen.tsx)
- [ ] [src/features/projects/screens/JoinProjectScreen.tsx](src/features/projects/screens/JoinProjectScreen.tsx)

### Smart Planner (Умный планировщик)
- [ ] [src/features/smart-planner/screens/SmartPlannerScreen.tsx](src/features/smart-planner/screens/SmartPlannerScreen.tsx)
- [ ] [src/features/smart-planner/components/DayCard.tsx](src/features/smart-planner/components/DayCard.tsx)
- [ ] [src/features/smart-planner/components/SlotItem.tsx](src/features/smart-planner/components/SlotItem.tsx)
- [ ] [src/features/smart-planner/components/MemberFilter.tsx](src/features/smart-planner/components/MemberFilter.tsx)

### Profile (Профиль)
- [ ] [src/features/profile/screens/ProfileScreen.tsx](src/features/profile/screens/ProfileScreen.tsx)

---

## 🎨 Добавление новых переводов / Adding New Translations

### 1. Обновите интерфейс Translations

```typescript
// src/i18n/translations.ts

export interface Translations {
  // ...existing categories
  myNewCategory: {
    myNewKey: string;
    anotherKey: string;
  };
}
```

### 2. Добавьте переводы для обоих языков

```typescript
// Русский
export const ru: Translations = {
  // ...existing translations
  myNewCategory: {
    myNewKey: 'Мой новый текст',
    anotherKey: 'Другой текст',
  },
};

// Английский
export const en: Translations = {
  // ...existing translations
  myNewCategory: {
    myNewKey: 'My new text',
    anotherKey: 'Another text',
  },
};
```

### 3. Используйте в компонентах

```typescript
const { t } = useI18n();
<Text>{t.myNewCategory.myNewKey}</Text>
```

---

## 🧪 Тестирование / Testing

### Переключение языка в рантайме / Switch Language at Runtime

Добавьте кнопку переключения языка (например, в Profile):

```typescript
import { useI18n } from '../../contexts/I18nContext';

export default function ProfileScreen() {
  const { language, setLanguage } = useI18n();

  const toggleLanguage = () => {
    setLanguage(language === 'ru' ? 'en' : 'ru');
  };

  return (
    <TouchableOpacity onPress={toggleLanguage}>
      <Text>Current: {language === 'ru' ? '🇷🇺 Русский' : '🇬🇧 English'}</Text>
    </TouchableOpacity>
  );
}
```

---

## 💡 Лучшие практики / Best Practices

1. **Всегда используйте `t.category.key`** вместо хардкода строк
2. **Добавляйте переводы сразу для обоих языков** (ru и en)
3. **Используйте короткие, понятные ключи** (`loginButton` вместо `login_button_text`)
4. **Группируйте переводы логически** по экранам/функциям
5. **Не забывайте про Alert.alert()** - тоже нужно переводить!

---

## 🐛 Troubleshooting

### Ошибка: "Cannot read property 'title' of undefined"

**Причина:** Используете несуществующий ключ перевода
**Решение:** Проверьте, что ключ добавлен в interface Translations и в обоих ru/en объектах

### Текст не меняется при смене языка

**Причина:** Компонент не использует hook useI18n
**Решение:** Добавьте `const { t } = useI18n()` в компонент

### TypeScript ошибки при доступе к t.category.key

**Причина:** Ключ не добавлен в interface Translations
**Решение:** Добавьте ключ в interface и реализации ru/en

---

## 📚 Ресурсы / Resources

- **Translations файл:** [src/i18n/translations.ts](src/i18n/translations.ts)
- **I18n Context:** [src/contexts/I18nContext.tsx](src/contexts/I18nContext.tsx)
- **Пример (LoginScreen):** [src/features/auth/screens/LoginScreen.tsx](src/features/auth/screens/LoginScreen.tsx)

---

**Готово к использованию! / Ready to use!** 🎉

Локализация настроена и готова к работе. Следуйте примерам выше для обновления остальных компонентов.

---

## 🔄 Recent System Changes (December 24, 2024)

### Like System Migration
The app has migrated from a 3-state RSVP system to a Telegram-style binary like system:

**Old System (Removed):**
- ❌ `rsvpConfirmed` / `rsvpDeclined` / `rsvpPending`
- ❌ `willAttend` / `wontAttend` / `maybeAttend`
- ❌ `confirmAttendance` / `declineAttendance`

**New System (Current):**
- ✅ Binary like system (yes/null)
- ✅ Heart icon with optimistic updates
- ✅ Haptic feedback on interaction
- ✅ Stats: "confirmed" (liked) and "invited" (no response)

**What This Means for Localization:**
- No complex RSVP status translations needed
- Simplified UI text (just counts, no status labels)
- Admin stats show only: "X confirmed, Y invited"
- No need to translate button labels like "Confirm" / "Decline"
