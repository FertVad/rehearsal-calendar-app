# IS02 CI follow-up — завершение browser fixture

Дата: 19 сентября 2026. Ветка `codex/systematic-repair`.
Source commit: `573608cd47c24a605ccae00be0161545619caae7`,
tree `a0b9b38b6dff5db2b37bf40e08522e939b2f1dfd`.
Статус: **LOCAL_VERIFIED; REMOTE_CI_PENDING**.
Полные локальные проверки на этом source завершены; новый удалённый запуск ещё не подтверждён.

## Наблюдавшийся отказ

[Application checks 35427268043](https://github.com/FertVad/rehearsal-calendar-app/actions/runs/35427268043)
на `66246511b33062912679c9c3ea9289e1ccc05a51` завершился по существовавшему
лимиту job в 20 минут. Запуск не отменяли и не перезапускали при диагностике.

В журнале все **87 Jest suites / 1259 tests PASS** завершились в 06:43:07 UTC.
Первый admin DOM/CSP browser test завершился PASS в 06:43:08.612 UTC. Затем
вывод прекратился до автоматической отмены; второй test о CSP/assets/nonces
не сообщил результата. PostgreSQL job того же run прошёл. Журнал локализует
зависание внутри второго browser test либо его cleanup; он не раскрывает
конкретное оставшееся соединение Chromium.

Fixture регистрировала ожидание `server.close()` перед `context.close()`.
Браузерное preconnect-соединение может ещё не отправлять HTTP и удерживать
сервер открытым. Тогда закрытие контекста, которое освобождает его соединения,
не достигается. Этот порядок не менялся между IS01 и IS02.

На Node 22.16.0 выполнен исходный cleanup hook, извлечённый из неизменённого
файла, с настоящим loopback HTTP server и idle preconnect socket. Через 250 мс
cleanup оставался pending, следующий callback контекста не был достигнут;
desired regression завершился **exit 1**. После этого reproducer освободил
сокет и сервер. Таким образом подтверждён дефект завершения fixture и
правдоподобная причина CI-зависания, а не точная идентичность удалённого сокета.

## Исправление

Один cleanup сначала закрывает browser context, затем прекращает приём
соединений HTTP server и уничтожает только сокеты, принятые этой fixture.
Отслеживание начинается до `listen()`. Отказ или timeout контекста не пропускает
закрытие сервера; ошибки сохраняются в `AggregateError` и делают проверку красной.
Обе операции имеют deadline в 5 секунд, cleanup hook — 12 секунд.

Каждый из четырёх исходных browser tests имеет timeout 30 секунд и сообщения
о начале fixture, загрузке документа и этапах cleanup. DOM/CSP assertions,
буквальный вывод враждебных значений, nonce, login/pagination/status/logout
сценарии сохранены. Application/runtime код и названия required CI jobs
не менялись в этом follow-up.

Три новых helper tests проверяют настоящий idle preconnect, сохранение ошибки
контекста и ограничение зависшего context cleanup. Они включены в существующую
обязательную dashboard-стадию `server/scripts/test.mjs`: выполняются вместе с
четырьмя DOM/CSP tests через `npm test` обоих пакетов и `npm run check` приложения.

## Фактические проверки

| Проверка | Результат |
|---|---|
| Исходный cleanup с actual idle preconnect | Ожидаемый FAIL, exit 1; следующий context callback не достигнут |
| Первый локальный after запуск без пути подготовленного browser cache | 3 helper PASS, 4 browser hook FAIL: executable отсутствовал; журнал сохранён |
| Повтор с уже подготовленным pinned Chromium cache | **7/7 PASS, exit 0, 3325.93925 мс**; исходные 4 DOM/CSP + 3 cleanup |
| Независимый review root и adapter agent | Блокирующих замечаний нет |
| Полный `npm run check` на `573608c` | PASS, exit 0: scanner33, 88 suites/1270 Jest, dashboard7/admin-errors18/invite11/persisted6 |
| Полный PostgreSQL на `573608c` | PASS, exit 0: controls/A02/B03/B04/H04/IS02/R2_ADAPTER14/R2_STARTUP/F05; F01/B02/D01 остаются known defects |
| Новый GitHub Actions run | PENDING; удалённый PASS не заявлен |
| Production/deployment | NOT_RUN |

Локальный targeted запуск использовал Node 22.16.0, Playwright 1.62.1,
Chromium revision 1234, изолированные loopback listeners и синтетические данные.
После отсутствующего cache не скачивали новый браузер и не меняли assertions:
передали путь уже подготовленного pinned cache. Три проверявшихся файла совпадают
с последующим source commit; обязательное включение helper tests дополнительно
подтверждено полным прогоном на точном `573608c`. Полные логи принадлежат общей
проверке с R2 foundation: [check](evidence/R2-foundation/check-final.txt) и
[PostgreSQL](evidence/R2-foundation/postgres-final.txt).

[Исходный CI log](evidence/IS02-ci-followup/ci-check-35427268043.log),
[диагностика](evidence/IS02-ci-followup/diagnostic.md),
[before](evidence/IS02-ci-followup/before.txt),
[after](evidence/IS02-ci-followup/after.txt),
[команды](evidence/IS02-ci-followup/commands.txt),
[runtime](evidence/IS02-ci-followup/runtime.json),
[independent review](evidence/IS02-ci-followup/independent-review.txt).

Исторические отчёт, evidence и manifest IS02 не переписаны. Наличие этого
follow-up не меняет production-условия OPS-IS02, OPS-IA01 и ограничения доступа.
