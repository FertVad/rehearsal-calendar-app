# R2 foundation и browser cleanup — remote CI PASS

19 сентября 2026. [Application checks 35429218754](https://github.com/FertVad/rehearsal-calendar-app/actions/runs/35429218754)
завершился **success** на
`8e206b250a5e8c3e8c47ca7b9fd80c9eaf32c6d8`.
Это docs/evidence commit поверх проверенного source
`573608cd47c24a605ccae00be0161545619caae7`; исходники между ними не менялись.

Оба job успешны: `check` завершён в07:26:47UTC, `postgres-a02` — в07:25:04UTC.
Ubuntu24.04/Node22.16.0 установили оба lockfile и pinned Chromium с системными
библиотеками. Основной check: scanner33, 88 suites/1270 Jest, dashboard4+cleanup3,
admin errors18, invite11, persisted6. PostgreSQL job: controls,
A02/B03/B04/H04/IS02/R2_ADAPTER/R2_STARTUP/F05 PASS с удалением своей БД.

Это успешная удалённая проверка исправленного browser cleanup после timeout
run35427268043. Точная принадлежность зависшего ранее сокета неизвестна;
успешный повтор не меняет границы первоначальной диагностики.

[Снимок результата](evidence/R2-foundation-ci/run.json),
[выдержка оригинальных строк журнала](evidence/R2-foundation-ci/checks-excerpt.txt),
[manifest](evidence/R2-foundation-ci/manifest.json).
Выдержка содержит алгоритм отбора и SHA256 полного исходного журнала;
это производный excerpt, не полный log. Предыдущие foundation/CI-follow-up
manifests и их историческое REMOTE_CI_PENDING сохранены без изменений.

Production/Vercel smoke, DEV-15, OPS-IA01 и OPS-IS02 остаются NOT_RUN.
Сообщение Вадима о доступности боевой БД не является результатом этого workflow.
