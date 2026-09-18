# H02 — резервное открытие приглашения при строгом CSP

18 сентября 2026. Ветка `codex/systematic-repair`; база `1d0142b`.
Проверяемый source commit: **df6fd0111111bd4f8b36a2e797cb0cccda563b25**.
Статус finding: **READY_FOR_CHECK**. Исправление браузерной страницы проверяется
локально успешно; обязательная физическая часть DEV-15 пока **NOT_RUN**.
Исходники зафиксированы до финальных прогонов, отчёт и evidence — отдельно.
Предыдущие manifests сохраняют свои исходные commit и результаты.

## Причина

`GET /invite/:code` возвращал основной script с разрешённым nonce, но резервная
кнопка имела `href="#"` и inline `onclick`. Nonce отдельного script не разрешает
event attributes: действующий `script-src-attr 'none'` блокировал обработчик.
После отказа автоматического открытия tap менял fragment, не открывая приложение.
Ещё два несовместимых с policy места — inline `<style>` и `style="display: none"`.
Они нарушали оформление и начальную видимость резервного блока, поскольку
`style-src` разрешает same-origin assets и указанный font stylesheet.

## Исправленный контракт

`routes/invitePage.js` строит документ с настоящим custom-scheme `href`.
Код кодируется как один URL path segment через `encodeURIComponent`, а готовый
адрес проходит `escapeHtml` для HTML attribute. Ввод не попадает в исполняемый JS.
Ссылки и английский текст доступны сразу из HTML, даже при выключенном JavaScript
или отказе загрузки его файла; начальный индикатор имеет стандартный `hidden`.

CSS вынесен в `public/invite-page/invite.css`, JS — в `invite.js` той же папки.
Inline scripts, handlers, style blocks и style attributes на странице отсутствуют.
JS локализует сообщения и `lang` для русского браузера; остальным остаётся English.
Стили сохраняют оформление, видимый keyboard focus и учитывают reduced motion.
Содержимое `securityHeaders` изменено только в комментарии: директивы прежние,
в том числе `script-src-attr 'none'`, без `unsafe-inline` и `unsafe-eval`.

Основная ручная ссылка имеет `rehearsalapp://invite/<encoded-code>`.
При корректном `expoHost` она ведёт в `exp://<authority>/--/invite/<encoded-code>`,
а рядом всегда есть отдельная ссылка открытия установленного native приложения.
Expo authority допускает hostname/IP и необязательный порт, но не полный URL,
path/query/fragment, credentials, массив или объект из query. Некорректное значение
игнорируется с сохранением native ссылки; существование dev host не проверяется.
Восьмизначные short codes и legacy 32-hex передаются без изменения регистра.
HTML route не проверяет существование кода, не читает аккаунт и не обращается к БД.
Preview/join API, их budgets, проверка срока и членство сохраняют прежний контракт.

При работающем JS остаётся автоматическая попытка открыть приложение: сначала
Expo, если задан, затем native через 500 ms; без Expo выполняется одна попытка.
Резервный блок показывается через 2 секунды после последней запланированной попытки.
Таймер восстановления устанавливается до навигации, поэтому её отказ или exception
не оставляет страницу без ручной ссылки. Ручной tap/Enter использует стандартное
действие anchor, без inline handler и переноса пользовательского жеста в таймер.
При изменении видимости страницы и возврате из BFCache pending timers отменяются,
чтобы возвращение из приложения не запускало вторую отложенную попытку.

После переноса последнего application usage удалён неиспользуемый `jsonForScript`.
Его четыре unit assertions больше не описывают существующий sink; проверки
`escapeHtml` сохранены, а вредоносный ввод проверяется в реальном браузерном HTML
по точному href, отсутствию созданных attacker elements и исполнения payload.

## Локальные проверки и evidence

Browser fixture обслуживает настоящий `createApp` на loopback, не инициализирует
БД и запрещает унаследованные `DATABASE_URL`/`POSTGRES_URL`. `.env` и `server.js`
не загружаются. Внешние HTTP requests блокируются, профиль браузера изолирован.
Ручная активация записывается с `isTrusted`, затем fixture отменяет её default
navigation: это доказательство browser action, а не доставки URL в native app.

| Проверка | Результат / evidence |
|---|---|
| Desired-behavior browser regression до исправления | Ожидаемый FAIL, 9/9; [исходный прогон](evidence/H02/browser-before.txt) |
| Адресный browser regression после исправления | PASS, 11/11 на промежуточном коде; [прогон после исправления](evidence/H02/browser-after.txt) |
| Полный `npm run check` на source commit | PASS, exit0: 79 suites / 1042 Jest tests, admin browser4/4, invite browser11/11, persisted6/6; [полный check](evidence/H02/check-final.txt) |
| Полный изолированный PostgreSQL runner на source commit | PASS, exit0: controls/A02/B03/B04, F01/B02/D01 остаются known defects; [PostgreSQL](evidence/H02/postgres-final.txt) |
| Физический Safari / messenger → установленная сборка, DEV-15 | NOT_RUN; карточка ниже |
| Deployment assets/CSP smoke | NOT_RUN; локальная раздача не подтверждает deployment |

Browser suite проверяет полную неизменную CSP, отсутствие её нарушений страницей,
реальное оформление и `200`/MIME/`nosniff` обоих assets. Покрыты таймер fallback,
mouse/keyboard activation, exact short/legacy paths, RU/EN, корректный Expo host,
структурированные/вредоносные query, encoded hostile code и отсутствие JavaScript.
CDP подтверждает запрос автоматической Expo-навигации; после синтетического
visibilitychange или persisted pageshow второй native-запрос отменён. Это браузерный
контракт жизненного цикла, а не реальное OS-событие. Дополнительно policy продолжает
блокировать внедрённые inline scripts/handlers. [Скриншот](evidence/H02/invite-desktop.png)
проверен визуально; [независимый review](evidence/H02/review.txt) не выявил блокеров.
Числа финального прогона относятся только к source commit выше; промежуточный
лог не переименовывается в финальное evidence после последующего изменения кода.

`npm test` приложения и сервера теперь обязательно запускает invite browser suite
через `scripts/test.mjs` наряду с admin и persisted-content suites. Поэтому он
входит и в `npm run check`, независимо от Jest filters. Отдельная диагностика —
`npm run test:invite-browser`; отсутствие браузера не превращается в silent skip.
[Манифест](evidence/H02/manifest.json) содержит commit/tree, команды, exit codes
и хеши исходников/результатов. Удалённые проверки доступны в
[Application checks](https://github.com/FertVad/rehearsal-calendar-app/actions/workflows/check.yml?query=branch%3Acodex%2Fsystematic-repair).
Успешный PG прогон проверяет отсутствие регрессий других серверных контрактов,
но не является доказательством запуска установленного приложения.

## Обязательная карточка человека H02 / DEV-15

**Статус: NOT_RUN.** Нужен реальный iPhone с разрешённой тестовой сборкой и
изолированным staging backend; credentials/ссылки production не используются.
Эта карточка закрывает browser fallback H02, а не весь onboarding/intent queue HN01.

1. Записать модель/iOS, браузер и messenger, app/backend SHA, build ID и staging
   origin; проверить изоляцию backend и синтетические test accounts/projects.
2. Подготовить действующий восьмизначный и legacy 32-hex invite, записать ожидаемые
   code/project aliases. Для HTTPS association зафиксировать test build/domain IDs.
3. Открыть ссылку в Safari и выбранном messenger browser, воспроизвести отказ
   или отмену automatic open, дождаться резервной ссылки и нажать её реальным tap.
4. Проверить открытие ожидаемого JoinProject с точным кодом; повторить для cold
   и warm app. Сам join не должен выполняться без отдельного действия пользователя.
5. Вернуться в браузер: нет повторного отложенного открытия. Проверить RU/EN;
   если среда позволяет, отключить JS и повторить ручное открытие. Не считать
   неподдерживаемый в messenger переключатель JavaScript успешно проверенным.
6. Сохранить видео tap/OS prompt/screens, фактические build IDs и PASS/FAIL для
   каждого случая. Android проверяется, если входит в release scope; иначе scope
   указан явно. Отсутствие устройства оставляет эту часть NOT_RUN.

Если association не доставляет HTTPS link в приложение, это отдельный integration
результат; browser fallback и точный custom-scheme URL оцениваются раздельно.
Полный DEV-15 из [плана устройств](notes-remediation-device-tests.md) включает HN01:
сохранение intent до login/onboarding, повтор и expired/revoked — здесь не закрыты.

## Границы результата и продолжение

Production, `rehearsly.me`, Neon и переменные Vercel не запрашивались; известный
отказ квоты не перепроверялся. Deployment packaging/CDN и native launch остаются
NOT_RUN. До нужного production действия применяется [обязательная граница](PRODUCTION_ACCESS.md).
Разрешение push той же ветки и её Application checks уже получено отдельно;
оно не разрешает deploy. Автодеплой остаётся выключенным, reminders не меняются,
новые scheduler/polling не создаются. Для H02 миграция БД не требуется.
Следующий независимый пункт R1 — H04: видимые ошибки admin загрузки/смены статуса.
