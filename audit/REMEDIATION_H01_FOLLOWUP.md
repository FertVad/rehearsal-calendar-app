# H01 — обязательная защита от регресса и воспроизводимые доказательства

18 сентября 2026. Ветка `codex/systematic-repair`. Статус: **VERIFIED локально**.
Проверенный commit исходников: **`c43a0dfc32f8fbc23d66bea6c9cfbfaa6abeafdd`**.
Git tree: `dab334a263055be80e7909e1e4297938be9d3cb5`.
Отчёт и evidence добавляются последующим коммитом документации; проверяемый код
после указанного commit не менялся. Push, deploy и изменение настроек GitHub не выполнялись.

## Что исправлено

- Обычный `npm test` как приложения, так и сервера выполняет Jest и оба H01 browser-набора. Корневой `npm run check` включает этот полный запуск. Расширение `.mjs` больше не мешает обязательному выполнению: browser stage запускается явно через `server/scripts/test.mjs`.
- Первый Jest stage проверяет сохранение данных, затем отдельный обязательный stage принудительно задаёт `ADMIN_BROWSER_CHECK=1` и проверяет их DOM-отображение. Пользовательские Jest-фильтры не исключают browser stages. `test:unit`, watch и coverage остаются явно сокращёнными командами для разработки.
- Chromium установленной версии Playwright подготавливается автоматически. Повторный запуск использует кэш. Ошибка установки, отсутствующий явно заданный executable, ошибка запуска или тестов завершают общий runner с ненулевым кодом; пропуска browser-проверок нет.
- Добавлен workflow `Application checks` на push/pull_request: оба `npm ci`, Chromium с Linux-библиотеками и обычный `npm run check`. Для свежего Linux подготовка системных библиотек доступна той же командой `test:browser:install -- --with-deps`.
- Admin router расположен после общих security/CORS/body/rate-limit middleware, но перед `express.static`. `/admin` и `/admin/` возвращают 200 напрямую; asset paths продолжают обслуживаться статикой. Новый HTTP-набор использует настоящий `createApp`, запрещая загрузку `.env` и доступ к БД.
- `.nvmrc` и CI используют Node **22.16.0**. Проверка чистой установки выявила, что прежний Node 20.19.2 ниже требований закреплённых React Native/Metro (`>=20.19.4`). Все 1488 объявленных `engines.node` в двух lockfile совместимы с 22.16.0. Зависимости и lockfile не менялись; native-модули рабочего checkout переустановлены на закреплённом Node.

## Воспроизводимость и результаты

Проверка выполнялась в отдельном локальном клоне с detached checkout указанного
commit. После переключения выполнены оба `npm ci` с новым пустым npm-кэшем;
существующие `node_modules` заменены установкой из lockfile. `npm run check`
получил отдельный пустой `PLAYWRIGHT_BROWSERS_PATH`; ручной установки браузера
и executable override не было. Команды запускались через `env -i` с явно
заданными PATH и тестовыми путями. `.env`, реальные credentials и production БД
не использовались. Приложение в production-режиме не запускалось.

Среда: macOS **26.3.1 arm64**, Node **22.16.0**, npm **10.9.2**,
Playwright **1.62.1**, Chromium **151.0.7922.34**.

| Проверка | Exit / результат | Evidence |
|---|---|---|
| Новый HTTP regression до изменения маршрутизации | 1, ожидаемый FAIL: `/admin` вернул 301 вместо 200; остальные 5 тестов PASS | [До](evidence/H01-followup/admin-http-before.txt) |
| HTTP regression после изменения | 0, 6/6 PASS: оба URL, CSP, MIME JS/CSS, API authorization, публичная `/privacy` | [После](evidence/H01-followup/admin-http-after.txt) |
| Чистая установка приложения и сервера на проверенном commit | 0 / 0; 1572 и 522 пакета; без EBADENGINE | [Приложение](evidence/H01-followup/install-root.txt), [сервер](evidence/H01-followup/install-server.txt) |
| Обычный `npm run check` из чистого checkout | 0; Chromium скачан автоматически; type-check PASS; Jest **70 suites / 869 tests** (518 frontend + 351 backend); browser **4/4**; persisted suite **6/6**, включая 5 DOM-сценариев | [Полный check](evidence/H01-followup/clean-check.txt) |
| Возврат `innerHTML` во временном клоне, обычный `npm test` | 1, ожидаемый FAIL: все **869 Jest tests PASS**, browser **2 FAIL / 2 PASS**, **13 HTML-элементов вместо 0**. Падение именно по регрессу, а не из-за окружения | [Мутация](evidence/H01-followup/mutation.diff), [лог](evidence/H01-followup/mutation-npm-test.txt) |
| Явно задан несуществующий браузер, обычный `npm test` | 1, ожидаемый отказ ENOENT до тестов; fallback/skip нет | [Отказ](evidence/H01-followup/missing-browser.txt) |
| Восстановление исходников и обычный серверный `npm test` | 0; **33 suites / 351 tests**, browser **4/4**, persisted suite **6/6**; checkout снова чистый | [Сервер](evidence/H01-followup/server-npm-test.txt) |
| Независимый review маршрутизации, тестов, runner и workflow | Блокирующих замечаний не найдено; проверены сохранение rate limit/CSP/auth, fallthrough assets и передача кодов ошибок | Проверка diff двумя агентами; настройка Node уточнена после фактического npm ci |

После мутации renderer восстановлен из проверенного commit и побайтно сверен
с `git show`; `git status --porcelain` пуст. Метаданные окружения, версия реально
запущенного браузера и exit codes: [verification.json](evidence/H01-followup/verification.json).

Первые два целевых HTTP-прогона выполнены на основном checkout с Node 20.19.2:
до исправления — baseline `be18763` плюс новый тест; после — исправленный app.js.
Тот же HTTP-набор затем полностью повторён в чистом прогоне Node 22.16.0.

## Как повторить и проверить evidence

[README browser tests](../rehearsal-calendar-native/server/__tests__/browser/README.md)
содержит команды установки и обычного `check`. Для воспроизведения этого отчёта
создать отдельный checkout commit `c43a0dfc32f8fbc23d66bea6c9cfbfaa6abeafdd`.
Не подменять им текущую рабочую ветку с последующими исправлениями.

[Манифест](evidence/H01-followup/manifest.json) содержит полный source commit,
git tree и SHA-256 проверяемых исходников, конфигурации, lockfile и сырых логов.
Хеши исходников сверены одновременно с диском и содержимым указанного commit.
Исторические H01/R0 manifests сохранены; они не описывают будущий HEAD.
Если проверяемый код изменится, потребуется новый прогон и новый evidence snapshot.

## Границы результата

- Удалённый GitHub Actions run — **NOT_RUN**: workflow добавлен локально, ветка не отправлялась. YAML проверен; выполнение на Linux runner ещё не наблюдалось.
- Required status check в branch protection — **NOT_CONFIGURED в рамках этой работы**. Это настройка GitHub, которую файл workflow не включает. После разрешённой отправки ветки нужно подтвердить успешный job `check` и включить его в правила целевой ветки, если требуется запретить merge без него.
- Deployment/CDN smoke — **NOT_RUN**, остаётся перед будущим выпуском: оба admin URL, assets/MIME/CSP, вход и буквальное отображение синтетических сохранённых данных.
- Телефон и живые пользовательские данные для этих исправлений не нужны. Боевая БД не читалась и не изменялась.
- Остальные 101 findings, включая A02 и IS01, не закрываются этим этапом. PASS существующего secret scanner не устраняет отдельно найденный дефект IS01. Следующая самостоятельная задача по плану — A02.
