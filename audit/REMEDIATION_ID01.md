# ID01 — проверенная конфигурация срока JWT

Дата: 18 сентября 2026. Ветка `codex/systematic-repair`.
База: `33dd698313266359b00e43f81316b85d3bd9bf4e`.
Статус: **VERIFIED локально**. Source commit
`e6b06b6e88da7f8db4a7e72e458b49190827e3ca`, tree
`9a88eb079758eee9bb5c3b54d6cda9cf791f6055`.

## Правило и реализация

Все шесть путей выдачи пользовательской сессии используют прежний
`generateTokens`: register, password/Google/Apple login, refresh и password
change. Он теперь получает проверенные числовые секунды из чистого
`config/tokenTtl.js`. Дублирующие константы `30d`/`90d` удалены из middleware.

`JWT_EXPIRES_IN` и `REFRESH_TOKEN_EXPIRES_IN` принимают положительное целое
число с явной единицей `s`, `m`, `h` или `d`; внешние пробелы обрезаются.
Defaults 30d/90d применяются только при отсутствии переменной. Пустота,
unitless number, знак, дробь, неподдерживаемая единица и переполнение — ошибка.
Число должно точно представляться в секундах и миллисекундах; это техническая
граница численной точности, не новый продуктовый максимальный срок сессии.

Refresh должен жить дольше access: текущий клиент обращается к refresh лишь
после 401 истёкшего access. Значения проверяются и фиксируются при импорте
middleware, до выполнения handlers и их записей в БД. Ошибка конфигурации
останавливает инициализацию приложения с именем настройки, без её значения.
Нельзя переносить этот guard только внутрь generateTokens: некоторые handlers
пишут в БД до вызова выдачи токенов.

В `jwt.sign` передаются **numbers в секундах**. Простая передача env string
была бы ненадёжной: jsonwebtoken трактует строку без единицы как миллисекунды.
Подпись, claims userId/tv/type, ответ `{accessToken,refreshToken}`, проверки
token_version и отдельная admin token policy сохранены.

Настройки вступают в силу после restart/new deployment и действуют только на
новую выдачу, включая refresh. Старые токены продолжают жить до собственного
подписанного `exp`, если не отозваны прежним механизмом. Нового maxAge,
массового logout, one-time refresh или абсолютного срока сессии здесь нет.

## Проверки

Baseline устанавливает 15m/7d до импорта middleware, подписывает реальные
токены и проверяет `exp - iat`. Исходный код выдаёт 2592000/7776000 вместо
900/604800 секунд; [before](evidence/ID01/before.txt) сохраняет ожидаемый FAIL.

| Проверка | Фактический результат |
|---|---|
| Baseline custom TTL | 1 ожидаемый FAIL, exit1; [лог](evidence/ID01/before.txt) |
| Целевые middleware/config и HTTP suites | 59/59 PASS, 2 suites, exit0; [лог](evidence/ID01/after.txt) |
| Полный `npm run check` на source commit | PASS, exit0: 84 suites / 1201 Jest, browser H01 4 / H04 18 / H02 11 / persisted6; [лог](evidence/ID01/check-final.txt) |
| Полный disposable PostgreSQL | PASS, exit0: controls/A02/B03/B04/H04; F01/B02/D01 по-прежнему known defects; [лог](evidence/ID01/postgres-final.txt) |
| Production configuration/deploy/smoke | NOT_RUN |

Проверены defaults и отдельные overrides, явные единицы и численная граница,
неверные/пустые значения, capture once, отказ module/app import до SQL,
фактические подписанные `exp - iat`, отказ в точную секунду `exp`, типы токенов,
совместимость старых сроков и прежняя проверка версии отзыва. Один настоящий
`/auth/refresh` получает 10-дневный токен со старым 90d сроком и выдаёт пару
15m/7d; новый access принят `/me`. SQLite user snapshot не меняется, refresh
не пишет в БД. Отозванный, истёкший или access вместо refresh дают 401.

Обе suite входят в обычный Jest discovery и обязательный check без флага.
[Команды](evidence/ID01/commands.txt), [runtime](evidence/ID01/runtime.json),
[независимый review](evidence/ID01/review.txt) и [манифест](evidence/ID01/manifest.json)
фиксируют commit, реальные exit codes и hashes. Предыдущие evidence не менялись.

## Границы и продолжение

Производственные переменные не читались и не менялись, `.env` и entrypoint
не запускались. Применение новой TTL policy в production — отдельное решение
при deployment. При будущем выпуске явно пустые/неверные значения потребуют
исправления или удаления; успешные локальные defaults не подтверждают Vercel env.
Настоящая БД не нужна для проверки арифметики/подписи; HTTP использует изолированную
fixture. Миграций для ID01 нет, напоминания остаются выключенными.

Следующий локальный пункт R1 — IS01, корректность и отказоустойчивость secret
scanner. H02/DEV-15 и IA01/OPS-IA01 остаются отдельными открытыми gates.
