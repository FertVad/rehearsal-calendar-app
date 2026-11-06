# T-046 — knip в `npm run check` и CI: «красное до» и проверка (база cc1bde0)

knip 5.71.0 из `rehearsal-calendar-native/node_modules`. Конфиг —
`rehearsal-calendar-native/knip.jsonc` (был `knip.json`; переименован, чтобы
каждое исключение несло комментарий), два workspace: `.` (приложение) и `server`.

## До: knip не входит в проверки, а со старым конфигом не годится в них

```
$ git show cc1bde0:rehearsal-calendar-native/package.json | grep -n '"check'
16:    "check": "npm run check:secrets && npm run type-check && npm test",
19:    "check:secrets": "bash scripts/check-secrets.sh",
```
Ни `check:dead`, ни knip в `check` (а CI-job `check` запускает ровно `npm run check`):
неиспользуемый файл проходит все проверки.

Старый `knip.json` по приложению (сервер — отдельный пакет, без конфига в репозитории;
его гоняли конфигом из `audit/evidence/T-043/knip.server.json`):
```
$ node node_modules/knip/bin/knip.js --directory rehearsal-calendar-native --no-progress
Unlisted dependencies (181)     # 169 из них — server/__tests__: jest-проект "backend"
                                # делал серверные тесты файлами приложения, и их импорты
                                # (express, supertest, bcrypt…) сверялись с клиентским package.json
Unresolved imports (1)
metro-minify-terser  metro.config.js
exit=1
$ … --directory rehearsal-calendar-native/server --config ../../audit/evidence/T-043/knip.server.json
Unlisted dependencies (66)      # @jest/globals ×64, node-fetch ×2
Unused exports (1)
schemaTableNames  database/schema/inspect.mjs:16:14
Duplicate exports (1)
authenticateToken|requireAuth  middleware/jwtMiddleware.js
exit=1
```
Неиспользуемых файлов и экспортов в приложении нет, в сервере — только два случая,
оставленных в T-043 намеренно. Всё остальное — «unlisted»: транзитивные пакеты и догадки
плагинов expo/metro. Происхождение каждого — `deps-origin.mjs` (здесь же), вывод ниже.
Каждое исключение в `knip.jsonc` — с комментарием.

## Красное: неиспользуемый файл роняет `check:dead` и `npm run check`

Пробы — `probe.mjs add` (по файлу в `src/shared/utils/` и `server/utils/`, их никто не импортирует):
```
$ cd rehearsal-calendar-native && npm run check:dead
> knip --no-progress

Unused files (2)
server/utils/t046DeadProbe.js
src/shared/utils/t046DeadProbe.ts
exit=1

$ npm run check
> npm run check:secrets && npm run check:dead && npm run type-check && npm test
{"summary":"pass","mode":"worktree","files":1674,"findings":0,"errors":0}
> knip --no-progress
Unused files (2)
server/utils/t046DeadProbe.js
src/shared/utils/t046DeadProbe.ts
exit=1
```

## Зелёное: без проб

```
$ node ../audit/evidence/T-046/probe.mjs remove
$ npm run check:dead
> knip --no-progress
exit=0
$ npm run check:secrets
{"summary":"pass","mode":"worktree","files":1674,"findings":0,"errors":0}
```

## Происхождение исключённых зависимостей

```
$ node audit/evidence/T-046/deps-origin.mjs
@jest/globals@30.2.0 installed in rehearsal-calendar-native/server/node_modules
jest-runtime@30.2.0 dependencies.@jest/globals = 30.2.0
node-fetch@2.7.0 installed in rehearsal-calendar-native/server/node_modules
apple-signin-auth@1.7.9 dependencies.node-fetch = ^2.6.7
gaxios@6.7.1 dependencies.node-fetch = ^2.6.9
@react-navigation/native@7.1.20 dependencies.@react-navigation/core = ^7.13.1
@react-navigation/core@7.13.1 dependencies.@react-navigation/routers = ^7.5.1
eslint@9.39.1 dependencies.@eslint/js = 9.39.1
metro@0.83.2 installed in rehearsal-calendar-native/node_modules
@react-native/community-cli-plugin@0.81.5 dependencies.metro = ^0.83.1
expo@54.0.37 dependencies.@expo/metro-config = 54.0.17
@expo/metro-config@54.0.17 installed in rehearsal-calendar-native/node_modules/expo/node_modules
metro-transform-worker@0.83.2 dependencies.metro-minify-terser = 0.83.2
expo-updates: NOT installed in rehearsal-calendar-native
expo-system-ui: NOT installed in rehearsal-calendar-native
```
`expo-updates` / `expo-system-ui` — эвристика плагина Expo в knip
(`knip/dist/plugins/expo/helpers.js:40,57`: нет `updates.enabled: false`; задан
`userInterfaceStyle`). Пакеты не стоят и не импортируются — это не мусор; добавлять их
или менять `app.json` — вне задачи.

CI: job `check` (`.github/workflows/check.yml`) ставит зависимости приложения и сервера
и запускает `npm run check` — `check:dead` идёт в нём, отдельный шаг не нужен.
