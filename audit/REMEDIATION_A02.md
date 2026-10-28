# A02 — общий путь обработки асинхронных HTTP-ошибок

18 сентября 2026. Ветка `codex/systematic-repair`. Статус: **VERIFIED локально**.
База этапа: `d92cfbb`. Проверенный commit исходников:
**`7e1eefa035443478a04257a8069df9a960e2f829`**.
Отчёт и evidence фиксируются следующим коммитом документации. Код после
проверенного commit не менялся. Production, push и deploy не использовались.

## Правило и причина

Express 4 не обрабатывает отвергнутый Promise возвращённого async callback.
Ошибка `db.get` в общей аутентификации и ошибка bcrypt при неверном типе
admin password покидали цепочку HTTP middleware. При строгой политике Node
первый же отказ БД завершал процесс. В availability/bulk также были await и
обращения к полям до локального try/catch.

Контракт: ошибка асинхронной обработки завершается ограниченным по времени
HTTP-ответом и не уничтожает процесс. Неверные данные получают 400, неверные
credentials — 401, ошибки инфраструктуры — 5xx. Ошибка до авторизации не
допускает бизнес-записи. После восстановления зависимости запросы работают
без перезапуска. Ошибка после отправки headers передаётся стандартному handler
Express, без попытки отправить второе тело ответа.

## Реализация и совместимость

- Один `asyncHandler` охватывает **62 async callbacks в 12 route-модулях**, `authenticateToken`/`requireAuth`, `adminLogin` и три middleware rate limit. Он ловит sync throw и Promise rejection; не вызывает успешный `next()` автоматически, не перебрасывает уже переданную ошибку. Falsy/string rejection нормализуется в Error, чтобы не превратиться в Express `next('route')` или успешное продолжение.
- Общий `errorHandler` возвращает безопасный JSON без SQL, stack, тела запроса и `details`. Валидные parser 4xx сохраняются (например, 400/413); неожиданный отказ даёт 500. В собственный лог попадают только статус и ограниченный диагностический code. При `headersSent` используется `next(error)`.
- Admin login проверяет непустую строку до bcrypt. Режимы hash/plaintext, валидный вход, 401 неверного пароля и 503 отсутствующей конфигурации сохранены. DB/crypto failure не классифицируется как неверный пароль или истёкшая сессия.
- Обе availability/bulk точки проверяют массив и структуру entries до чтения timezone и записи: null/array/primitive entry и нестроковый startsAt отклоняются с 400. Полная схема дат/слотов и атомарность replacement остаются отдельным C02; его статус не изменён.
- Существующие локальные business error responses сохранены. AST-сравнение подтвердило, что в 11 route-модулях вне availability изменилось только подключение wrapper. Alias `requireAuth === authenticateToken` сохранён и проверяется существующим тестом.
- Добавлены 49 обычных Jest regressions, включая обход настоящего Express stack: новый голый AsyncFunction в mounted routes/middleware нарушит gate. Promise-returning обычные функции также требуют wrapper — это правило закреплено в [инструкции](../rehearsal-calendar-native/server/middleware/README.md).
- PG probe A02 теперь требует правильного ответа и восстановления; падение worker больше не принимается за успех. Отдельный CI job `postgres-a02` запускает этот контракт на одноразовом PostgreSQL. Нормальный `check` продолжает выполнять общие Jest и H01 browser проверки.

Миграция данных и новая сборка телефона для A02 не нужны. Форма успешных
API-ответов, JWT/session semantics и бизнес-операции не меняются. Изменение для
malformed input намеренное: контролируемый 400 вместо отказа обработки запроса.

## Фактические проверки

Среда: Node **22.16.0**, Playwright **1.62.1**, Chromium **151.0.7922.34**,
macOS arm64; PostgreSQL **15.13** в собственном Docker-контейнере.
Финальные команды выполнялись после source commit, с `env -i`, явно выбранным
Node и тестовыми путями. PG runner передаёт worker закрытый набор синтетических
переменных, запрещает внешние соединения, использует tmpfs и проверяет ownership
nonce. `.env` и настоящие DB credentials не загружались.

| Проверка | Результат | Evidence |
|---|---|---|
| Новые auth regressions на исходном production-коде | Ожидаемый FAIL: **12/12**, DB/bcrypt rejection покидает middleware, malformed input не получает 400 | [До](evidence/A02/auth-before.txt) |
| Новый desired-behavior PG regression до исправления | Ожидаемый FAIL, exit 1: реальная ошибка **42P01** завершает strict worker; parent не принимает crash за успех; контейнер удалён | [PG до](evidence/A02/postgres-before.txt) |
| Wrapper, terminal boundary, auth failures, полный inventory маршрутов | PASS, **38 тестов** | [Адресные проверки](evidence/A02/boundary-after.txt) |
| Настоящий HTTP app с контролируемой DB boundary | PASS, **11 тестов**: 500 без записи, recovery, malformed JSON400, large body413 без утечки, malformed entries400 на обеих точках до slot lookup/write | [HTTP](evidence/A02/http-after.txt) |
| PG после исправления, `--a02-only` | PASS: реальные ошибки auth GET/POST→500, health200 во время отказа, recovery200, неизменные снимки строк; timezone query error→500; malformed entries400; real bcrypt400/401/200 и пригодный admin JWT | [PG после](evidence/A02/postgres-after.txt) |
| Полный `npm run check` на **7e1eefa** | PASS, exit 0: type-check; **74 suites / 918 Jest tests** (518 frontend + 400 backend), browser **4/4**, persisted suite **6/6**, включая 5 DOM-сценариев | [Финальный check](evidence/A02/check-final.txt) |
| Полный PG runner на **7e1eefa** | PASS, exit 0: controls и **A02 PASS**, B02/D01/F01 всё ещё **KNOWN_DEFECT_REPRODUCED** | [Финальный PG](evidence/A02/postgres-final.txt) |
| Независимый review committed diff | Блокирующих замечаний не найдено: wrapper/next, auth classification, safe errors, input guards, PG/CI portability; review без повторного запуска тестов | [Review](evidence/A02/review.txt) |

Обычные success/401/403, JWT revocation и успешные mutations покрыты существующими
тестами и реальными PG controls. После отказа проверены повторные запросы и
восстановление, а отдельная SQL connection сверяет строки всех таблиц fixture.
Новых durable writes/transactions/background jobs этот механизм не добавляет.
Frontend lint не повторялся: проверяемый им `src/` не изменён; изменённый backend
прошёл синтаксический разбор, адресные и общие runtime проверки.

Все собственные PG-контейнеры удалены; контрольный поиск по label пуст.
[Манифест](evidence/A02/manifest.json) привязывает исходники/конфигурацию и логи
к source commit и git tree. Хеши исходников сверены с диском и `git show`.
Ранние адресные прогоны выполнены до source commit; окончательные check/PG — на
зафиксированном коде. Исторические manifests R0/H01 не переписываются под новый HEAD.

## Ограничения и следующий шаг

- GitHub Actions на удалённом runner — **NOT_RUN**: добавлена конфигурация, ветка не отправлялась. CI использует локальный Unix Docker socket; image pull виден отдельным шагом. Политика required checks на GitHub не менялась.
- Production и deployment smoke — **NOT_RUN**. При будущем тестовом выпуске проверить valid/invalid login, контролируемый отказ тестовой БД и восстановление; сбой нельзя вносить в боевую БД ради проверки.
- Физическое устройство для этого серверного исправления не требуется. Старый клиент проверен на уровне сохранения HTTP/JWT-контрактов и существующих frontend tests, не живой установленной сборки.
- Wrapper не перехватывает detached timers/callbacks/background promises. Такие операции должны иметь собственную lifecycle/error policy; в обследованных route callbacks подобных отделённых обещаний не найдено.
- Остальные 100 findings, включая C02 и A03, остаются открыты. Общие local catch blocks ещё не унифицированы по логированию и валидации; этот этап не объявляет все ошибки приложения безопасными.
- Следующий отдельный пункт R1: **B03**, ограничение диапазона дат и проверка прав до дорогостоящих вычислений.
