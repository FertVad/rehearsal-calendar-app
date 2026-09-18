# Сверка исключений и объединений перед итоговым отчётом

2026-09-15. Только чтение существующих audit notes и подтверждения root; исходники не перечитывались, ничего не запускалось. Это правила агрегации, не новые findings. Рабочие ранние предположения в старых заметках не должны автоматически попадать в итоговый count.

| ID | Итоговый статус | Основание и способ включения |
|---|---|---|
| AC06 | Исключить из подтверждённых | Отсутствие syncUserPreferences найдено в Telegram helper, но root подтвердил неактивность пользовательского Telegram flow. Ранний сценарий из notes-auth-client.md не доказан достижимым. Сохранить как ограничение при будущем подключении, без severity/count. Заголовок исходной заметки уточнён. |
| DP03 | Объединить с CC01 | notes-smart-planner.md прямо требует общего date-only finding; SmartPlannerScreen:33–49 показывает предыдущий день в UTC− из-за new Date(YYYY-MM-DD). Один системный CC01 с несколькими affected screens, отдельного DP03 нет. |
| BC04, date-only часть | Объединить с CC01 | ProjectDetailScreen:62–67 тот же new Date/date-only display. D подтвердил actual YYYY-MM-DD; источник notes-rehearsals-server.md. Не оставлять pending и не прибавлять BC04. |
| BC04, «все карточки исчезают, потому что API не отдаёт date/time» | Опровергнуто, исключить | getProjectRehearsals действительно возвращает legacy date/time/endTime (rehearsalService:228–243). Это другое утверждение внутри раннего BC04; нельзя переносить его в итог вместе с настоящим date-only bug. |
| Общий DateRangePicker date-only | Объединить с CC01 | notes-common-client.md: DateRangePicker:141–145 меняет только label; confirm сохраняет правильную дату. Это дополнительный экран общей ошибки, без нового H count и без утверждения о неверном сохранении. |
| ES03 | Объединить с EO04 | notes-calendar-storage.md и notes-calendar-orchestration.md уже согласованы: обход очереди/запись полного старого settings snapshot — нижний слой подтверждённого EO04. Один EO04 Medium, storage evidence остаётся частью его причины/исправления. |
| FC01 | Объединить с G01 | В F был pending, в G lifecycle/delivery подтверждены. notes-notifications-delivery.md прямо включает FC01 в G01 High; не считать дважды. Заголовок ранней F заметки уточнён. |
| F04 | Условный риск, вне подтверждённых | notes-database.md: текущие SQLite transaction callbacks не содержат доказанного внешнего I/O; await синхронных SQLite вызовов сам по себе не доказывает вклинивание соседнего HTTP callback. Оставить contract/fault-injection check, не production High/Medium и не count. |

Дополнительные уже закрытые ограничения, которые важно не возвращать при компоновке:

- **SQLite foreign_keys выключены:** опровергнуто для зафиксированной зависимости compile define (`notes-database.md`); отсутствие явного PRAGMA в адаптере не доказательство выключенного FK. Реальная custom сборка не исследовалась.
- **Rehearsal all-day toggle теряет флаг:** исключено D — такого toggle/payload в штатной форме нет. Наличие isAllDay в schema/типах не делает этот сценарий доступным. DD02 overnight/multiday остаётся отдельным подтверждённым сценарием.
- **Общий cache TTL useRehearsals ломает фильтр:** сам TTL не найден дефектом, CalendarScreen делает force при смене фильтра. Подтверждённый late-response overwrite относится к DF06; не смешивать причины.
- **Mailer/reset helpers закрывают A01/A04:** неверно; production callers отсутствуют, текущая delta не меняет регистрацию/credential registry. A01/A04 остаются активны (`notes-final-delta.md`). Shared JWT_SECRET у mail/session сам по себе не bypass из-за type/purpose guards; future reset concurrency не считать активной endpoint уязвимостью.
- **Уведомления бывшему участнику после partial removal:** последствия B01 подтверждены G, но отдельного нового G count нет. Обычный успешный removal этим утверждением не затрагивается.
- **Некорректное UI-предупреждение удаления owned projects:** исключено H — Profile заранее предупреждает обо всех owned projects/репетициях и потере для остальных. Устаревшие public/API docs относятся к documentation drift, не дополнительной destructive UI finding.

Условные timing/platform/legacy примеры должны сохранять свои условия в итоговом тексте. Эта сверка не проводила новых runtime проверок и не пересчитывала общий итог проекта: его формирует root после объединения остальных I находок.
