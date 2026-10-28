# H04 — правдивые ошибки, повтор и смена статуса в admin

Дата: 18 сентября 2026. Ветка `codex/systematic-repair`.
Статус: **VERIFIED локально**. Source commit:
`7ab1e414c73374df9bbd6c3cafd5a4029f4cc293`, tree
`f73cab2193a00bcaef7f39c2c2c986aeb0ea2c94`.
База: `23510b07a5b95789a76d01553307e104477cd1b7`.

## Исправленный контракт

Статистика, пользователи и обращения отдельно показывают загрузку, ошибку и
Retry. Сбой обновления сохраняет последние подтверждённые данные с явным
предупреждением об их давности. Неудачный переход страницы не меняет текущую
страницу; Retry повторяет именно неудавшийся запрос. Проверяются HTTP status,
JSON и форма ответа. Строки API остаются текстом, строгая CSP сохранена.

GET и PATCH проходят один HTTP/session guard. У разделов есть номера запросов,
у сессии — отдельное поколение. Отмена запроса дополняется проверкой поколения
после каждого await: старый 200, 401 или PATCH не меняет новый экран даже после
повторного входа с тем же JWT. Logout/актуальный 401 очищают старый DOM. Смена
токена в другой вкладке инвалидирует старую работу и сохраняет новый shared token.

Во время PATCH кнопки строки заблокированы. Статус не меняется оптимистически.
Успех принимается только по `{success:true}`. При потерянном/ошибочном ответе
интерфейс сообщает, что запись могла сохраниться, и предлагает ручное чтение;
он не отправляет PATCH повторно автоматически. Успешный GET другой страницы
не снимает неопределённость: должна вернуться именно изменявшаяся запись.
Подтверждённая запись и ошибка последующего GET показаны раздельно. Завершённые
уведомления не накапливаются после следующих чтений/изменений.

Сервер тоже перестал выдавать ложный успех: ID проверяется как положительный
int4, статус — как допустимое строковое значение. Аутентификация предшествует
валидации/SQL. Один `UPDATE ... RETURNING id` подтверждает существование
изменённой строки; отсутствующее или уже удалённое обращение даёт 404,
некорректный ID/body — 400. Повтор того же допустимого статуса успешен.
Отдельного SELECT перед UPDATE нет, поэтому между ними нет окна удаления.
Миграция для H04 не требуется.

## Проверки

До исправления исходные browser reproducer дают два ожидаемых FAIL:
невидимая ошибка GET и скрытая ошибка PATCH; API reproducer — ещё два FAIL
на ложном успехе для отсутствующей записи и некорректного ID. Логи сохранены
как историческое воспроизведение на базе, а не как полный исходный test suite.

| Проверка | Фактический результат |
|---|---|
| Browser reproducer до исправления | 2 ожидаемых FAIL, exit1; [before](evidence/H04/browser-before.txt) |
| API reproducer до исправления | 2 ожидаемых FAIL, 28 не выбраны фильтром, exit1; [before](evidence/H04/api-before.txt) |
| Расширенные browser scenarios | 18/18 PASS, exit0; [after](evidence/H04/browser-after.txt) |
| Реальные admin/SQLite handlers | 30/30 PASS, exit0; [API](evidence/H04/api-after.txt) |
| Полный `npm run check` на source commit | PASS, exit0: 80 suites / 1072 Jest, H01 browser4, H04 browser18, H02 invite11, persisted browser6; [лог](evidence/H04/check-final.txt) |
| Полный disposable PostgreSQL на source commit | PASS, exit0: controls/A02/B03/B04/H04; F01/B02/D01 остаются known defects; [лог](evidence/H04/postgres-final.txt) |
| Deployment smoke | NOT_RUN |

Проверены GET network/HTTP/non-JSON/malformed JSON/schema errors, retry каждого
раздела, stale-данные, pagination и ответ старого запроса после нового; PATCH
pending, HTTP/network/malformed ACK, запись с потерянным ответом, успешная запись
с последующим отказом GET, текущий 401 и запоздалые ответы прежней сессии с тем
же токеном. Две настоящие вкладки проверяют storage logout/login без синтетической
подмены storage event. Для гонок отдельный transport fixture намеренно не отменяет
запрос: это проверка generation guard, а не предположение об эффективности abort.

Скриншоты [stale/error](evidence/H04/admin-stale-error.png) и
[неподтверждённой записи](evidence/H04/admin-unconfirmed-write.png) проверены
визуально. Первый перезаписан финальным прогоном; второй снят перед commit с
тем же содержимым UI/test source. [Команды](evidence/H04/commands.txt),
[runtime](evidence/H04/runtime.json), [review](evidence/H04/review.txt) и
[манифест](evidence/H04/manifest.json) связывают проверки с commit и SHA256.
Исторические манифесты предыдущих пунктов не изменялись.

Browser fixture использует настоящие HTML/assets/CSP и пользовательские
действия. Ответы API и запись в нём синтетические. Реальная запись проверена
отдельно настоящими admin handlers и SQL в SQLite и PostgreSQL: независимые
снимки всех fixture business tables, отсутствие SQL при отказе auth/input,
404 после удаления, повтор записи, int4 boundary, ошибка SQL/trigger rollback,
500 без внутренних деталей и восстановление после отказа. PostgreSQL harness
не является проверкой фактической production schema.

H04 browser suite входит в обычные `npm test` и `npm run check` приложения и
сервера независимо от Jest filename filters. `test:admin-browser` запускает H01
и H04; `test:admin-errors-browser` — только H04. Изолированный H04 PostgreSQL
доступен через `--h04-only`; общий runner и CI `--security-only` включают его.

## Границы и продолжение

Production smoke — NOT_RUN. Ни Neon, ни `rehearsly.me`, ни Vercel env не
запрашивались; `.env` и production entrypoint не запускались. Напоминания
выключены, расписания не добавлялись. Push этой же ветки/CI уже разрешены;
её Vercel autodeploy остаётся отключённым. Физическое устройство не является
условием этого admin web finding; обязательная DEV-15 для H02 остаётся открытой.
H03 (смысл churn), native session findings и соседние IDs здесь не закрываются.

Следующий пункт R1 — IA01: локальный fail-closed Apple audience guard и
криптографические contract tests. Проверка фактического APPLE_CLIENT_ID в Vercel
остаётся отдельной карточкой человека OPS-IA01 и требует решения Вадима.
