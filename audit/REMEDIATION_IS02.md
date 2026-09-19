# IS02 — общие бюджеты auth/admin между процессами

Дата: 19 сентября 2026. Ветка `codex/systematic-repair`.
База: `a67d6715165fa1056b145a2d9d93d70a643baeca`.
Статус: **READY_FOR_CHECK** — локальная реализация и проверки завершены;
deployment-условия [OPS-IS02](PRODUCTION_ACCESS.md) остаются NOT_RUN.
Проверенный source commit: `61ced139d1055150298b204c20a4ddd807967d77`,
tree `5226fbd653f9d563c38d5c02d7b3e36dd39d6dec`.
Основная реализация: `bc0184e93ba8732882204aa0db46cb479d511913`;
последующий commit исправляет проверку native SQLite error и фиксирует решение
Вадима о PostgreSQL runtime. Runtime между этими двумя commit не менялся.

## Правило и реализация

Все методы под `/api/auth` расходуют общий бюджет 20 запросов за 60 секунд;
под `/admin/api/login` — 5 за 900 секунд. Первое допущенное обращение задаёт
конец окна по времени БД с точностью до секунды. Отдельные процессы и перезапуск
не создают новый бюджет. Ответ 429 сохраняет сообщения, rate headers и Retry-After.
Счётчики насыщаются на limit+1; отказ хранилища возвращает общий 503.

Ключ — HMAC от namespace и нормализованного IP; сырые IP в таблицы не попадают.
IPv4-mapped адреса и IPv6 /56 используют прежнее правило B04. Все экземпляры
должны иметь общий PostgreSQL, одинаковый стабильный signing secret и корректный
доверенный ingress для `trust proxy = 1`. Смена secret меняет ключи; локальные
тесты не подтверждают конфигурацию реального deployment.

Каждое допущение — отдельная транзакция до account/crypto работы. Существующий
ключ обновляется атомарно без allocation gate. Для нового ключа gate блокируется,
ключ проверяется повторно, удаляется не более 64 истёкших строк и проверяется
лимит 10 000 ключей на namespace. Удаление, корректировка gate, вставка и увеличение
gate фиксируются вместе. Внешний expiry predicate сохраняет строку, обновлённую
конкурентным запросом во время ожидания prune. Старый statement не сокращает
уже обновлённое окно.

PostgreSQL admission получает локальные lock timeout 1 с и statement timeout 2 с.
HTTP ждёт не более 3 с; поздний результат не запускает обработчик, повтор или
возврат бюджета. Этот HTTP deadline не отменяет очередь connection pool:
позднее списание возможно. Ограничение ресурсов общего adapter относится к R2.
Это защита бизнес-операций, а не общий лимит всего входящего трафика.

MemoryStore на этих mounts удалён; тестового обхода limiter нет. Создание app и
middleware не подключается к БД. Production и настроенный PostgreSQL не могут
использовать SQLite для этих бюджетов. SQLite здесь — последовательная test fixture;
утверждения о процессах, блокировках и гонках основаны на реальном PostgreSQL.

Public HTML, association files, invite fallback и liveness не обращаются к
новому limiter. **Стартовый отказ всей Vercel-функции пока не исправлен:**
`server.js` всё ещё ждёт старый adapter до сборки app. Это отдельная работа R2.

## Схема и выпуск

Новая additive migration009 создаёт две таблицы, проверяемые ограничения и
два namespace gate. Повторное применение сохраняет существующие бюджеты.
Определения в bootstrap синхронизированы, но сам bootstrap всё ещё содержит F01.
Исторические миграции не переписаны. До будущего deployment нужны 007/008/009;
production schema/ledger неизвестны, текущий migration runner не следует
применять к ним до исправления R2 и отдельного решения Вадима.

## Проверки

| Проверка | Фактический результат |
|---|---|
| До исправления: два реальных createApp | 2 ожидаемых FAIL: auth 20+20 вместо общего20; admin 5+5 вместо общего5; business rows неизменны |
| HTTP, service, middleware, IA01/ID01 | 5 suites / 91 PASS; настоящие SQLite SQL, bcrypt/JWT, контролируемые только специальные seams |
| App import, async/error/public boundaries | 4 suites / 19 PASS |
| Первый полный прогон на bc0184e | 1 FAIL из1259: realm-sensitive Jest matcher; браузерные стадии не запускались |
| Диагностика HTTP→service | Реальная rejection `SQLITE_CONSTRAINT_TRIGGER`, но native error не instanceof Error текущего VM; исходный matcher воспроизведён |
| После исправления matcher | Та же совместная пара 50/50 PASS; exact code/message, rollback snapshots и восстановление сохранены |
| Полный npm run check на61ced139 | PASS, exit0: scanner33, 87 suites /1259 Jest, admin4/admin-errors18/invite11/persisted6 |
| Полный одноразовый PostgreSQL на61ced139 | PASS, exit0: controls+A02/B03/B04/H04/IS02; F01/B02/D01 по-прежнему KNOWN_DEFECT_REPRODUCED |
| Production | NOT_RUN; OPS-IS02, OPS-IA01 и deployment smoke открыты |

PostgreSQL matrix проверяет независимые процессы и cold restart, точные20/5,
contention одного ключа, последнее свободное место из10 000, отдельные namespaces,
ровно64 из65 истёкших строк, настоящий rollback trigger и сохранность business rows.
Гонки подтверждены наблюдаемыми PostgreSQL lock waits, а не только задержками.
Для таймаутов проверены SQLSTATE55P03/57014, завершение SQL до оценки результата,
неизменный счётчик после снятия fault и успешное восстановление. Положительные
auth/admin сценарии выдают реальные JWT, используемые на защищённых маршрутах.
Cleanup errors не скрываются; worker при потере родителя завершается с ошибкой.

Первый неуспешный full log сохранён вместе с исправлением. Проверка не была
удалена: `.rejects.toThrow()` заменён на точный код и сообщение native error,
поскольку конструктор better-sqlite3 может принадлежать предыдущему Jest VM.
Независимый review охватил runtime, HTTP/fixtures, SQL/гонки и это исправление.

[Команды](evidence/IS02/commands.txt), [runtime](evidence/IS02/runtime.json),
[полный check](evidence/IS02/check-final.txt), [PostgreSQL](evidence/IS02/postgres-final.txt),
[review](evidence/IS02/review.txt), [манифест](evidence/IS02/manifest.json).

## Остаточные условия и следующий этап

Gate count предполагает корректную исходную схему и соблюдение протокола всеми
writers; произвольная внешняя порча счётчика внутри допустимого диапазона не
обнаруживается обычной O(1) проверкой. Topology, secret consistency и будущий
deployment smoke требуют OPS-IS02. До них conditional finding не VERIFIED.

R1: все10 пунктов реализованы локально, 7 VERIFIED и3 READY_FOR_CHECK
(H02/DEV-15, IA01/OPS-IA01, IS02/OPS-IS02). Это не закрывает release gates.
По поручению Вадима независимая локальная работа продолжается в R2:
PostgreSQL-only adapter, старт при отказе БД, затем provisioning/миграции.
SQLite остаётся только в изолированных тестах — решение Вадима от19 сентября.
Напоминания и deployment ветки выключены. Проверки IS02 расходовали $0 Neon;
[оценка по сегодняшним тарифам](NEON_COST_ESTIMATE_2026-09-19.md) вынесена отдельно.
