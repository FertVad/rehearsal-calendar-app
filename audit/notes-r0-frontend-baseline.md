# R0 — frontend и lint baseline

17 сентября 2026. Node 20.19.2; рабочая ветка `codex/systematic-repair`, база `0f655e2`.
Mobile source, assertions, зависимости и Jest config в этой итерации не менялись.

```sh
# Из rehearsal-calendar-native, без загрузки .env
env -i PATH=/usr/bin:/bin TZ=UTC NODE_ENV=test CI=1 EXPO_PUBLIC_API_URL=http://127.0.0.1:1/api /Users/vadimfertik/.nvm/versions/node/v20.19.2/bin/node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js --selectProjects frontend --runInBand --no-cache
env -i PATH=/usr/bin:/bin TZ=UTC NODE_ENV=test /Users/vadimfertik/.nvm/versions/node/v20.19.2/bin/node node_modules/eslint/bin/eslint.js src/ --ext .ts,.tsx
```

- Frontend: **37 suites / 518 tests PASS, exit 0**, 31.525 s, snapshots 0. [Полный лог](evidence/R0/frontend-baseline.txt).
- Lint: **0 errors, 322 warnings, exit 0**, без `--fix`. [Лог](evidence/R0/lint-baseline.txt). Warnings — исходный долг; он не обнулялся изменением правил.
- Type-check ранее в R0/H01: **PASS, exit 0**; повтор не требовался, TypeScript source не менялся.
- `npm run check` целиком не запускался: дефектный secret scanner имеет отдельный finding IS01 и может печатать найденные значения. Его безопасные fixtures относятся к R1; запуск на живом `.env` не нужен для baseline.

Перед запуском просмотрены frontend setup/mocks и сетевые границы. RN, Expo,
calendar, notifications и AsyncStorage заменены локальными mocks. API suites
подменяют Axios или `services/api`; при импорте реальный `api.ts` создаёт client,
не отправляет запрос. Дополнительно API URL направлен на localhost:1, окружение
очищено, запуск прошёл внутри sandbox. Никаких provider credentials не передано.

В логе есть deprecation `react-test-renderer` и ожидаемые mock failures
offline/calendar/storage. Это не failed assertions. PASS не доказывает native
permissions, OAuth, живую сеть, двухпользовательские гонки или работу на телефоне.
На устройстве тесты не запускались; соответствующие DEV-карточки остаются NOT_RUN.
