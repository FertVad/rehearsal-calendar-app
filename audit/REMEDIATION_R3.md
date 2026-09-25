# R3 — доверие к аккаунту и credentials (A01/A03/A04/AC05/HP01/HP02)

**Статус: IN_PROGRESS.** Ветка `claude/systematic-repair`. 25.09.2026 владелец выбрал
подтверждение адреса письмом («подключаем почту»). Ниже — контракт пакета; отчёт о
проверках добавляется по мере закрытия находок.

## Ход работ (на 25.09)

| Что | Коммит | Проверено | Не сделано |
|---|---|---|---|
| A03 + серверная часть HP01/HP02 | `9a702ba` | route-тест 22, на прежнем коде 16 красных; серверный Jest | PG-прогон; клиент (HP02 шлёт `undefined`, пароль 8+ в UI) |
| A04 | `6320743`, `5a314e9` | route-тест 5, на прежнем коде 5 красных; серверный Jest | гонка двух отвязок на PostgreSQL |
| Схема группы 010 | `0d0bb2d` | R2_SCHEMA и R2_MIGRATIONS на PG 15.13 | — |
| Почта, коды, потоки A01/HP01, клиент, AC05 | — | — | всё; ждёт OPS-EMAIL для настоящей отправки |

Коммиты `6320743` и `ea6e1f6` ушли с красной проверкой (Jest и сканер секретов);
исправлены следующими коммитами `5a314e9` и `daa981a`, цепочка коммита теперь
зависит от результата.

## Контракт

### Почта

- Провайдер Resend: HTTP API через встроенный `fetch`, без новой зависимости.
  Транспорт выбирается окружением: `EMAIL_TRANSPORT=resend` с `RESEND_API_KEY` и
  `EMAIL_FROM`; в тестах — `capture` (письма в памяти, сеть не трогается). Без
  настроенного транспорта регистрация, повтор кода и сброс пароля отвечают 503
  `EMAIL_UNAVAILABLE`, ничего не создавая.
- Письмо содержит 6-значный код: 15 минут, 5 попыток, один живой код на пару
  (пользователь, цель). Повтор — не чаще раза в минуту и не больше 5 в час. В базе
  хранится HMAC кода, не сам код.
- Отправка — после COMMIT. Результат (`sent_at` / `failed_at`) записывается в строку
  кода и возвращается клиенту; повтор — отдельным запросом. Письмо не часть
  транзакции и не выдаётся за доставленное.
- Язык письма — `locale` пользователя (en/ru/es/de).

### Состояние адреса

- `native_email_identities(user_id, email, status pending|verified, verified_at,
  verified_by code|google|apple)` и `native_email_codes`. Новая группа таблиц «010»:
  во fresh-снимке сразу, в существующей базе — шагом мигратора
  `010-email-verification`.
- Нет строки identity — аккаунт создан до R3 («legacy»): работает как раньше, но его
  адрес не считается доказанным. Массовой отметки verified нет.

### Регистрация и вход (A01)

- `POST /auth/register` от нового клиента несёт `verification: 'code'`. Пользователь,
  пароль, строка провайдера email, identity `pending` и код создаются одной
  транзакцией. Ответ 201 `{ status: 'verification_required', delivery }` без
  токенов: pending-аккаунт не получает сессию.
- Без `verification` — 400 `CLIENT_UPGRADE_REQUIRED` до любой записи: старая версия
  приложения показывает текст ошибки вместо «Registration failed» над уже созданным
  аккаунтом.
- `POST /auth/verify-email { email, password, code }`: пароль и код вместе, так что
  подтверждается именно владелец пароля. Успех — identity verified и токены.
  `POST /auth/verify-email/resend { email, password }` — повтор.
- `POST /auth/login`: pending-аккаунт после верного пароля получает 403
  `EMAIL_NOT_VERIFIED`; legacy и verified входят как раньше.

### Google / Apple (A01)

- Провайдер уже привязан — вход. Адрес совпал с verified-аккаунтом — привязка.
- Адрес совпал с pending или legacy аккаунтом с паролем: пароль не доказан. Одной
  транзакцией: `password_hash = NULL`, строка провайдера email удаляется,
  `token_version + 1` (все старые сессии), провайдер привязывается, identity —
  verified по провайдеру. Ответ несёт `passwordRevoked: true`.
- Legacy-аккаунт без пароля (только другой OAuth) — привязка как раньше.

### Сброс пароля — возврат занятого адреса

- `POST /auth/password-reset/request { email }` всегда отвечает 202; код уходит, только
  если адрес существует.
- `POST /auth/password-reset/confirm { email, code, newPassword }`: новый пароль,
  identity verified (code), `token_version + 1`, токены. Так владелец ящика забирает
  адрес, занятый кем-то с паролем.

### Смена email (HP01)

- `PUT /auth/me` с другим `email` — 400 `EMAIL_CHANGE_REQUIRES_VERIFICATION`, а не
  молчаливое «сохранено»; совпадающий с текущим email игнорируется (старые клиенты
  шлют его вместе с именем).
- `POST /auth/me/email/change { newEmail, currentPassword }` — код на новый адрес;
  `POST /auth/me/email/change/confirm { code }` — email, identity и провайдер
  обновляются одной транзакцией, другие сессии отзываются, на старый адрес уходит
  уведомление.

### Пароль, способы входа, профиль (A03/A04/HP02)

- Пароль: 8–72 байта UTF-8, не из одних пробелов. `PUT /me password` требует
  `currentPassword`, если пароль уже есть; первый пароль OAuth-аккаунта — только при
  verified адресе.
- Способы входа считаются по реальным credentials: email — это `password_hash`,
  google/apple — строки провайдера. Отвязка идёт в транзакции с `SELECT … FOR
  UPDATE` пользователя, так что две конкурентные отвязки не снимают последний способ.
- Профиль: имя 1–100 символов, фамилия ≤100 или пусто (HP02: `''` и `null`
  очищают), телефон ≤50, `locale` ∈ en/ru/es/de, `timezone` — существующая IANA-зона,
  флаги — только boolean. Неверное значение — 400, а не 500 где-то дальше.

### Клиент (AC05 и экраны)

- Экраны: ввод кода после регистрации и при входе pending-аккаунта, «Забыли пароль»,
  смена email; поле email в профиле — только чтение с кнопкой смены.
- AC05: токены в `expo-secure-store` с одноразовой миграцией из AsyncStorage и
  очисткой. Это нативный модуль — нужна новая сборка и проверка на устройстве.

### Совместимость и выкладка

- Сервер выкладывается раньше клиента. Старые версии продолжают входить;
  регистрация в них отвечает «обновите приложение».
- В production нужны таблицы группы 010 вместе с 007/008 (B03/B04) — через
  OPS-R2-ADOPT и `--apply`.

## Решения по умолчанию

Владелец может изменить любое:

1. Код в письме, а не ссылка: не нужны universal links, код можно прочитать на
   ноутбуке и ввести на телефоне.
2. Старые аккаунты не блокируются и не отмечаются подтверждёнными.
3. Вход Google/Apple в неподтверждённый аккаунт с паролем снимает этот пароль и все
   сессии: иначе закрыть A01 нельзя. Законный владелец восстанавливает пароль через
   «Забыли пароль».
4. Регистрация в старых версиях приложения закрыта до обновления.

## Карточки владельцу

**OPS-EMAIL** — завести Resend и подключить домен:

1. resend.com → бесплатный план.
2. Domains → Add Domain → `rehearsly.me`; внести выданные DNS-записи (SPF, DKIM)
   там, где хостится DNS домена, и добавить `_dmarc.rehearsly.me` TXT
   `v=DMARC1; p=none;`. Дождаться статуса Verified.
3. API Keys → Create → доступ «Sending», домен `rehearsly.me`.
4. Vercel → Environment Variables (Production): `EMAIL_TRANSPORT=resend`,
   `RESEND_API_KEY=<ключ>`, `EMAIL_FROM=Rehearsly <no-reply@rehearsly.me>`. Ключ не
   присылать в чат и не класть в репозиторий.

**OPS-R3-DATA** — только чтение, одна строка ответа:

```sql
SELECT (SELECT count(*) FROM (SELECT lower(trim(email)) FROM native_users GROUP BY 1 HAVING count(*) > 1) d) AS case_duplicate_emails, (SELECT count(*) FROM native_users WHERE email <> lower(trim(email))) AS non_normalized_emails, (SELECT count(*) FROM native_users WHERE password_hash IS NOT NULL) AS password_accounts, (SELECT count(*) FROM native_users u WHERE u.password_hash IS NOT NULL AND EXISTS (SELECT 1 FROM native_auth_providers p WHERE p.user_id = u.id AND p.provider_type IN ('google', 'apple'))) AS password_with_oauth, (SELECT count(*) FROM native_users) AS users;
```

`case_duplicate_emails = 0` разрешает искать адрес без учёта регистра и добавить
уникальность по `lower(email)`; иначе нужна отдельная политика для пар.
