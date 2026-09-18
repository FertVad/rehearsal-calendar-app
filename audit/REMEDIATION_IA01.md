# IA01 — обязательный intended audience для Apple-входа

Дата: 18 сентября 2026. Ветка `codex/systematic-repair`.
База: `7588ab861518c0c3988ad07443e9e5c4a71059ae`.
Статус: **READY_FOR_CHECK** — локальная защита проверена, обязательная
deployment-конфигурация OPS-IA01 ещё NOT_RUN. Source commit
`0dc7666b6f66c049d436bbe5c384102e0fb6aca7`, tree
`b7e2443c3de0afd76c1ec7c563749962aa023321`.

## Правило и реализация

Apple ID token не является credentials этого приложения, пока не проверен
его intended audience. Чистый `config/appleAuth.js` читает один явно заданный
`APPLE_CLIENT_ID`, нормализует внешние пробелы и отклоняет пустоту, внутренние
пробелы и синтаксис списка. Никакого значения из токена, bundle ID или другого
OAuth provider в качестве fallback нет. Разрешённый список содержит ровно этот
ID; сопоставление точное, с учётом регистра. Несколько Apple clients этой
конфигурацией не поддерживаются и не добавлены без реальной потребности.

Отсутствующая/некорректная настройка отключает только Apple login. Общий guard
срабатывает до вызова библиотеки и её JWKS transport; pure helper используется
и для startup warning с безопасным reason code. Это не обязательная переменная
для старта всего сайта: остановка остальных маршрутов не исправляет границу
Apple authentication. Успешный startup не доказывает корректность Apple config.

Настроенный provider проверяет токен настоящей locked `apple-signin-auth` /
`jsonwebtoken`: явные RS256, Apple issuer, непустой audience allowlist и expiry.
Ошибки verifier имеют отдельный тип, не несут сырые token/claims/library details.
Google verification и account-linking policy не меняются.

`POST /api/auth/apple`: неверный тип/пустой `idToken` даёт 400; недоступная
конфигурация — 503; отказ проверки токена — 401; внутренний отказ после проверки,
например storage, — 500. Отказ до проверки личности не вызывает account SQL и
не выдаёт access/refresh. Корректный вход сохраняет существующий формат ответа.
Ранее выданные application sessions не отзываются этим изменением.

## Проверки

Два независимых baseline показывают реальный дефект на исходном wrapper:
локально подписанный чужому приложению токен принимается при отсутствующем
и пустом `APPLE_CLIENT_ID`. HTTP baseline использует уже связанный fixture
аккаунт и получает 200 вместо требуемого 503. Это синтетическая RSA/JWKS
демонстрация поведения реальной библиотеки, не реальный Apple token и не
измерение уязвимости production.

| Проверка | Фактический результат |
|---|---|
| Crypto baseline missing/empty audience | 2 ожидаемых FAIL, exit1; [before](evidence/IA01/crypto-before.txt) |
| HTTP baseline с реально связанным fixture user | 2 ожидаемых FAIL, exit1; [before](evidence/IA01/http-before.txt) |
| Crypto/config suite после guard | 42/42 PASS, exit0; [after](evidence/IA01/crypto-after.txt) |
| HTTP/SQLite suite | 28/28 PASS, exit0; [after](evidence/IA01/http-after.txt) |
| Полный `npm run check` на source commit | PASS, exit0: 82 suites / 1142 Jest; browser H01 4, H04 18, H02 11, persisted6; [лог](evidence/IA01/check-final.txt) |
| Полный disposable PostgreSQL regression | PASS, exit0: controls/A02/B03/B04/H04; F01/B02/D01 остаются known defects; [лог](evidence/IA01/postgres-final.txt) |
| Vercel APPLE_CLIENT_ID, active deployment binding | NOT_RUN, обязательный gate OPS-IA01 |
| Production login/smoke, физический Apple Sign-In | NOT_RUN; этот локальный run не проверяет реального provider/deployment |

Проверены отсутствующая/пустая/некорректная настройка, intended/wrong/missing/case
audience, issuer, expiry/nbf, подпись/алгоритм/key, malformed JWT, входные типы,
безопасные ошибки и восстановление. HTTP success использует существующего
связанного пользователя: реальные timestamp writes, подписанные application
токены и `/me` с выданным access token. SQL trigger срывает первую запись и
проверяет generic500/recovery; это не доказательство атомарности остальных
account-linking путей. Health/static/admin/password без Apple config проверены
на настоящем createApp. Неверные запросы не меняют снимки всех fixture tables.

[Команды](evidence/IA01/commands.txt), [runtime](evidence/IA01/runtime.json),
[независимый review](evidence/IA01/review.txt) и [манифест](evidence/IA01/manifest.json)
фиксируют фактические результаты и SHA256. Crypto/HTTP tests входят в обычный
Jest discovery и обязательный `npm run check`; отдельный флаг не нужен.
Предыдущие манифесты остаются историческими снимками, не переписаны.

Криптографические тесты подменяют только JWKS transport на синтетические
открытые ключи. Подпись, issuer, audience и срок проверяются настоящими
библиотеками; verifier spy вызывает оригинал. Cache signing keys сбрасывается,
чтобы no-network утверждение не скрывало ошибочный вызов verifier. Все сокеты
в utility tests запрещены. HTTP suite допускает только свой loopback listener,
подключает настоящий createApp/auth/account-linking и SQLite `:memory:`.

Это исправление не меняет схему/миграции. Независимость guard от engine
проверяется нулём SQL на отказах; production schema, Google/Apple сети и
физическое устройство в этих тестах не используются. Server entrypoint и `.env`
не запускались. Сохранена отдельная проверка app import без runtime resources.

## Обязательная карточка человека

Deployment condition — **NOT_RUN**. [OPS-IA01](PRODUCTION_ACCESS.md#ops-ia01--проверка-apple_client_id-человеком)
требует от Вадима/уполномоченного человека подтвердить intended audience в
переменных **Production** и его привязку к активному deployment. Само наличие
новой переменной в UI Vercel не доказывает, что её получил запущенный deployment.
Нельзя присылать token/private key/полный export env. Достаточны безопасные
project/deployment aliases, present/nonempty/matches/binding, дата/UTC.

Проверка этой переменной без запуска приложения/БД не расходует дополнительный
Neon compute. [Расчёт по публичному тарифу на 18 сентября](NEON_COST_ESTIMATE_2026-09-18.md)
отдельно показывает стоимость будущей короткой DB-проверки. Он не разрешает
боевой запрос, оплату, redeploy или миграцию. Боевая БД и сайт не запрашивались;
известный отказ квоты не перепроверялся, reminders выключены.

После локального завершения следующий независимый пункт R1 — ID01,
настройка сроков выдачи JWT. Gate OPS-IA01 и H02/DEV-15 остаются открытыми,
пока не получено фактическое человеческое evidence.
