# T-044 — неиспользуемые зависимости npm (база 8fa30d5)

Инструменты: knip 5.71.0 из клиентского `node_modules`; поиск импортов по
отслеживаемым файлам — `import-grep.mjs` (здесь же).

## server/package.json

```
$ node rehearsal-calendar-native/node_modules/knip/bin/knip.js --directory rehearsal-calendar-native/server \
    --config ../../audit/evidence/T-043/knip.server.json --no-progress --no-exit-code \
    --include dependencies,unlisted,binaries,unresolved
Unlisted dependencies (66)      # только @jest/globals и node-fetch в __tests__ — правка не по этой задаче
```
Unused dependencies / devDependencies: нет.

`import-grep.mjs rehearsal-calendar-native/server`: у каждой зависимости есть импорт,
кроме `date-fns` (0) — это peerDependency `date-fns-tz` 3.2.0
(`"peerDependencies": {"date-fns": "^3.0.0 || ^4.0.0"}`), а `date-fns-tz`
импортирует `utils/timezone.js:10`. Удалять нельзя. `jest` — запускается
`scripts/test.mjs:55`.

**Удалено: ничего.**

## rehearsal-calendar-native/package.json

```
$ node rehearsal-calendar-native/node_modules/knip/bin/knip.js --directory rehearsal-calendar-native \
    --no-progress --no-exit-code --include dependencies,unlisted,binaries,unresolved
Unused dependencies (1)
expo-linear-gradient  package.json:40:6
Unlisted dependencies (181)     # expo-updates/expo-system-ui из app.json, файлы server/ через jest — не эта задача
```
Unused devDependencies: нет. По `import-grep.mjs` без импортов только бинарники и
типы (`eslint`, `knip`, `typescript`, `@types/jest`, `@types/react`) — используются
как CLI/типы.

### expo-linear-gradient — не используется, но нативный → не удалён (BLOCKED)
- В коде приложения ни одного импорта (`git grep -i "LinearGradient"` по `src/`,
  `App.tsx`, `index.ts`, `e2e/`): только три мёртвых `jest.mock('expo-linear-gradient', …)`
  в тестах онбординга (`OnboardingStep.test.tsx:13`, `WelcomeScreen.test.tsx:10`,
  `WhatWhereScreen.test.tsx:13`) — тестируемые компоненты модуль не импортируют.
- Плагином `app.json` не подключается (plugins: expo-web-browser, expo-apple-authentication,
  expo-notifications, expo-localization, expo-calendar).
- Ничья транзитивная зависимость: в `package-lock.json` упомянут только в корневых
  `dependencies`.
- Но модуль нативный: `expo-module.config.json` → `apple.modules: ["LinearGradientModule"]`,
  `ios/ExpoLinearGradient.podspec` + Swift-исходники. Expo autolinking
  (`use_expo_modules!`) кладёт его в `Podfile.lock`, Pods-проект и
  `ExpoModulesProvider.swift`. После `npm uninstall` существующий `ios/` ссылается
  на исчезнувшие файлы `node_modules/expo-linear-gradient/ios/*`; Debug-сборка для
  e2e проходит только после `pod install` (или `expo prebuild`). `ios/` не в git —
  по условию задачи это не делается здесь.

Что сделать при сборке релиза (одним шагом):
1. `cd rehearsal-calendar-native && npm uninstall expo-linear-gradient`
2. убрать три строки `jest.mock('expo-linear-gradient', …)` в тестах выше
   (без модуля `jest.mock` с фабрикой на неустановленный пакет падает);
3. `npx pod-install` / `cd ios && pod install` (или `npx expo prebuild --clean`),
   Debug-сборка с нуля, сценарий входа e2e;
4. `npx expo install --check`, type-check, `npm test`.
