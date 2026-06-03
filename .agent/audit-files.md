# Аудит мёртвых файлов

## Безопасно удалить (нет импортов нигде):

### Frontend компоненты:
- `src/shared/components/animations/AnimatedListItem.tsx` — компонент с анимацией списка, экспортируется из index но не используется нигде в коде
- `src/shared/components/animations/FadeInView.tsx` — компонент с fade-in анимацией, экспортируется из index но не используется нигде
- `src/shared/components/CreateActionSheet.tsx` — компонент action sheet, использован в navigation/index.tsx, но функциональность реализована через ActionSheetWrapper, сам компонент можно рассмотреть (ИСПОЛЬЗУЕТСЯ - оставить)
- `src/features/calendar/components/ParticipantsModal.tsx` — модальное окно участников, только в тестах, нет реальных импортов
- `src/features/calendar/components/TimeRecommendations.tsx` — рекомендации времени, используется в AddRehearsalScreen (ИСПОЛЬЗУЕТСЯ - оставить)
- `src/features/subscriptions/components/PaymentCard.tsx` — компонент карты платежа, только в SubscriptionManagement.tsx при специфических условиях
- `src/features/availability/components/calendar/CalendarLegend.tsx` — легенда календаря, экспортируется из index но не используется в AvailabilityScreen
- `src/features/availability/components/editor/PastDateWarning.tsx` — предупреждение о прошедших датах, экспортируется из index но не используется в AvailabilityScreen

### Backend:
Нет явно неиспользуемых файлов в server - все модули подключены в server.js или используются в routes.

## Под вопросом (используется но подозрительно):

### Frontend:
- `src/features/subscriptions/templates/allpayHostedFields.ts` — шаблон AllPay для WebView, подготовлен но может быть не активирован в текущей версии
- `src/features/subscriptions/utils/allpayWebViewHandler.ts` — обработчик сообщений от AllPay, привязан к предыдущему файлу
- `src/features/subscriptions/components/SubscriptionManagement.tsx` — компонент управления подписками, используется но может быть в неправильном потоке (PaymentCard вложена внутри)
- `src/shared/services/calendar/permissions.ts` — сервис проверки прав доступа, используется в нескольких местах но не очень активно

### Navigation:
- `src/features/smart-planner/screens/SmartPlannerTabScreen.tsx` — вкладка планировщика, используется в PlannerNavigator но функциональность может быть дублирована с SmartPlannerScreen

## Одноразовые скрипты:

- `rehearsal-calendar-native/scripts/check-secrets.sh` — скрипт проверки secrets, стандартный для CI/CD

## Документация (проверить актуальность):

- `docs/api-documentation.md` (42KB) — подробная документация API, выглядит актуальной
- `docs/api-standards.md` — стандарты API
- `docs/recurring-billing.md` — документация по повторяющимся платежам (актуально для AllPay)
- `docs/quick-reference.md` — краткая справка
- `docs/README.md` — главный readme для docs
- `CLAUDE.md` (26KB) — большая документация по проекту, выглядит актуальной
- `GOOGLE_OAUTH_SETUP.md` — документация по OAuth setup

## Важные компоненты (активно используются):

### Основные экраны:
- Calendar, Projects, Profile, Smart Planner - все активны в навигации
- Auth screens (Login, Register) - используются в AuthNavigator
- Onboarding screens - используются в OnboardingNavigator

### Shared компоненты:
- GlassButton - используется в 9 файлах
- SkeletonLoader - используется в 5 файлах
- UserAvatar - используется в 5 файлах
- DateRangePicker - используется в SmartPlannerScreen и тестах
- FloatingActionButton - используется в ProjectsScreen
- PickerModal - используется в AddRehearsalScreen

### Сервисы:
- api.ts - основной API сервис
- googleAuth.ts - используется в LoginScreen
- notifications.ts - используется в нескольких местах
- calendar services (import/export/management) - активно используются

### Utils:
- haptics.ts - используется в 20+ файлах
- time.ts - используется для работы с временем
- storage.ts - работа с локальным хранилищем
- availability.ts - утилиты доступности
- calendarStorage.ts - хранение данных календаря

## Рекомендации:

1. **Удалить явно**:
   - `src/shared/components/animations/AnimatedListItem.tsx` - имеет использование, но может быть удален
   - `src/shared/components/animations/FadeInView.tsx` - имеет использование, но может быть удален
   - `src/features/availability/components/calendar/CalendarLegend.tsx` - точно не используется
   - `src/features/availability/components/editor/PastDateWarning.tsx` - точно не используется
   - `src/features/calendar/components/ParticipantsModal.tsx` - только в тестах

2. **Проверить и потенциально удалить**:
   - AllPay интеграция (allpayHostedFields.ts и allpayWebViewHandler.ts) - если платежи реализованы другим способом
   - `src/features/subscriptions/components/PaymentCard.tsx` - если вложенный в SubscriptionManagement

3. **Backend состояние**:
   - Все файлы сервера активно используются
   - Middleware (adminAuth, subscriptionMiddleware, jwtMiddleware) все используются
   - Все routes подключены в server.js или использованы в других routes

4. **Документация**:
   - Нет явно устаревшей документации
   - API документация выглядит актуальной
   - CLAUDE.md и GOOGLE_OAUTH_SETUP.md имеют формат последних обновлений

