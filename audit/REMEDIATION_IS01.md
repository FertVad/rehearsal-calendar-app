# IS01 — проверяемый secret scanner для Git-снимка

Дата: 19 сентября 2026. Ветка `codex/systematic-repair`.
База: `41ee618b010f9ef94db5614c57b1c9af1542b77e`.
Статус: **VERIFIED локально**. Source commit `4044e3d86ea98e5c3ac92a8094b6940207eee365`,
tree `5b98d82d028185db15c084fe64e2bba07d4a0b4e`.

## Контракт

Сканер проверяет установленные семейства правил как JavaScript regular
expressions, без зависимости от диалекта grep платформы. Default/--worktree
читает текущие версии индексированных файлов всего Git root; --staged читает
именно stage-0 blobs. Untracked файлы и история Git вне области проверки.
Успешный результат не означает отсутствие всех возможных секретов.

NUL-разделённые метаданные сохраняют пробелы, переводы строк, двоеточия и
начальный дефис в именах. Ошибка Git/чтения, неразрешённый merge или неподдержанный
тип файла не превращаются в PASS. Метаданные запрещённых tracked env/key файлов
проверяются до чтения их содержимого; собственный production .env не читается.

Вывод finding содержит JSON-escaped path, номер строки и rule ID, без строки
кода, значения или текста ошибки внешней команды. Коды завершения: 0 — полный
проход без findings, 1 — findings, 2 — неполная проверка/ошибка конфигурации.

Markdown, tests, audit evidence и .env.example не исключены целыми категориями.
Известные ложные совпадения допускаются только по точным path/rule/SHA256 полной
логической строки и описанию проверенного происхождения. LF разделяет строки;
один завершающий CR убирается для CRLF. Другие байты остаются значимыми.
Исторические отчёты и манифесты не переписаны ради зелёного результата.
Проверены 22 точечных исключения: 21 существующий synthetic/template/empty/regex
пример и одна новая команда изолированной IS01 проверки; каждый hash совпал
с одной конкретной строкой. Независимый review подтвердил происхождение.

В staged-режиме политика исключений внутри Git root тоже читается из индекса.
Незастейдженное исключение не может разрешить staged-секрет. Внешняя копия CLI
использует соседнюю политику как конфигурацию самого доверенного инструмента.

Файлы больше 64 MiB, metadata больше 32 MiB и policy больше 1 MiB дают exit2.
Worktree проверяет inode и путь до чтения и обнаруживает подмену из воспроизведения,
но не является атомарным FS snapshot или полной защитой от враждебного процесса,
непрерывно меняющего каталоги. Для commit проверяются immutable staged blobs.
Исполняемый CLI остаётся предметом обычного code review.

## Включение проверок

Обычные application/server npm test запускают отдельную Node CLI suite
независимо от Jest discovery/filters; npm run check сначала сканирует рабочее
дерево, затем запускает прежние typecheck и tests. GitHub Application checks
использует этот же check. npm run precommit явно проверяет staged-снимок;
это ручная команда, установленного Git hook она не создаёт.

## Проверки и доказательства

| Проверка | Результат |
|---|---|
| Исходный scanner: JWT20 и отсутствующий indexed file | 2 ожидаемых FAIL, exit1; оба ошибочно вернули0; [before](evidence/IS01/before.txt) |
| Полная synthetic CLI matrix | 33/33 PASS, exit0; [after](evidence/IS01/after.txt) |
| Полный npm run check на source commit | PASS, exit0: scanner33, 84 suites/1201 Jest, admin4/admin-errors18/invite11/persisted6; [лог](evidence/IS01/check-final.txt) |
| Реальный worktree scan в полном check | 604 indexed files, findings0/errors0 |
| Реальный staged scan source commit | 604 indexed files, findings0/errors0, exit0; [лог](evidence/IS01/staged-final.txt) |
| Production/устройство | N/A для development scanner; ничего не запрашивалось |

CLI tests создают настоящие одноразовые Git repositories и запускают wrapper.
Проверены все семейства, длины 19/20 и 7/8, case, бинарные байты, необычные имена,
root/subdirectory scope, staged/worktree в обе стороны, удаления, конфликты,
недоступные/испорченные объекты, unsupported modes, Git/read failures и redaction.
Строгая policy schema отклоняет malformed/duplicate keys/entries, невалидный hash,
неизвестное правило, пустую причину и попытку разрешить sensitive filename.
Проверены full-line raw-byte SHA256, CRLF, отдельный CR, Unicode/invalid UTF-8 bytes,
изменённая строка/путь/другое правило и staged policy consistency.

Независимый review обнаружил гонку ancestor symlink между realpath и lstat/open.
Теперь ожидаемый inode фиксируется до проверки пути, descriptor и путь сверяются
ещё раз до чтения. Regression синхронно выполняет подмену synthetic filesystem
через preload barrier, требует barrierTriggered=true, exit2 и отдельно
outsideReadAttempts=0; одного отказа после чтения недостаточно.

[Команды](evidence/IS01/commands.txt), [runtime](evidence/IS01/runtime.json),
[review](evidence/IS01/review.txt), [манифест](evidence/IS01/manifest.json).
До фиксации документации дополнительно проверяется staged-снимок с самим отчётом;
это не переписывает результаты source-only прогона выше.

## Границы

IS01 не меняет runtime сервера, схему БД или deployment. Production-доступ
не требуется. Полный PostgreSQL набор уже прошёл на ID01; его локальный повтор
для замены development scanner не является необходимым. Удалённый отдельный
PG job остаётся обязательным в прежнем workflow. Напоминания выключены.

Следующий пункт R1 — IS02: общий бюджет auth/admin запросов между процессами.
H02/DEV-15 и IA01/OPS-IA01 остаются открытыми человеческими проверками.
