# Стыки модулей

Финальная сверка 2026-09-16. Основные стыки A–I закрыты; исторические вопросы ниже сохранены с последующими решениями. Условные сценарии и runtime ограничения вынесены в итоговый отчёт.

| Стык | Что проверить | Статус |
|---|---|---|
| Auth → API/storage/calendar/push | Logout, смена пользователя, устаревшие запросы и очистка данных | закрыт: AC02/AC03, BC01, ES01, NI03, HN03 |
| Проекты → репетиции → уведомления | Удаление/выход, права и каскады | закрыт: B01/B02, D01–D03, G01 |
| Доступность → календарь → smart planner | Источник, all-day, timezone, дубль/удаление | закрыт: C01/C04, CC01/CC05, DF01, EI01/ES02 |
| Routes → db.transaction | Atomicity, single client, ограничения схемы | закрыт: F01–F05; F04 исключён из confirmed |

- A → F: новые password-пользователи и PUT password не создают `native_auth_providers`; проверить triggers/миграционный backfill. Guard unlink считает только provider rows (A04).
- A → C/D/G: `/auth/me` сохраняет непроверенную timezone; проверить использование в вычислении дат (A03).
- A → E/H: после refresh network error interceptor удаляет токены, AuthContext может восстановить cachedUser; поздний timezone PUT может вернуть предыдущего пользователя (клиентские notes).
- A → I: необязательный `APPLE_CLIENT_ID`, ошибки async middleware Express 4, логирование email/token; проверить lock/source/config без запуска.
- B → D/G: member removal три отдельных DELETE; при ошибке остаются responses/availability. Новый тест подтверждает второй membership guard чтения по id, надо сверить notification recipients (B01).
- B → F: создание/удаление project не использует transaction (B02); schema каскады проверить.
- B → D: ProjectDetail history читает date-only через new Date и только scene, уточнить serializer date/title.
- B → H: ProjectProvider не сбрасывает state на logout и не обновляет selectedProject после refresh. Проверить, кто использует stale selection.

- C → F: all-day floating dates против AT TIME ZONE DELETE (C01), отсутствие day lock (C03); проверить DB defaults/constraints.
- C → D: совпадающие manual/external часы теряются при dedup в редакторе (C04), planner должен учитывать оба источника; source free/available проверить.
- C → E: полный stale snapshot при Save после offline (CC05); imported/source IDs и owner cache ещё E/H.

- D формы → сервер: DF02 [] roster теряется в payload; DF03 load failure допускает destructive partial PUT. D04 editor ошибочно использует personal batch API для admin edit.
- D planner → форма: выбранные selectedMemberIds не передаются, форма auto-select all; гонки roster усиливают серверный D01.
- D RSVP → display: invitation row одновременно право доступа и mutable seen state (D02); Details содержит отдельное несогласованное состояние (DD01).
- D → F: lifecycle rehearsal/roster/busy без общей transaction (D03), убедиться в CHECK ends_at>starts_at; all-day schema поле не равно поддержке UI.
- D → G: roster removal/push/reminder consistency; inbox по одному id открывает Details без предварительного prime SeenContext.
- D → H: session reset SeenContext; navigation AddRehearsal/SmartPlanner и date-only labels, conditional userTimezone != deviceTimezone при автосинхронизации Auth.

- A→E закрыт ES01: state clear/reset есть, но старые async sync после смены session отправляют часы A с token B. Требуется user-bound lifecycle, не только очистка ключей.
- E server→client закрыт EI01: imported diff охватывает все apple/google записи пользователя, удаляет импорт другого устройства; серверу не передаётся connection scope.
- E mappings→export закрыт ES02: записи connections схлопываются по rehearsalId; ORDER BY DESC + overwrite выбирает oldest; экспорт доверяет чужому device-local ID. EX01/02/03/04 отдельно recovery/ownership/deletion.
- E storage→settings закрыт EO04 (ES03 evidence, не отдельный finding); EO06 статус успеха перезаписывает last time даже при partial failed и для import, и для export.
- E→F: unique calendar connection/mapping constraints, non-atomic SELECT→INSERT, polymorphic internal_event_id без FK; подтвердить реальную схему.
- E→G: после удаления последнего проекта auto export earlyreturn не чистит события/alarms (EO01); push trigger отдельно G, не исправляет earlyreturn.

- F→A: provider_user_id nullable, email backfill разовый, triggers нет — A04 подтверждён. Новая testfixture NOTNULL расходится с emailprovider schema, не production constraint.
- F→D: CHECK ends_at>starts_at подтверждён; DF04 wrongovernight payload даёт500, multiday допустим DD02. Полиморфные busy slots не FK к rehearsal, cleanup обязателен D03/B01.
- F→E: base schema пропускает005 unique availability, baseline marksdone; F02. Migrated production получает этот индекс; manual NULLexternal всё ещё допускаетC03race.
- F→G pending: push token UNIQUE(user_id,device_token) допускает двух владельцев при concurrent DELETE-other-users→INSERT; routes pushTokens49-70, проверить recipients/native handlers. 003notificationsindexes есть в migrated path, отсутствуют only freshbaselineF02.

- F→G закрыт G01: параллельные регистрации A/B одного token допустимы клиентским lifecycle (две точки register, нет session generation; pending register может пережить logout без local token). UNIQUE пары не исключает два владельца. FC01 объединён в G01.
- B→D→G закрыт B01: update/delete rehearsal берут только response roster, без active membership. Ошибка второго DELETE при member removal оставляет бывшему участнику новые inbox/push, хотя GET by id membership guard остаётся действительным. Это последствие B01, не отдельная находка.
- G→H: navigation cold/live response dedup и stale-account response пока ручные гипотезы; полный navigator будет H. Profile false success уже GC02, onboarding Later prompt GC01; не дублировать в H.
- G→I: server pushNotificationService:127 и client notifications:66/useNotifications:36,47,75 логируют токены/содержимое push; объединить с AC04 в сквозную logging оценку, без значений секретов.

- H auth→navigation: HN01 отложенный invite потребляется сразу после login, пока отображается OnboardingNavigator без JoinProject; code теряется. Все route refs проверены.
- D→H Seen: HN02 batch omissions + merge сохраняют старый yes при успешном refresh; HN03 provider не сбрасывается при смене пользователя. DD01 отдельный Details state, DF06 reorder queries и BC01 Project state остаются своими findings.
- H frontend→admin: H01 пользовательские bug report/name строки проходят до admin innerHTML, relaxed CSP разрешает исполнение handler; SQL parameterization не защищает этот HTML sink.
- B invite→H CSP: H02 nonce основного script не разрешает onclick fallback, который остаётся заблокирован. jsonForScript sink escaping сам проверен и не уязвим.
- H profile→public docs: удаление owned projects корректно и явно предупреждено в actual Profile. Privacy/support говорят только sole admin — устаревшее описание, отдельная destructive UI finding исключена.

## Итоговая актуализация I и ограничений

- Apple audience и dependency reachability: итог в notes-dependencies.md; наличие production env не проверялось.
- Секреты и логирование: global sweep выполнен; AC04 включает direct client push logs. Server logger.info выключен в production. Действующий опубликованный секрет не подтверждён.
- 0f655e2: GitHub schedule отключён, ручной dispatch сохранён. GR01–GR05 описывают обработчик при вызове; намеренное отключение не отдельный finding.
- G→H: доказаны onboarding invite loss HN01 и per-user Seen state HN03; остальные cold/live dedup и device-specific back stack остаются ручными гипотезами.
- E→F: schema/metadata scope проверен, многокалендарное схлопывание ES02 и baseline parity F02 подтверждены; отдельной доказанной cross-user mapping API уязвимости нет.
- Устаревшие слова «ожидает/проверить» в исторических пунктах выше — журнал исходных вопросов, а не незавершённые разделы. Итоговые решения представлены в разделах 5–7 AUDIT_REPORT.md.
