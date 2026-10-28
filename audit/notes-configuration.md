# I — конфигурация приложения, native/build/CI

Статус: готово, 2026-09-15; актуализация workflow до HEAD `0f655e2`. Режим только чтения; конфигурация, сборки, скрипты и тесты не запускались. Значения секретов не извлекаются и не публикуются. Корень путей ниже — `rehearsal-calendar-native/`, если не указан корень репозитория.

## Покрытие

Полностью прочитаны tracked config: `app.json` (100 строк), `eas.json` (36), `tsconfig.json` (6), `eslint.config.js` (112), `jest.config.js` (62), `knip.json` (25), `package.json` (66), `server/package.json` (43), `server/vercel.json` (26), `.env.example` (15), `.gitignore` (69). Команды package.json:15–17 добраны после первоначального фильтра; это `check`, `check:secrets`, `precommit`, не значения секретов. Единственный найденный корневой workflow `.github/workflows/rehearsal-reminders.yml` полностью прочитан в G (прежние 52 строки), в I повторно прочитана текущая версия (70 строк) и diff `25475e8..0f655e2`. Поиск hidden конфигов не обнаружил дополнительных first-party Babel/Metro/EAS config или workflows. `check-secrets.sh` и глобальный поиск секретов проверяет основной аудитор I; здесь скрипт не запускался.

Native metadata прочитаны как **локальный generated snapshot**, а не как tracked production source: `.gitignore:61–63` исключает `/ios` и `/android`, `git ls-files` по Android main manifest/build.gradle и iOS plist/entitlements/project.pbxproj вернул пустой список. Прочитаны Android `app/build.gradle` (182 строки; signing значения на :102–105 скрыты, ни ключ/пароль, ни бинарный keystore не читались), `build.gradle` (24), `settings.gradle` (39), `gradle.properties` (65), `gradle/wrapper/gradle-wrapper.properties` (7), `app/proguard-rules.pro` (14), main manifest (40 логических строк), debug/debugOptimized manifests (по 7), `.gitignore` (16). Для linking/lifecycle также были прочитаны локальные `MainActivity.kt` (61) и `MainApplication.kt` (56); никакого обхода generated providers/library code нет.

iOS локально полностью прочитаны: `Rehearsly/Info.plist` (91 логическая строка), `Rehearsly.entitlements` (16), `PrivacyInfo.xcprivacy` (48), `Supporting/Expo.plist` (12), `AppDelegate.swift` (70), `Rehearsly-Bridging-Header.h` (3), `Podfile` (60), `Podfile.properties.json` (5), `.xcode.env` (11), `.gitignore` (30), `Rehearsly.xcodeproj/project.pbxproj` (551), shared scheme `Rehearsly.xcscheme` (88), workspace contents (10). Количество логических строк у plist/manifest на единицу больше `wc -l` из-за отсутствующего завершающего newline. Generated native файлы не включаются в обещание полного покрытия исходников проекта.

Адресное чтение/поиск стыков: `src/shared/services/api.ts:1–94`, `googleAuth.ts:1–35`, весь небольшой `shared/utils/storage.ts` (ранее A/H), `server/server.js:222–252`, navigation link prefixes и invite URL consumers; это не повторное полное чтение API/server/navigation. Поиск `EXPO_PUBLIC_`, `Constants.expoConfig`, `process.env` по src для публичной конфигурации, без чтения настоящих `.env`.

Не проверяются: Pods/node_modules, native build/DerivedData/.gradle, generated providers, gradle wrapper JAR и стандартные generated launchers, бинарный debug keystore, изображения/иконки/launch storyboard/прочие ассеты, lockfiles (отдельный аудитор I). Отсутствуют проверки финального merged manifest, подписанного APK/AAB/IPA, provisioning profile, EAS dashboard env/signing, App Store/Play metadata, реального association URL/DNS, внешнего cron-job.org и GitHub run history. Ни один результат сборки/теста не утверждается.

## Уже установленные контракты

- `app.json:18–20,49–73`: iOS bundle/Android package `com.rehearsal.app`; iOS associated domain `applinks:rehearsly.me`, Android autoVerify filter HTTPS `/invite` и собственная схема `rehearsalapp`. iOS local entitlements:13 совпадает; `server/server.js:230–231` AASA имеет team+bundle `9N28BHP37Z.com.rehearsal.app`, path `/invite/*`, team совпадает с local Xcode project:349,386. Это согласованность кода, не проверка размещения файла/подписи final binary.
- `app.json:91-98`: Expo extra содержит EAS project ID и публичные OAuth client IDs. Это идентификаторы клиентов, не секреты; отдельная находка о «секретах в бандле» по ним не начисляется.
- `eas.json:23–29`: production autoIncrement, без env/signing credentials в файле. Основной аудитор подтвердил managed workflow в `docs/app-store-release.md:5–7`; ignored native directories генерируются для EAS. Локальный snapshot не используется как доказательство параметров current EAS release.
- `package.json:8-14`, `eslint.config.js:13-16,83-85`: lint запускается для `src/`, native каталоги исключены; no-undef выключен с расчётом на TS. Это ограничения проверок, без самостоятельной находки о корректности. Jest/ts-jest, TypeScript, ESLint, knip не запускались.
- `server/vercel.json:1–26`: server.js передаётся @vercel/node, public включён, NODE_ENV production; отдельного Vercel cron нет. Доставка расписания уже разобрана в G, дубликат не начисляется.
- Публичный env consumer — `EXPO_PUBLIC_API_URL` (`api.ts:23,45–48`); default production HTTPS `https://rehearsly.me/api`, dev HTTP:56,63–65. EAS build environment здесь неизвестен; наличие override не означает утечку секрета. Публичные OAuth IDs читаются `googleAuth.ts:19–21`, клиентских private credentials в рассмотренных tracked конфигах не обнаружено. `.env.example` содержит только документированные URL-примеры.

## IC01 — Medium — Android App Links не имеют действительной association подписи

Места: `server/server.js:238–251`, особенно :245–247; `app.json:49,54–73`; навигация `src/navigation/index.tsx:66–67`.

```js
// server/server.js:245–247
package_name: 'com.rehearsal.app',
sha256_cert_fingerprints: [
  'YOUR_ANDROID_SHA256_FINGERPRINT'
]
```

`app.json:57,60–62` запрашивает `autoVerify: true` для HTTPS `rehearsly.me/invite`, но обслуживаемый сервером assetlinks содержит placeholder вместо SHA-256 сертификата Android приложения. Строка не является fingerprint, и соответствие установленному подписанному приложению из такой association получить невозможно. Package ID совпадает, подпись отсутствует.

Сценарий: выпускается/устанавливается Android приложение с текущим tracked app.json, пользователь открывает `https://rehearsly.me/invite/<code>`; даже при правильном домене в сгенерированном manifest серверный assetlinks не подтверждает владельца. Автоматическое открытие как verified App Link не работает; пользователь остаётся в browser/chooser в зависимости от ОС и настроек. Browser landing и ручной переход по custom scheme могут оставаться работоспособными — находка не означает полный отказ принятия приглашений.

Границы: Android, по проектной документации, ещё не настроен для release; это подтверждённая незавершённая конфигурация перед Android выпуском, не доказательство сломанной текущей iOS публикации. Actual deployed endpoint/Play signing не запрашивались; оценка опирается на tracked handler. Старый домен локального ignored manifest — отдельное наблюдение ниже, не второй дефект той же release цепочки.

Минимум (1–2 ч после получения сертификата): заполнить association действительным SHA-256 сертификата распространяемой Android сборки. Плюс: минимальный public metadata fix; минус: необходимо учитывать Play App Signing, если сертификат установки отличается от upload/debug key, и разные каналы. Значение fingerprint публично и не должно заменяться приватным ключом.

Правильно (0.5–1 день + проверка устройства): держать production domain/package/fingerprints в одном контролируемом release contract; при релизе проверять сгенерированный manifest и association для каждого канала, затем открытие invite на Android. Плюс: предотвращает рассинхронизацию при смене domain/signing; минус: требует доступа к release metadata и проверки готового артефакта. Эти действия в данном read-only аудите не выполнялись.

## Ограничения native/security конфигурации и ручные проверки, без отдельного count

- **Локальный Android drift:** `android/app/src/main/AndroidManifest.xml:33` всё ещё указывает `rehearsal-calendar-app.onrender.com`, тогда как tracked app.json:61 и navigation:67 — `rehearsly.me`. Для bare/local сборки этого snapshot HTTPS приглашения current domain не имеют нужного intent match. Для managed EAS snapshot игнорируется: отдельно как current release bug не начисляется. Перед локальной сборкой сверить/recreate native config разрешённым владельцем процессом; в аудите это не делалось.
- **Локальная release-подпись:** `android/app/build.gradle:112–115` содержит предупреждение о собственном production keystore, но `signingConfig signingConfigs.debug`. Относится к bare/local Gradle release из этого ignored проекта; не доказывает, что EAS production использует debug key. Нужна проверка signing certificate финального AAB/APK. Приватный debug keystore не открывался.
- **Смешанный Android intent filter:** app.json:58–66 объединяет HTTPS host/path и custom scheme в одном autoVerify filter, а local snapshot имеет ещё отдельный custom filter:25–30. Следует проверить merged manifest и verification behavior на целевых Android; здесь не делается недоказанное утверждение, что эта комбинация сама по себе обязательно ломает все варианты intent matching. Устранение placeholder IC01 необходимо независимо от этого.
- **Разрешения/backup:** tracked app.json явно запрашивает READ/WRITE_CALENDAR:50–52; local main manifest дополнительно имеет external storage и SYSTEM_ALERT_WINDOW:4–8, `allowBackup="true"`:16, без собственных backup exclusion rules в прочитанном metadata. Native dependency merge/реальный release artifact не проверены; это не доказательство, что runtime permission запрошено или что токены публично доступны. При известном хранении accessToken в AsyncStorage (`api.ts:88`) проверить final backup rules и перенос auth/cache на другое устройство; самостоятельно extraction/backup не выполнялся.
- **Cleartext/ATS:** local Android `usesCleartextTraffic=true` находится только в debug/debugOptimized manifest:6; main manifest не даёт общей cleartext exception. iOS Info.plist:45–50 имеет `NSAllowsArbitraryLoads=false`, `NSAllowsLocalNetworking=true`. Dev HTTP API предусмотрен намеренно; unrestricted production HTTP из этих файлов не подтверждён. Build env с HTTP override требует отдельной проверки endpoint/transport политики.
- **iOS push:** local entitlements:5–6 `aps-environment=development`, одинаковый entitlements path у Xcode Debug/Release:347,384. Финальная distribution подпись/provisioning может определять иной environment; без подписанного IPA это не confirmed отказ production push. Expo notifications plugin присутствует в tracked app.json:84.
- **Privacy metadata:** local PrivacyInfo.xcprivacy описывает required-reason API categories, empty collectedDataTypes:43–44 и tracking false:45–46; Podfile:49 включает aggregation. Это не полноценная проверка App Store privacy declarations/соответствия политике; store form и финальные aggregated manifests не читались, вывод о нарушении требований не делается.
- **Локальный Xcode test scheme:** Rehearsly.xcscheme:35–38 ссылается на RehearslyTests target, которого нет в project targets:184–186. Это generated snapshot/testing observation, не доказательство отказа app archive: ArchiveAction использует Release:84–87. Native tests и Xcode не запускались.

## Delta 2026-09-15: workflow напоминаний и стык G

В HEAD `0f655e2` `.github/workflows/rehearsal-reminders.yml:39–40` schedule закомментирован, :41 оставляет только `workflow_dispatch`. В :21–28 комментарий сообщает, что с 2026-09-12 остановлены все reminders и cron-job.org из-за расхода Neon compute; внешний cron/dashboard здесь не проверен, это заявленное состояние документации. Автоматический GitHub trigger статически отключён. Конфигурация Vercel собственного cron не содержит.

**GR03 не исправлен.** Diff меняет только расписание/комментарии; HTTP success check остаётся, теперь :67–70. При manual workflow dispatch или прямом вызове endpoint scheduler по-прежнему может скрыть DB/send error за HTTP200. В `notes-reminders.md` внесена актуализация; GR01–GR05 сохраняют техническую достижимость после вызова endpoint/возобновления расписания, но не нужно утверждать их текущую автоматическую частоту. Намеренное отключение расписания само по себе не объявляется скрытым code bug; восстановление reminders — отдельное операционное решение владельца.
