# Релиз в App Store — пошаговый план

Рабочий runbook для выката Rehearsly в App Store. Отмечай галочками по ходу.

**Состояние на момент написания:** managed workflow (Expo SDK 54), папка `ios/`
гитигнорится и генерируется через `prebuild`. Bundle ID `com.rehearsal.app`,
EAS `projectId` прописан. Платежи намеренно выключены — в приложении нет ни
одного элемента покупки.

---

## Фаза 0. Правки в коде до сборки

| # | Задача | Файл | Статус |
|---|--------|------|--------|
| 0.1 | Вернуть `expo-notifications` из `_disabled_plugins` в `plugins` | `app.json` | ✅ сделано |
| 0.2 | Убрать `<BetaBanner />` и его импорт | `src/navigation/index.tsx` | ✅ сделано (T-008: баннер удалён, «Сообщить об ошибке» — в Профиле) |
| 0.3 | Добавить `ios.buildNumber: "1"` и `android.versionCode: 1` | `app.json` | ✅ сделано |
| 0.5 | **Sign in with Apple** — обязателен по Guideline 4.8 | `LoginScreen.tsx`, `appleAuth.ts` | ✅ сделано |

**0.5 — почему это было блокером.** Guideline 4.8 требует равнозначный
приватный способ входа везде, где предлагается сторонний. На экране входа был
только Google — этого достаточно для отказа на ревью. Бэкенд был готов
(`apple-signin-auth`, `POST /auth/apple`, `loginWithApple`), не хватало нативной
части. Проверено на устройстве: вход связался с существующим аккаунтом по
совпадающей почте, добавив Apple вторым провайдером рядом с Google.

Из четырёх Apple-переменных нужна **только `APPLE_CLIENT_ID`** (= bundle ID):
`apple-signin-auth` сам тянет публичные ключи Apple. `APPLE_TEAM_ID`,
`APPLE_KEY_ID` и `APPLE_PRIVATE_KEY` нужны лишь для server-to-server обмена,
которого у нас нет.

**0.1.** `expo-notifications` стоит в `plugins` в `app.json`. После любой правки
плагинов — `npx expo prebuild --clean`: плагин прописывает `aps-environment` в
entitlements, без этого APNs не поднимется.

---

## Фаза 1. Apple Developer

- [ ] Принять Program License Agreement в [developer.apple.com](https://developer.apple.com/account) (иначе сборки не подпишутся)
- [ ] Заполнить банк и налоги в App Store Connect → Agreements, Tax, and Banking
      (нужно даже для бесплатного приложения, иначе оно не уйдёт в продажу)
- [ ] Создать App ID `com.rehearsal.app` с включённой capability **Push Notifications**
- [ ] Создать запись приложения в App Store Connect (имя «Rehearsly», основной язык, bundle ID)

> Имя «Rehearsly» надо занять пораньше — оно резервируется за записью приложения.

**Только iPhone** (решение владельца 04.11.2026). `ios.supportsTablet: false` в
`app.json`, `TARGETED_DEVICE_FAMILY = 1` в Xcode-проекте. На iPad приложение
никто не проверял, а проверяющие Apple открывают сборку и на iPad. Добавить
iPad потом можно, убрать после публикации — нет. `ios/` не в git: после
`prebuild` проверь, что в проекте осталось `1`, а не `"1,2"`.

---

## Фаза 2. Пуш-уведомления — ✅ проверено

**В Expo Go пуши не проверить** — Expo убрал их поддержку с SDK 53, у нас 54.
Нужен development build на реальном устройстве.

- [x] Плагин `expo-notifications` включён, `prebuild --clean` прописал `aps-environment`
- [x] APNs-ключ сгенерирован через `eas credentials` и назначен `com.rehearsal.app`
- [x] Локальная сборка через Xcode на iPhone 15 Pro (iOS 26.5.2)
- [x] Токен регистрируется при входе, удаляется при выходе
- [x] Доставка проверена: в открытом приложении, системным баннером в свёрнутом, тап отрабатывает
- [ ] Боевой сценарий: со второго аккаунта создать репетицию в общем проекте

### Грабли, на которые наступили

- **Xcode-проект называется `Rehearsly`**, а не `rehearsalcalendarnative` — `prebuild`
  берёт имя из `app.json`. Открывать нужно `ios/Rehearsly.xcworkspace`.
- **`DEVELOPMENT_TEAM` не проставляется автоматически** — после каждого
  `prebuild --clean` нужно заново выбрать Team в Signing & Capabilities.
- **`pod install` падает** с `Encoding::CompatibilityError`, если не задана
  UTF-8 локаль. Лечится `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install`.
- **Xcode просит «доверить сертификат» в VPN & Device Management**, хотя у платного
  аккаунта раздел пустой и доверять нечего. Сообщение ложное — если приложение
  установилось, его можно игнорировать.
- **`No script URL provided`** — сборка Debug и требует запущенного Metro
  (`npx expo start`). При запуске из Xcode он поднимается сам, при запуске
  через `devicectl` — нет.
- **Скрипты вне сервера должны звать `initDatabase()`** перед использованием `db` —
  модуль экспортирует живой биндинг, до инициализации `db.all` не существует.
- **Apple разрешает максимум 2 APNs-ключа на аккаунт** — оба слота заняты.
  Для третьего придётся отзывать старый.
- **Деплой Vercel падал на `CRON_SECRET`** с лишним пробелом/переносом строки
  (`openssl rand -base64 32` дописывает `\n`). Падало на этапе `vercel build`,
  до сборки кода, поэтому прод месяцами отдавал последнюю удачную сборку, а
  новые переменные окружения не подхватывались. Генерировать так:
  `openssl rand -base64 32 | tr -d '\n'`.
- **Порядок в `logout()` имел значение**: отзыв сессии (`/auth/logout` поднимает
  `token_version`) должен идти **после** отвязки push-токена, иначе `DELETE`
  уходит с уже недействительным токеном и получает 401, а токен остаётся в базе.

**Что уже готово и трогать не надо:** `expo-notifications@0.32.16`, `expo-device`,
серверный `expo-server-sdk@3.15.0`, `pushNotificationService.js` с рассылкой по
локали (ru/en/es/de), `notification-icon.png`, обработка сценариев — новая
репетиция, изменение, отмена, отклик, приглашение, смена роли, напоминания за
24 ч и 1 ч.

**Симулятор пуши не поддерживает** — только физическое устройство.

---

## Фаза 3. Сборка и TestFlight

- [ ] Заполнить `eas.json` → `submit.production` (Apple ID, ASC App ID, Team ID)
- [ ] `eas build --profile production --platform ios`
- [ ] `eas submit --profile production --platform ios`
- [ ] Дождаться обработки билда в App Store Connect (10–60 мин)
- [ ] Заполнить **Export Compliance** — у нас `ITSAppUsesNonExemptEncryption: false`, вопрос не всплывёт
- [ ] Раздать внутренним тестерам, прогнать основные сценарии на реальном устройстве

### dSYM готовых фреймворков React Native (T-237)

`React.framework`, `ReactNativeDependencies.framework` и `hermes.framework`
приходят в приложение собранными (pods `React-Core-prebuilt`,
`ReactNativeDependencies`, `hermes-engine` качают их с Maven), поэтому Xcode
не делает для них dSYM. Архив 1.0.0 (3) ушёл без них, и Apple ответила
«Upload Symbols Failed»: сбой внутри React или Hermes в отчётах App Store
Connect не расшифровать.

React Native публикует их dSYM рядом с бинарниками, той же версии:
`react-native-artifacts-<версия>-{reactnative-core,reactnative-dependencies,hermes-framework}-dSYM-release.tar.gz`
на Maven Central. Их кладёт в сборку config plugin
`plugins/prebuilt-dsyms/withPrebuiltDsyms.js` (стоит в `plugins` в `app.json`,
так что `expo prebuild --clean` его не теряет). Он добавляет в target
`Rehearsly` шаг `[Rehearsly] dSYMs of the prebuilt React Native frameworks`,
который запускает `plugins/prebuilt-dsyms/dsyms.mjs phase`:

- работает, только когда сборка делает dSYM (`DEBUG_INFORMATION_FORMAT =
  dwarf-with-dsym`, то есть Release — и архив, и Release для симулятора в e2e);
  в Debug ничего не качает;
- версию берёт из `ios/Pods/Manifest.lock`, архив скачивает один раз в
  `~/Library/Caches/rehearsly/prebuilt-dsyms/<версия>/` (≈470 МБ на версию,
  первая Release-сборка после смены версии дольше на время загрузки);
- **sha256 архива должен совпасть с закреплённым** в
  `plugins/prebuilt-dsyms/checksums.json`, иначе сборка падает;
- **UUID каждого dSYM должны совпасть с UUID фреймворка, который встраивается
  в приложение**, по каждой архитектуре, иначе сборка падает;
- кладёт dSYM в `DWARF_DSYM_FOLDER_PATH`, рядом с `Rehearsly.app.dSYM`, откуда
  `xcodebuild archive` забирает их в `dSYMs/` архива.

**Проверка архива перед загрузкой** (из `rehearsal-calendar-native/`):

```bash
node plugins/prebuilt-dsyms/dsyms.mjs check-archive <путь>.xcarchive
```

Печатает UUID всех dSYM и всех фреймворков в `Products/Applications/Rehearsly.app/Frameworks`
(своим чтением и `xcrun dwarfdump --uuid`, они должны совпасть) и
завершается с кодом 1, если у какого-то фреймворка нет dSYM с его UUID.
Последний раз (1.0.0, RN 0.81.5): React `76FBCEE9-…`, ReactNativeDependencies
`B35F1182-…`, hermes `80D5528F-…` — dSYM для всех трёх
(`audit/evidence/T-237/`).

**После обновления React Native** Release-сборка упадёт с «checksums.json pins
no sha256 of … <версия>» — так и должно быть. Закрепить суммы новой версии:

```bash
node plugins/prebuilt-dsyms/dsyms.mjs pin <версия react-native>
```

Берёт sha256 из файлов `.sha256` рядом с архивами на Maven; закоммитить
`checksums.json`. Совпадение UUID с фреймворками сборка проверит сама.

Если сборка упала на шаге:
- «has sha256 …, checksums.json pins …» — с Maven пришёл не тот файл (или
  сумма закреплена неверно). Не обходить: разобраться, что скачалось;
- «is not of the … the app embeds» — dSYM не от встроенного фреймворка
  (например, Pods собраны из исходников или другой версии). Архив с таким
  dSYM символы не расшифрует;
- «HTTP …» / сеть — Maven недоступен, повторить.

---

## Фаза 4. Метаданные App Store Connect

- [ ] **Privacy Policy URL** — обязателен, без него не подать
- [ ] **Support URL** — обязателен
- [ ] Скриншоты: 6.9" (iPhone 16 Pro Max) и 6.5" — минимум по одному размеру
- [ ] Описание, промо-текст, ключевые слова
- [ ] Категория (Productivity)
- [ ] Возрастной рейтинг
- [ ] **App Privacy** — опросник о сборе данных, заполнить честно:

| Что собираем | Цель | Привязано к личности |
|---|---|---|
| Email, имя | Аутентификация | Да |
| Календарные события | Функциональность (доступность) | Да |
| Push-токен | Уведомления | Да |
| Данные Google/Apple OAuth | Аутентификация | Да |

- [ ] **Демо-аккаунт для ревьюера** в App Review Information — логин/пароль
      с уже созданным проектом и парой репетиций, иначе ревьюер увидит пустой экран

> Про календарь: у нас уже прописаны `NSCalendarsUsageDescription` и
> `NSCalendarsFullAccessUsageDescription`. Ревьюеры часто придираются к формулировкам
> — текущие объясняют причину доступа, должно пройти.

---

## Фаза 5. Подача

- [ ] Submit for Review
- [ ] Ревью обычно 24–48 ч
- [ ] При отказе — читать резолюцию в Resolution Center, правки, повторная подача

---

## Платежи

Их нет ни в приложении, ни на сервере. Интеграция AllPay удалена целиком —
клиент, сервис подписок, страница чекаута, вебхук, `requireSubscription`, крон
повторных списаний и экран выбора плана. Это не флаг, который можно снять: кода
больше нет.

Причина — две гайдлайны. **3.1.1** требует IAP за разблокировку функциональности
внутри приложения, поэтому WebView на сторонний чекаут = отказ на ревью.
**2.3.1** закрывает и обходной путь «спрятать экран, включить потом»: спящая
функциональность, которую поднимает серверный флаг, тоже нарушение.

Побочный выигрыш: CSP теперь включён на весь сервер — послабления держал именно
iframe AllPay.

### Если решим брать деньги

**Через App Store (In-App Purchase)** — единственный допустимый путь для
цифровых товаров внутри приложения. Общего кода с удалённым у него нет:
- `expo-in-app-purchases` или `react-native-iap`, товары заводятся в App Store
  Connect, там же согласуются налоговые и банковские данные
- проверка чеков на сервере: приложение присылает чек, сервер проверяет его у
  Apple и только после этого открывает доступ. Доверять клиенту нельзя
- отмены и возвраты — через App Store Server Notifications: подписку
  прекращает Apple, а не наш крон

**Через сайт (вне приложения)** — так живут Notion, Slack, Figma: приложение
только логинит и показывает оплаченное, покупка происходит на лендинге.
Комиссия 0%, но условие жёсткое: **в приложении не должно быть ничего, что
ведёт к покупке** — ни кнопки, ни цен, ни упоминания тарифов. Сейчас это
условие выполняется само собой.

В обеих схемах доступ к функциям придётся заново решать на бэкенде: таблицы
`native_subscription_*` / `native_payment_*` удалены из базы 2026-09-05 —
ничего их не читало, строки выгружены перед удалением.

---
