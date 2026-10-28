# Участок G: регистрация push и клиентский lifecycle уведомлений

Статус: готов для указанного покрытия. Завершено 2026-09-10 после прерывания. Только чтение исходников; тесты, приложение, SDK, push/API запросы не запускались.

Пути ниже от `rehearsal-calendar-native/`.

## GC01 — Medium — «Позже» в onboarding не откладывает системный запрос уведомлений

**Код:** `src/features/onboarding/screens/NotificationsScreen.tsx:55` задаёт `secondaryAction={{ title: t.onboarding.notifications.later, onPress: goOn }}`, а `28` только переключает на WeekStart. Завершение/skip onboarding в `src/features/onboarding/hooks/useOnboarding.ts:15` пишет только `{ onboardingCompleted: true }`, не сохраняет решение о push. В основном navigator после onboarding монтируется NotificationsHandler (`src/navigation/index.tsx:274,402-407`), который запускает `useNotifications` (`167-168`). Hook (`src/shared/hooks/useNotifications.ts:31-33`) выполняет:

```ts
if (user && user.notificationsEnabled) {
  registerForPushNotifications()
}
```

Регистрация (`src/shared/services/notifications.ts:47-52`) при отсутствии разрешения вызывает `Notifications.requestPermissionsAsync()`. Начальное notifications_enabled=true подтверждено base schema `server/database/init-native-schema.sql:49`; source schema была прочитана root в F.

**Сценарий:** новый пользователь с default-enabled account нажимает «Позже» вместо Allow, заканчивает оставшиеся шаги. Сразу при открытии основного экрана получает системный prompt, хотя выбрал отложить. То же возможно при Skip onboarding. Это противоречит комментарию notifications onboarding (`18-21`): запрос должен расходовать системное разрешение только после осознанного действия на объясняющем экране.

**Последствие:** проигнорированное решение пользователя, случайный отказ в разрешении и невозможность повторного стандартного prompt на iOS без перехода в Settings.

**Минимум:** при background mount вызывать только `syncPushTokenIfGranted`, оставить requestPermissions только explicit Allow/profile toggle (1–2 часа; устраняет неожиданный prompt, пользователю надо явно включить позже). **Правильно:** отдельно хранить account preference, OS permission и device registration state/отложенное решение; показывать явное действие повторной настройки (0.5–1 дня; одинаковая логика onboarding/profile/restore, больше состояний UI).

## GC02 — Medium — Profile сообщает успешное включение push при отказе OS или backend

**Код:** `src/features/profile/screens/ProfileScreen.tsx:53-66` сначала ставит local switch=true, сохраняет `{notificationsEnabled:true}`, затем `await registerForPushNotifications()` и безусловно `hapticSuccess()`. Возвращаемое значение не проверяется. Service возвращает null при denied permission (`notifications.ts:55-58`), неподдерживаемом устройстве (`41-44`) и любом exception (`91-94`):

```ts
} catch (error) {
  console.error('[Notifications] Registration error:', error);
  return null;
}
```

**Сценарий:** пользователь включает switch в Profile; OS permission уже denied либо POST регистрации токена завершается network/5xx ошибкой. Helper не бросает исключение, внешний catch Profile не срабатывает, switch остаётся включённым и показана успешная haptic обратная связь. Но устройство не получает push. Аналогично onboarding всегда идёт дальше после null, там отказ может быть нормальным ответом, однако техническая ошибка отдельно не объясняется.

**Последствие:** пользователь рассчитывает на напоминания на этом устройстве, хотя регистрация/разрешение не получены. Это рассогласование device delivery и отображаемого состояния, не доказанный обход server preference.

**Минимум:** проверять registration result, при null показывать различимое объяснение permission/registration failure и действие Settings/retry, не обозначать device setup успешным (2–4 часа; сохраняет global preference, но текущего string|null недостаточно для хорошего текста). **Правильно:** discriminated result granted+registered / denied / unsupported / transient-error и UI отдельных account/device состояний (0.5–1 дня; корректно для нескольких устройств, потребуется адаптация onboarding и profile).

## GC03 — Medium — Временная ошибка регистрации при запуске не повторяется после восстановления связи

**Код:** `src/contexts/AuthContext.tsx:154-157`:

```ts
if (hasPushSynced.current) return;
hasPushSynced.current = true;
syncPushTokenIfGranted()
```

Flag остаётся true после helper null/failure (`src/shared/services/notifications.ts:133-137`). Второй путь регистрации в useNotifications зависит от `[user, refresh, markRead]` (`149`), не от состояния подключения. AppState listener (`128-129`) при `active` обновляет только unread count, регистрации повторно не вызывает. Сервисы не ставят retry/backoff.

**Сценарий:** после logout backend token был удалён; следующий login проходит, но оба параллельных token-registration запроса попадают в кратковременный server/network сбой. Связь возвращается, приложение остаётся в этой сессии и неоднократно уходит в background/возвращается. Backend token остаётся незарегистрированным до нового mount/изменения user или ручного переключения настройки. 30-секундный timeout запроса (`api.ts:198-202`) уменьшает вероятность холодного старта, но не исправляет окончательный сбой.

**Последствие:** длительное молчаливое отсутствие уведомлений после короткой сетевой ошибки, хотя другие функции приложения уже работают.

**Минимум:** считать synced только после token success; делать ограниченный no-prompt retry на foreground при enabled+granted (2–4 часа; просто, требует защиты от дублирующихся запросов). **Правильно:** единый per-session/per-device registration coordinator с single-flight, backoff, connectivity/foreground recovery, session generation и удалением токена при logout (0.5–1 дня; закрывает retry и гонки, больше lifecycle проверки).

## Стыки и наблюдения без дополнительного счёта

1. **FC01 token ownership A→B:** `@push_token` — один общий device key (`notifications.ts:13,76,130,147`); регистрации из AuthProvider и useNotifications запускаются независимо, без captured account/session generation/cancellation. Logout сначала unregister (`AuthContext:352`), но service удаляет только если local key уже есть (`notifications:147-154`), а ошибка лишь логируется (`158-160`). Если pending register ещё не записал key, logout не знает токен. Если unregister не прошёл, logout продолжает local cleanup (`AuthContext:355-375`), а старый device token может остаться связанным с A. Server unique/ownership и доставка A на устройство B уже считаются FC01, здесь только подтверждён consumer. Глобальный корректный takeover на сервере необходим независимо от client guards.
2. **Preference и permission:** `syncPushTokenIfGranted` проверяет только physical-device+OS permission (`112,118-119`), не notificationsEnabled. Само наличие зарегистрированного токена при account preference=false не объявлено багом без проверки server filtering; root аудирует фактические senders. Foreground display handler `notifications:21-28` всегда разрешает banner/sound/badge полученного notification; account scoping payload/подавление старых уведомлений тоже зависит от server FC01 и session lifecycle.
3. **Логи/PII:** `notifications.ts:66` печатает Expo push token, `useNotifications.ts:36` повторяет token; `47,75` логируют полные notification/response objects, включая title/body/data. Ошибки registration/unregistration логируются целиком (`notifications:92,136,159`), AxiosError может содержать Authorization в config. Эти прямые console без production guard переданы общему security/logging sweep; существующую AC04 credential logging finding повторно не считать. Эксплуатация/внешний log collector не подтверждены.
4. **Launch/live double handling — гипотеза для ручной проверки:** listener (`useNotifications:74-84`) не ставит `handledLaunchResponse.current` и не дедуплицирует response ID. getLast branch (`99-107`) имеет только одноразовый boolean, не сравнивает с уже обработанным live response и не очищает response SDK. Если initial getLast вернул null, live tap обработался позже, а затем user update перезапустил effect, тот же tap может быть обработан ещё раз. Дедуп по request identifier + единый обработчик решает класс проблемы, но фактическое поведение SDK/navigation в таком порядке здесь не запускалось; отдельная finding не начислена.
5. **Stale-account launch response — гипотеза:** async getLast completion не проверяет, актуален ли user после logout/account switch; ref сбрасывается при remount handler. Notification data не включает/не сверяет recipient в клиенте. Возможен переход к старому объекту предыдущего аккаунта/лишний markRead, но server auth boundary и navigation reset требуют проверки H. Не объявлено раскрытие серверных данных без проверки авторизации.
6. **Маршруты от notification:** handleNotificationNavigation (`185-221`) отправляет rehearsal_created/updated/reminders/member_response в RehearsalDetails по id, deleted в project, membership/project events в список projects. No ID→project fallback задан явно; shape/types server payload сверяет root. Полный navigator/deep-link аудит отложен до H, здесь прочитаны только места mounting и onboarding boundary.
7. **Локальные notifications:** в прочитанном production service/hook нет scheduleNotificationAsync/cancel calls, только remote push listeners и foreground display. Эти функции есть в mock (`17-19`), что не доказывает наличие production local scheduling. Возможные дубли remote push + calendar event alarms относятся к E export и server G senders; отдельный новый вывод здесь не делался.
8. **Android channel — ручная проверка:** channel создаётся только в interactive registration **после** getExpoPushTokenAsync и backend register (`notifications:60-86`), no-prompt sync его не создаёт. Нужно проверить первое включение на Android 13+ и server channelId соответствие `rehearsal-notifications`; вывод о конкретном SDK bug статически не утверждается.

## Покрытие

Полностью прочитаны:
- `src/shared/services/notifications.ts` (162 строки);
- `src/shared/hooks/useNotifications.ts` (222);
- `src/features/onboarding/screens/NotificationsScreen.tsx` (98);
- `src/features/onboarding/hooks/useOnboarding.ts` (43), только сценарий завершения/отложенного prompt оценивался здесь;
- `src/__tests__/__mocks__/expo-notifications.js` (27).

По стыку прочитаны выбранные фрагменты (не заявляется полный аудит этих файлов): AuthContext push effect/timezone effect `139-191`, logout `344-381`; ProfileScreen preference/toggle `35-85`; api push-token methods `190-206`; navigation NotificationsHandler `166-169`, mount `262-277`, authenticated/onboarding branch `390-409`. AuthContext целиком уже прочитан в A; Profile/navigation остальные сценарии запланированы на H.

Поиск `useNotifications|syncPushTokenIfGranted|registerForPushNotifications|getLastNotificationResponse` в src test/spec файлах не обнаружил прямых тестов этих путей. Именованных notification/onboarding/push tests в найденном дереве src нет, кроме mock. Никакого измеренного test coverage не заявляется. Mock не содержит `getLastNotificationResponseAsync`, не моделирует delivery/listener callbacks, denial, account switching и token failures: его назначение по комментарию `3-6` — только заглушить SDK для других тестов.

## Что проверить вручную после исправлений

Onboarding Later/Skip без OS prompt; Profile enabling с denied permission и backend timeout; восстановление регистрации после network failure без перезапуска; logout/login A→B с переставленными ответами register/unregister; cold-start/live notification tap без двойного открытия; notification tap после account switch; Android первый channel/permission flow. Пользователь запретил запуски в аудите — ни один сценарий здесь не выполнялся.
