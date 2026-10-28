# R2 schema — focused commands

Дата работы: 2026-09-19. Source commit: **PENDING** — эти focused runs выполнены
на рабочем дереве; exact source commit и окончательный manifest закрепляет root
после общего прогона. Исторические evidence не переписаны.

Рабочий каталог для команд:
`/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native/server`.

Первый завершённый набор из 35 schema checks использовал per-profile inspector
и explicit step roots, но ещё не включал найденный независимым review контроль
отключённых внутренних FK-триггеров и последнюю правку completion lineage.
Его исходный stdout/stderr скопирован без изменения из
`/private/tmp/reh-r2-schema-impl/repo-final-after.txt` в
`focused-schema-before-trigger-review.txt`.

```sh
env -i HOME=/Users/vadimfertik PATH=/Users/vadimfertik/.nvm/versions/node/v22.16.0/bin:/usr/bin:/bin TMPDIR=/private/tmp /Users/vadimfertik/.nvm/versions/node/v22.16.0/bin/node scripts/r0-postgres.mjs --r2-schema-only > /private/tmp/reh-r2-schema-impl/repo-final-after.txt 2>&1
```

Финальный focused run после узкого исправления FK enforcement и согласованных
per-profile completion fields:

```sh
env -i HOME=/Users/vadimfertik PATH=/Users/vadimfertik/.nvm/versions/node/v22.16.0/bin:/usr/bin:/bin TMPDIR=/private/tmp /Users/vadimfertik/.nvm/versions/node/v22.16.0/bin/node scripts/r0-postgres.mjs --r2-schema-only > /Users/vadimfertik/Desktop/reh_app/audit/evidence/R2-schema/focused-schema-after.txt 2>&1
```

Runner сам создаёт одноразовый локальный PostgreSQL 15 container, проверяет
локальный Docker context/ownership marker, разрешает только его loopback port
и созданные HTTP listeners, затем удаляет принадлежащий запуску container.
Production URL, текущий `.env` и production entrypoint не используются.

Исходное воспроизведение F01 находится в неизменённом
[R0 postgres-probes.txt](../R0/postgres-probes.txt): `42601` на `AUTOINCREMENT`.
Его исходные границы и хеши — в [R0 manifest.json](../R0/manifest.json).
Новый `42P10` negative control относится к явно созданной owned missing-index
fixture; он не утверждает, что старый mixed-dialect bootstrap работал на PG.
