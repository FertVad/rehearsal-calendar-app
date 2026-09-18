# Участок G — cron и напоминания

Сохранено 2026-09-10 по статическому чтению 2026-09-09; workflow актуализирован 2026-09-15 до HEAD `0f655e2`. Код, SQL, тесты, workflow и HTTP запросы не запускались; исходники не менялись. Пути относительно `rehearsal-calendar-native/`, кроме `.github/workflows/rehearsal-reminders.yml`: этот файл находится в корне workspace `/Users/vadimfertik/Desktop/reh_app/.github/workflows/rehearsal-reminders.yml`.

## Актуализация 2026-09-15 — расписание выключено, GR03 не исправлен

Полностью прочитана новая версия workflow (70 строк) и diff `25475e8..0f655e2`. Schedule закомментирован на :39–40, остался ручной `workflow_dispatch`:41. Комментарий :21–28 сообщает об остановке всех reminders и внешнего cron-job.org с 2026-09-12 из-за расхода Neon compute; настройка внешнего сервиса статически не подтверждена. Исторические описания «каждые15мин» ниже относятся к предыдущей версии, не к текущему автоматическому trigger.

GR03 сохраняется: проверка только HTTP200 теперь на workflow:67–70, а scheduler/routes не исправлены этим diff. Сценарий остаётся достижимым при manual dispatch/прямом endpoint вызове или после включения расписания. GR01–GR05 также описывают code-path при вызове endpoint; они не доказывают текущую автоматическую отправку при отключённых schedulers. Само документированное отключение — операционное состояние, не новая скрытая ошибка кода. Итоговый отчёт должен показывать это ограничение актуальности.

## Покрытие

Полностью прочитаны:

- `server/services/notifications/reminderScheduler.js` — 182 строки.
- `server/routes/cron.js` — 67 строк.
- `.github/workflows/rehearsal-reminders.yml` — 52 строки.
- `server/__tests__/integration/reminderScheduler.integration.test.js` — 297 строк.
- `server/__tests__/routes/rehearsalNotifications.test.js` — 372 строки; включая полный describe «Moving a rehearsal after it has been announced», :308–372, и его setup.

Итого 5 файлов / 970 строк. Адресно прочитаны `server/services/notifications/pushNotificationService.js:130–185,318–348` для helper contracts; полный этот файл прочитан основным аудитором G. Поиском прочитаны строки переводов `server/i18n/pushNotifications.js:60–69,130–139,200–209,270–279`; весь i18n этим проходом не заявляется. `rehearsalService.js:477–551`, schema claims и notification recipient query полностью/адресно уже читались в F, ссылки используются без нового запуска. Native доставка, реальные secrets, cron-job.org, GitHub scheduled-run status, production Vercel limits не проверялись.

## Восстановленный сценарий

GET `/api/cron/reminders` требует точного `Authorization: Bearer CRON_SECRET`; отсутствие конфигурации даёт503, неверный secret401. По текущему now последовательно ищутся обычные, не all-day репетиции в окнах now+12…24ч и now…1ч. Rehearsal считается due, если в roster есть хотя бы один user без `(rehearsal,user,type)` claim. Для roster участников по одному вставляются claims `ON CONFLICT DO NOTHING RETURNING id`. Notify получает только userIds, чьи claims вставил этот run. Предполагается, что successful resolve означает успешную отправку; на throw notify эти claims удаляются. GitHub workflow каждые15мин вызывает URL с60сек timeout и проверяет только HTTP200. Упомянутый в комментарии основной cron-job.org — внешняя конфигурация, её существование/активность статически не подтверждены.

## GR01 — Medium — ошибка отправки push не освобождает reminder claim

Места: `server/services/notifications/reminderScheduler.js:141–174`; `server/services/notifications/pushNotificationService.js:117,172–184,329–346` (полный send helper и его return contract проверены основным аудитором G).

```js
// reminderScheduler.js:156–174
try {
  await notify(rehearsal, rehearsal.project_name, unclaimed);
  sent += 1;
} catch (err) {
  for (const userId of unclaimed) {
    await db.run('DELETE FROM native_push_reminders ...', [rehearsal.id, userId, type]);
  }
  throw err;
}
// pushNotificationService.js:177–183
for (const [locale, ids] of groups.entries()) {
  await sendPushNotification(ids, { title: tr.title, body: tr.body(params), data });
}
```

Сценарий: claim уже сохранён, Expo send отклонён/сетевая ошибка либо все tickets имеют status error. `sendPushNotification` ловит штатные send failures и возвращает `{sent:0,failed:N,...}` вместо throw (:117); `sendLocalizedNotification` результат игнорирует и resolve undefined; notifyRehearsal24h/1h тоже resolve undefined. Scheduler увеличивает `sent`, claims остаются. Следующий cron исключает этих пользователей через NOT EXISTS (:94–98), хотя push им не ушёл. При partial success теряются только failed recipients, но helper не возвращает их scheduler.

Проявление: уведомление на устройство не приходит и не повторяется после восстановления Expo/сети; cron сообщает отправку. Inbox-запись может быть создана до push и остаться доступной в приложении — находка не утверждает потерю inbox во всех случаях. Это отличается от отсутствия receipt polling после принятого Expo ticket, которое основной аудитор рассматривает отдельно: здесь уже immediate failure известен сервису, но потерян между слоями.

Тест `reminderScheduler.integration.test.js:204–216` заменяет настоящий notify на `mockRejectedValueOnce(new Error('Expo is down'))`, а настоящий helper на таком сбое обычно не rejects. Тест проверяет недостоверный контракт сбоя, поэтому не доказывает работоспособность runtime retry.

Минимум (1–3 ч): возвращать результат send через localized/notify helpers, не считать all-failed успешной отправкой и освобождать соответствующие claims. Плюс: локальная поправка контракта; минус: release всех после partial success дублирует push успешно уведомлённым людям, нужен хотя бы per-user result.

Правильно (1–2 дня): per-recipient delivery state с distinction attempted/accepted/failed, адресные retry, bounded backoff и claim lease. Inbox идемпотентно привязать к reminder identity, чтобы retries push не множили уведомления. Плюс: точное восстановление и отчёт; минус: схема результата/claims и интеграция push/inbox. Runtime failure test должен пройти через реальные helper contracts с mocked Expo, не заменять notify на произвольный throw.

## GR02 — Medium — ошибка или остановка между claims и notify навсегда исключает ещё не уведомлённых пользователей

Места: `server/services/notifications/reminderScheduler.js:139–157,162–178`; `server/database/init-native-schema.sql:243–253`.

```js
const unclaimed = [];
for (const userId of memberIds) {
  const claim = await db.get(
    `INSERT INTO native_push_reminders (rehearsal_id, user_id, reminder_type, sent_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (rehearsal_id, user_id, reminder_type) DO NOTHING RETURNING id`,
    [rehearsal.id, userId, type, now.toISOString()]
  );
  if (claim) unclaimed.push(userId);
}
// only now starts the try whose catch removes claims
try { await notify(...); } catch (err) { /* cleanup */ }
```

Сценарий: roster содержит A,B. INSERT claim A проходит, INSERT claim B получает DB error (например, B удалён из native_users после чтения roster и FK не даёт вставить claim, либо прервано соединение). Ошибка выходит в внешний catch :176–178, который только логирует; cleanup :162 никогда не запускается. Claim A остаётся, notify для A вообще не вызывался. Аналогично процесс/serverless function может остановиться после INSERT claim и до notify, а у постоянного claim нет expires_at/lease/state: ни следующий run, ни резервный scheduler его не подберут.

Проявление: часть пользователей навсегда пропускает конкретное напоминание из-за временного сбоя перед отправкой. Наличие UNIQUE защищает от параллельной двойной отправки, но не гарантирует доставку после claim; это две разные гарантии.

Минимум (1–3 ч): охватить claim loop общим try/cleanup, атомарно сформировать группу claims и не терять уже вставленные claimIds при исключении; удалять только claims данного run. Плюс: исправляет catch-path; минус: не восстанавливает работу после принудительного завершения процесса.

Правильно (1–2 дня): claim со status/lease/attemptId и временем истечения, безопасный повтор после истёкшего lease; завершать claim только после установленного delivery outcome. Плюс: выдерживает timeout/process crash; минус: задача доставки становится at-least-once, внешние дубли нужно минимизировать/idempotency, обещание exactly-once без поддержки провайдера давать нельзя.

## GR03 — Medium — cron и workflow показывают успех при отказе БД/напоминаний

Места: `server/services/notifications/reminderScheduler.js:102–105,176–181`; `server/routes/cron.js:46–57`; `.github/workflows/rehearsal-reminders.yml:67–70` (в HEAD `0f655e2`; ранее :49–52).

```js
// scheduler, error loading due rehearsals
catch (err) {
  logger.error(...);
  return { found: 0, sent: 0 };
}
// route after checkUpcomingRehearsals resolves
res.json({ success: true, message: 'Reminder check completed', ...result });
```

Сценарий: SQL query сломан после неполной миграции или БД временно не отвечает. Оба sendReminders возвращают found0/sent0. Route отдаёт200 success:true. Workflow считает успехом любой200 и не имеет данных, позволяющих отличить отказ от отсутствия due репетиций. Ошибки внутри claim/notify также только логируются и не попадают в result, поэтому failed run может быть зелёным.

Проявление: внешнее наблюдение не обнаруживает простой reminders, и операторы узнают о пропусках от пользователей. Комментарий cron.js:50–52 прямо обещает, что counts позволяют отличить «ничего не было» от «query broken», но для query error результат идентичен пустой БД. Это operational correctness, не обход авторизации cron.

Минимум (1–2 ч): при ошибке загрузки выбрасывать ошибку до route500 либо явно возвращать failed/errors и non-success status. Плюс: existing HTTP monitor сразу замечает отказ; минус: частичный успех двух windows нужно описать отдельно.

Правильно (0.5–1 день): structured per-window/per-recipient outcome, HTTP status/health для partial failure, lastSuccessfulRun и monitoring failed/expired claims. Плюс: видно реальную работоспособность и размер сбоя; минус: согласование workflow/операционных метрик. Secrets/провайдеры мониторинга при этом в аудите не настраивались.

## GR04 — Low — текст «завтра»/«через1час» противоречит расширенным окнам напоминания

Места: `server/services/notifications/reminderScheduler.js:24–30,42–55`; `server/i18n/pushNotifications.js:60–69` (то же en:130–139, es:200–209, de:270–279); `server/services/notifications/pushNotificationService.js:333,345`.

```js
const DAY_BEFORE_FLOOR_MS = 12 * 60 * 60 * 1000;
const DAY_BEFORE_CEILING_MS = 24 * 60 * 60 * 1000;
const HOUR_BEFORE_CEILING_MS = 60 * 60 * 1000;
// translations
rehearsal24h: { title: 'Репетиция завтра', ... },
rehearsal1h: { title: 'Репетиция через 1 час', ... },
```

Сценарий1: scheduler/пользователь сейчас9:00, репетиция22:00 того же дня, раньше напоминание не отправлялось. Через13часов попадает в day-before window и получает «Репетиция завтра». 12часов минимальной дистанции не гарантирует следующую календарную дату даже без timezone/DST. Сценарий2: catch-up run за10минут до старта (специально допускается тестом :155–163) отправляет «через1час». Notification body содержит только проект/title, точного времени нет.

Проявление: пользователь получает неверное временное указание, хотя сама репетиция в приложении имеет правильную дату. Комментарий :24–26 об «honest tomorrow» математически неверен; тест :127–133 проверяет лишь5часов и не проверяет13часов в пределах того же дня.

Минимум (30–60 мин): нейтральный title «Напоминание о репетиции»/«Репетиция скоро», при желании точное время в body. Плюс: корректно при задержках; минус: менее конкретный title.

Правильно (0.5 дня): формировать relative/date/time wording для каждого recipient в его timezone, показывать фактический startsAt; keep широкие retry windows. Плюс: полезное сообщение независимо от задержки cron; минус: нужен recipient timezone в builder и локализация.

## GR05 — Medium — старый scheduler snapshot ставит claim уже после переноса репетиции и блокирует новое напоминание

Места: `server/services/notifications/reminderScheduler.js:77–100,119–147,157`; `server/services/rehearsals/rehearsalService.js:477–510`.

```js
// scheduler caches the rehearsal before awaits/claims
rehearsals = await db.all('SELECT r.*, p.name ... WHERE r.starts_at BETWEEN ? AND ? ...');
// claim does not carry the rehearsal start/revision
ON CONFLICT (rehearsal_id, user_id, reminder_type) DO NOTHING
// rehearsalService:509–510
if (existing && new Date(existing.starts_at).getTime() !== new Date(updatedRehearsal.starts_at).getTime()) {
  await db.run('DELETE FROM native_push_reminders WHERE rehearsal_id = $1', [rehearsalId]);
}
```

Конкретная последовательность: (1) cron прочитал rehearsal R, старый startsAt через20часов; (2) пока cron ожидает roster/DB, администратор перенёс R на+3дня; update записал новый startsAt и удалил старые claims; (3) прежний cron продолжает на snapshot R, вставляет claim по rehearsalId/userId/type и отправляет напоминание по старой due дате; (4) за сутки до новой даты NOT EXISTS уже видит этот поздно вставленный claim и не отправляет новое напоминание. Исправление атомарности редактирования D03 само по себе не закрывает это: stale cron snapshot не проверяет revision при вставке.

Проявление: ложное напоминание после переноса и отсутствие нужного позже. Тесты rehearsalNotifications:349–359 выполняют update после заранее созданного claim последовательно; обратное interleaving «read→update+delete→claim» ими не проверяется.

Минимум (2–4 ч): claim через условный INSERT SELECT, проверяющий, что starts_at/updated revision rehearsal всё ещё соответствует прочитанному snapshot; перед отправкой валидировать актуальность, старую задачу отменять. Плюс: предотвращает запись устаревшего claim; минус: без общего revision/lock остаются узкие races между подтверждением и внешней отправкой.

Правильно (1–2 дня): reminder identity включает rehearsal schedule revision/startsAt; due query игнорирует claims старой версии, reschedule создаёт новую immutable delivery task, state/lease/attempt ownership общие с GR02. Плюс: перенос и конкурентные runners согласованы; минус: миграция claims и изменения scheduler/update API. Releasing failed claims тоже нужно делать по claimId/attemptId, чтобы старый run не удалил claim другой версии.

## Получатели, предпочтения, стыки

- Scheduler выбирает roster (`native_rehearsal_responses`), не всех project members; добавленный после первой отправки человек без собственного claim получает следующее напоминание. Это подтверждено текущими queries и тестами :219–295.
- Active project membership в scheduler query/roster не проверяется (:90–98,:119–124). При нормальном полном remove-member route удаляет responses, поэтому последующие runs этого пользователя не видят. При B01 partial failure после удаления membership, но до удаления responses, stale roster продолжает получать reminders; у push helper только user preference/registered token, не active membership. Это усиливает последствия B01/D01, отдельным новым IDOR не считается. Normal deletion одновременно с уже захваченным roster тоже требует согласования snapshot/lifecycle, но отдельного подтверждённого пользовательского бага кроме этих связей не начисляем.
- notifications_enabled фильтруется в push helper getUserPushTokens, не до claim; user без push permission/token/preference может получить inbox entry, а claim останется. Это может быть правильной семантикой «inbox доставлен, push отключён», поэтому zero tokens само по себе не объявлено GR01 failed delivery. Повтор при последующем включении уведомлений внутри окна не обещается явно.
- All-day rep excluded (`r.is_all_day=FALSE`); текущие тесты это намеренно закрепляют. Scheduler не учитывает status canceled, но фактический API отменяет удалением репетиции, а не переключением status; без reachable soft-cancel producer отдельную finding не утверждаем.
- now один на весь check, day/hour окна независимы; timed timestamps сравниваются как instants. Основная timezone ошибка здесь только wording GR04. При длительном run старый now может приводить к неактуальным напоминаниям; существенная latency не измерялась, отдельно не считается.
- UNIQUE(rehearsal,user,type) + DO NOTHING предотвращают двойной claim одного recipient у concurrent runners, пока rehearsal revision не меняется. Наличие backup workflow безопасно по этому критерию; оно не исправляет потерянный claim/failed send GR01/GR02.
- Workflow comments:14 всё ещё описывают unique только `(rehearsal_id,reminder_type)`, хотя фактическая схема уже per-recipient; это устаревший комментарий без самостоятельного runtime дефекта. Cron route comment про in-process/Vercel scheduler тоже не считается доказательством реально активной конфигурации.

## Ограничения проверок

Integration tests выполняют production scheduler с подменённым db и полностью mocked notify. Есть sequential повторные runs, разные окна, bystander roster, late new member, throw-notify retry. Нет barrier-тестов concurrent schedulers, claim loop partial DB error, process crash/lease, move-between-read-and-claim, реального helper returning failed result, query error HTTP workflow status или временной wording относительно recipient timezone. Никакой тест не запускался. Для полного операционного заключения вручную проверить CRON_SECRET, primary/backup scheduler execution и pause/outage, реальные Expo outcomes и журнал failed/expired claims.
