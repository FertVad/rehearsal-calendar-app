# Smart Planner - Спецификация для Native App

## Обзор

Smart Planner анализирует доступность участников проекта и предлагает оптимальные временные слоты для репетиций. В отличие от TG Mini App версии, добавлен **выбор проекта** перед началом анализа.

## Отличия от TG версии

| Функция | TG Mini App | Native App |
|---------|-------------|------------|
| **Выбор проекта** | ❌ Нет (один проект в чате) | ✅ **Автовыбор** последнего проекта где админ |
| **Данные участников** | Все актёры проекта | Все участники выбранного проекта |
| **Навигация** | Web-навигация | React Navigation Stack |
| **Scroll restoration** | sessionStorage | React Navigation state |
| **Доступ** | Отдельная страница | **Кнопка на дашборде** (только для админов) |

## UX Flow

### Упрощённый флоу (один клик)

```
Dashboard (Calendar Screen)
    ↓ [Tap кнопку "Smart Planner"]
    ↓ (автоматически выбирается последний проект где user админ)
    ↓
Smart Planner Screen
    ↓ [Header показывает выбранный проект]
    ↓ [Можно переключить проект через dropdown]
```

**Логика автовыбора проекта:**
1. Получить все проекты где `is_admin === true`
2. Отсортировать по дате последнего обновления (или created_at)
3. Выбрать первый (самый свежий)
4. Если нет админ-проектов → не показывать кнопку

### Smart Planner Screen

Идентичен TG версии, но с добавлением:
- Header показывает выбранный проект
- Использует участников конкретного проекта
- Кнопка "Сменить проект" для возврата к выбору

```
┌─────────────────────────────────────────────┐
│  ← Гамлет                     [Сменить]     │
├─────────────────────────────────────────────┤
│  📅 Период: [На неделю ▼]                   │
│  29 нояб - 5 дек                            │
├─────────────────────────────────────────────┤
│  Категории:                                 │
│  [🟢 Идеально: 12] [🟡 Хорошо: 45]          │
│  [🟠 Норм: 23]     [🔴 Плохо: 8]            │
├─────────────────────────────────────────────┤
│  Участники: [Все ▼]                         │
├─────────────────────────────────────────────┤
│  📆 Понедельник, 29 ноября                  │
│  ┌───────────────────────────────────────┐ │
│  │ 🟢 10:00 - 12:30                      │ │
│  │ 12 из 12 свободны                     │ │
│  └───────────────────────────────────────┘ │
│  ┌───────────────────────────────────────┐ │
│  │ 🟡 14:00 - 16:00                      │ │
│  │ 10 из 12 свободны                     │ │
│  │ Заняты: Иван, Мария                   │ │
│  └───────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

## Типы данных

```typescript
// Категории слотов
export type SlotCategory = 'perfect' | 'good' | 'ok' | 'bad';

// Занятый участник
export interface BusyMember {
  id: string;
  name: string;
  busyRanges: Array<{ start: string; end: string }>;
}

// Временной слот
export interface TimeSlot {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  category: SlotCategory;
  totalMembers: number;
  freeMembers: number;
  busyMembers: BusyMember[];
}

// Фильтры
export interface SmartPlannerFilters {
  projectId: string; // NEW - выбранный проект
  startDate: string;
  endDate: string;
  selectedCategories: SlotCategory[];
  selectedMemberIds: string[];
}

// Пресет периода
export interface PeriodPreset {
  type: 'week' | 'month' | 'custom';
  label: string;
}
```

## Алгоритм работы

### 1. Загрузка данных

```typescript
// Шаг 1: Выбор проекта
const adminProjects = projects.filter(p => p.is_admin);

if (adminProjects.length === 0) {
  // Показать сообщение "Нет проектов с правами админа"
  return;
}

if (adminProjects.length === 1) {
  // Сразу открыть Smart Planner для этого проекта
  navigateToSmartPlanner(adminProjects[0].id);
} else {
  // Показать Project Selector Screen
  navigateToProjectSelector(adminProjects);
}

// Шаг 2: Загрузка участников и доступности
const members = await projectsAPI.getMembers(projectId);
const availability = await availabilityAPI.getProjectAvailability(projectId, startDate, endDate);
const rehearsals = await rehearsalsAPI.getAll(projectId);
```

### 2. Генерация слотов

**Базовый принцип (идентичен TG версии):**
1. Разбить период на интервалы по 30 минут (09:00 - 23:00 по умолчанию)
2. Для каждого дня:
   - Объединить availability + rehearsals = busyRanges для каждого участника
   - Найти непрерывные слоты с одинаковым набором свободных/занятых
   - Категоризировать слот по количеству занятых

**Категоризация:**
- `perfect` (🟢) - 0 занятых
- `good` (🟡) - 1-2 занятых
- `ok` (🟠) - 3-4 занятых
- `bad` (🔴) - 5+ занятых

### 3. Фильтрация

- По категориям (perfect, good, ok, bad)
- По участникам (если выбраны конкретные, показывать только слоты где все они свободны)
- По периоду (неделя / месяц / custom)

## Компонентная структура

```
src/features/smart-planner/
├── screens/
│   ├── ProjectSelectorScreen.tsx      # NEW - выбор проекта
│   └── SmartPlannerScreen.tsx         # Главный экран анализа
│
├── components/
│   ├── ProjectCard.tsx                 # NEW - карточка проекта
│   ├── PeriodSelector.tsx              # Выбор периода
│   ├── CategoryFilters.tsx             # Фильтр по категориям
│   ├── MemberFilter.tsx                # Фильтр по участникам (переименован из ActorFilter)
│   ├── DayCard.tsx                     # Карточка дня со слотами
│   ├── SlotItem.tsx                    # Карточка слота
│   └── EmptyState.tsx                  # Пустое состояние
│
├── utils/
│   ├── slotGenerator.ts                # Генерация слотов
│   ├── availabilityMerger.ts           # Объединение доступности с репетициями
│   └── dateUtils.ts                    # Вспомогательные функции
│
├── hooks/
│   ├── useSmartPlanner.ts              # Основная логика
│   └── useProjectMembers.ts            # NEW - загрузка участников проекта
│
└── types.ts                             # TypeScript типы
```

## Navigation

```typescript
// В AppNavigator добавить:
export type AppStackParamList = {
  // ... existing screens
  SmartPlannerProjectSelector: undefined;
  SmartPlanner: { projectId: string };
}

// Навигация:
navigation.navigate('SmartPlannerProjectSelector');
navigation.navigate('SmartPlanner', { projectId: 'project-123' });
```

## API Requirements

### Необходимые эндпоинты:

1. **GET /api/projects/:projectId/members** - список участников проекта
2. **GET /api/projects/:projectId/availability** - доступность всех участников
   - Query params: `startDate`, `endDate`
   - Response: `{ memberId, date, busyRanges[] }`
3. **GET /api/projects/:projectId/rehearsals** - репетиции проекта (уже есть)

### Формат данных availability:

```json
{
  "availability": [
    {
      "userId": "user-123",
      "firstName": "Иван",
      "lastName": "Петров",
      "dates": [
        {
          "date": "2024-12-04",
          "timeRanges": [
            { "start": "09:00", "end": "12:00", "type": "busy" },
            { "start": "14:00", "end": "18:00", "type": "available" }
          ]
        }
      ]
    }
  ]
}
```

## UI/UX детали

### Category Colors (как в TG версии):
- Perfect (🟢): `#10b981` (green)
- Good (🟡): `#fbbf24` (yellow)
- Ok (🟠): `#f97316` (orange)
- Bad (🔴): `#ef4444` (red)

### Interactions:
- **Tap на слот** → открыть модал с деталями и кнопкой "Создать репетицию"
- **Tap на "Создать репетицию"** → navigate to AddRehearsalScreen с предзаполненными данными:
  - `projectId`
  - `date`
  - `time` (startTime)
  - `endTime`
- **Long press на слот** → показать список занятых участников (если есть)

### Loading States:
- Skeleton для слотов
- Loading indicator при смене фильтров
- Pull-to-refresh для обновления данных

### Empty States:
- "Выберите проект" - если нет админ-ролей
- "Нет доступных слотов" - если все слоты заняты в выбранном периоде
- "Добавьте доступность участникам" - если нет данных о доступности

## Performance Optimization

1. **useMemo** для:
   - Генерации слотов (`generateTimeSlots`)
   - Фильтрации слотов (`filterSlotsByCategory`)
   - Подсчёта категорий (`countSlotsByCategory`)
   - Группировки по датам (`groupSlotsByDate`)

2. **Caching:**
   - Кэшировать интервалы времени по workHours
   - Кэшировать merged availability

3. **Virtualization:**
   - FlatList с `windowSize={5}` для списка дней
   - Limit initial render to 7 days

## Фазы реализации

### Phase 1: Core Functionality
1. ✅ Создать типы (types.ts)
2. ✅ Портировать slotGenerator.ts
3. ✅ Портировать availabilityMerger.ts
4. ✅ Создать ProjectSelectorScreen
5. ✅ Создать SmartPlannerScreen с базовым UI

### Phase 2: Filters & Components
6. ✅ PeriodSelector
7. ✅ CategoryFilters
8. ✅ MemberFilter
9. ✅ SlotItem
10. ✅ DayCard

### Phase 3: Integration
11. ✅ Интеграция с API
12. ✅ Навигация к AddRehearsalScreen
13. ✅ Loading/Empty states

### Phase 4: Polish
14. ⚠️ Анимации и микроинтеракции
15. ⚠️ Accessibility
16. ⚠️ Тестирование

## Следующие шаги

Начать с Phase 1? Или сначала хочешь обсудить/скорректировать спецификацию?
