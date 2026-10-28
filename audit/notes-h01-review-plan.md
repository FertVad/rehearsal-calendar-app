# H01 — матрица приёмки admin rendering и CSP

**Обновление root после исполнения:** локальные regression и stored-data browser
проверки выполнены, H01 VERIFIED. Фактический охват, результаты, независимый
review и ограничения — в [отчёте H01](REMEDIATION_H01.md). Текст ниже сохранён
как исходный план проверки, его отметки NOTRUN относятся к моменту подготовки
этого плана, а не к текущему статусу исправления.

Дата: 2026-09-17. Пакет `codex/systematic-repair`, только H01. Это план независимой проверки, не результат браузерного запуска. Все проверки ниже **NOTRUN** этим агентом; root выполняет реальную регрессию отдельно. Исходники не изменялись. Bearer/localStorage auth остаётся прежним; H03/H04, cookies, срок/отзыв сессий и новые API semantics сюда не включены.

## 1. Покрытие и исходные sinks

Полностью прочитаны исходные `server/routes/admin/dashboardPage.js` (459 строк), `server/routes/admin.js` (174), `server/middleware/adminAuth.js` (45), `server/utils/names.js` (22), `server/routes/native/bugReports.js` (30), `server/__tests__/routes/htmlEscaping.test.js` (54). В `server/server.js` прочитаны CSP/mount excerpts и найден static mount. Строки ниже относятся к исходной версии до текущего переноса JS/CSS; это не ревью ещё не завершённого diff.

| Место исходной страницы | Данные/контекст | Приёмка после исправления |
|---|---|---|
| `dashboardPage.js:334–352`, stats | `users.total/newThisWeek/newThisMonth`, churn rate/inactive, usage projects/rehearsals → `innerHTML` | Значения устанавливаются как текст. Сервер сейчас формирует числа (`admin.js:46–66`); malicious string в response fixture — дополнительная проверка renderer, не заявленная возможность пользователя менять счётчики. |
| `:368–375`, users | firstName, lastName, email; даты через fmtDate | Имя/email отображаются текстом, теги не создаются. NULL lastLoginAt остаётся `-`, дата сохраняет формат en-GB. |
| `:430–438`, reports | name, message, screen, statusButtons(id,status), fmtDate | name/message/screen — только текст. `screen` NULL/пустой → `-`. Проверить имя пользователя и fallback на email (`admin.js:145`, `names.js:17–21`). |
| `:401–407`, status buttons | ID в `onclick`, статусы из фиксированного списка | `addEventListener`/безопасная делегация, ID хранится как данные/closure, status и CSS class только из allowlist new/in_progress/fixed. Нет сборки исполняемой строки. При неизвестном status не создаётся HTML/новая команда. |
| `:381–390`, обе pagination | строка HTML, `loadFn.name` в `onclick`, номера страниц | DOM-кнопки и listeners, правильный callback своей таблицы. Очистка контейнера не оставляет старые кнопки. API total — число; подстановка fixture проверяет отсутствие HTML-интерпретации, не требует расширять API validation. |
| `:365`, `:427`, empty; `:384`, clear | Статические empty HTML и пустая строка | Статические шаблоны сами по себе не tainted sink; при выносе сохранить colspan 4/5 и видимость. Предпочтительно единый DOM renderer/replaceChildren без HTML-строк. |
| `:190,200,201`, shell | onclick login/refresh/logout; inline style | Все три действия работают через listeners, стили вынесены в CSS. Login error `:295/:299` уже textContent; сохранить это свойство, включая error из JSON. |

`statusBadge(:319–325)` и `bugStatusBadge(:394–398)` не вызываются. Их строки принимают status как HTML; удалить ненужные helper при переносе либо сделать безопасными, но не считать отдельными достижимыми уязвимостями. Проверить отсутствие новых `innerHTML/outerHTML/insertAdjacentHTML/document.write`, `eval/Function`, `on*`-атрибутов с данными; безопасное статическое очищение не равно XSS.

## 2. Решение CSP и external assets

Для выбранного root выноса в same-origin JS/CSS nonce самому admin не обязателен: `script-src 'self'` разрешает внешний файл, `style-src 'self'` — CSS. Существующий глобальный nonce может остаться для invite; это не повод оставлять admin `unsafe-inline`. CSP — дополнительный барьер, а textContent — исправление sink.

| ID | Проверка | Ожидаемое / доказательство PASS |
|---|---|---|
| H01-C1 | HTTP headers настоящих `/admin` и `/admin/`, также hard reload | Итоговый CSP не содержит `unsafe-inline`/`unsafe-eval` для scripts; `script-src-attr 'none'` явно или эффективный эквивалент. Нет отдельного relaxed admin middleware, ослабляющего header. Сохранены connect-src self, object-src none, frame-ancestors none и остальные существующие барьеры. Сохранить фактический header. |
| H01-C2 | Внешние JS/CSS, до и после login, после logout; `/admin` и `/admin/` | Корректный абсолютный URL, 200, верный JS/CSS Content-Type, не HTML fallback/404/login response. Скрипт запускается после готовности DOM (defer либо размещение в конце). Активы не содержат секретов и доступны без admin token; API остаётся с requireAdmin. Проверить также доступность файлов в deploy artifact, не только рабочем дереве. |
| H01-C3 | Login, main controls, empty states под фактическим CSP | Нет CSP violation для штатных JS/CSS/действий. Нет оставшихся inline handler/style attributes, которым для работы требуется ослабить policy. Classes/hidden заменяют inline presentation при выбранном строгом style policy. |
| H01-C4 | Отдельный контролируемый CSP probe в изолированной тестовой странице с тем же header | Inline handler и inline script без подходящего nonce заблокированы, marker не меняется; зафиксирован violation. Это отдельный probe, не ослабление shipped CSP. Если nonce-вариант всё же выбран: nonce свежий на каждый ответ, совпадает в header/script, не берётся из input; handler nonce не разрешает. |

## 3. Безопасные контрольные строки

Только synthetic fixtures/изолированная БД и тестовый администратор. Не читать token, не отправлять данные наружу, не вызывать административные mutation из payload. Для проверки выполнения единственный побочный эффект — локальная переменная `window.__h01Probe`. Перед каждым кейсом marker сброшен. Примеры:

```text
H01 <b data-h01="markup">literal & "quotes" 'apostrophe'</b>
<img src="data:," onerror="window.__h01Probe='img'">
<svg onload="window.__h01Probe='svg'"></svg>
</td></tr></tbody><svg onload="window.__h01Probe='table'"></svg>
"><img src="data:," onerror="window.__h01Probe='attr'">
</script><script>window.__h01Probe='script'</script>
&lt;img src=x onerror=window.__h01Probe=1&gt; &amp; &quot;
<form id="password-input"><input name="value" value="h01"></form>
שלום Русский 😀 A&B < > " ' + многострочное сообщение
```

Применить к firstName и lastName отдельно, message, screen, report name/email fallback. Email/login error — как response fixture, если обычный validation путь отклоняет конкретную строку. Один persisted smoke обязан пройти normal bug-report write → admin API → DOM, а response fixtures покрывают renderer отдельно. Значения ID/status/dates/counts проверять fixture как защиту границы, не утверждая возможность сохранения каждого malformed value через штатный API.

**PASS по каждому текстовому полю:** значение сохранилось текстом без удаления полезных символов/двойного HTML-decoding; ожидаемый trim/fallback допускается; нет созданных из строки img/svg/script/form/b элементов, лишних строк/ячеек/IDs; `window.__h01Probe` не изменился. Raw script в innerHTML может быть inert и до исправления: поэтому только этот payload или только отсутствие alert не доказывают устранение H01. Проверка структуры DOM обязательна и остаётся значимой под строгим CSP. В детерминированном renderer-тесте можно проверять DOM без CSP, не меняя policy приложения.

## 4. Нормальная браузерная регрессия

Для пагинации fixtures 0, 1, 30, 31 и 61 записей; достаточно менять набор внутри одного тестового браузера, дополнительных устройств не требуется. Отдельные counters/network interception помогают поймать двойные listeners.

| ID | Шаги | Ожидаемое / доказательство PASS |
|---|---|---|
| H01-R1 | Открыть без token; неверный пароль; верный пароль кнопкой; повторить Enter в новой сессии | Login остаётся видимым при неверном пароле, error текстовый. При успехе dashboard и три GET stats/users/bug-reports с Bearer; по одному POST на действие. Cookie-auth не добавлен. Credentials/token не включать в evidence. |
| H01-R2 | Hard reload с действующим сохранённым token; затем fixture expired token и GET401 | Первый случай восстанавливает dashboard. Во втором existing api401 очищает admin_token и показывает login; данные не видны. Здесь Refresh — кнопка загрузки данных, не новый token-refresh endpoint. |
| H01-R3 | Refresh с обеих таблиц на странице 2; повторить два раза | Stats/users/bug-reports обновляются; обе таблицы возвращаются на первую страницу, как исходный loadAll(:443–446). Клики не умножают GET/listeners; карточки, counts, даты, fallback и пустые состояния читаемы под CSP. |
| H01-R4 | Next/Prev на users и reports при 31/61 rows, границы 0/1/30 | Действия меняют только нужную таблицу, offset кратен 30; нет Prev на первой/Next на последней. Страница и rows соответствуют ответу, controls остаются работоспособны после нескольких refresh/render. |
| H01-R5 | На второй странице reports менять new → in_progress → fixed → new | Каждый клик — PATCH правильного ID с прежним JSON status; затем GET текущей страницы. Активная кнопка соответствует ответу сервера; сортировка API может переместить запись, поэтому проверять ID, а не прежний row index. Для same-status сохраняется существующая семантика. |
| H01-R6 | Logout, reload, login заново; затем Refresh/пагинация/смена статуса | Token очищен, dashboard скрыт, reload показывает login. После нового входа controls работают один раз на действие, payload-строки остаются текстом. Проверить click и клавиатурную активацию штатных кнопок. |
| H01-R7 | Запустить набор контрольных строк; затем нормальные действия R3–R6 | DOM и marker инварианты из §3 выполнены. Payload не сломал таблицы/IDs/listeners; нет неожиданных запросов или навигации. Наличие CSP violation от вставленного пользовательского элемента считается провалом renderer даже при заблокированном handler. |

Существующие network/500 и PATCH401 handling-проблемы H04 не объявлять исправленными и не менять их контракт под видом H01. После переноса проверить отсутствие регрессий, а новые loading/error/retry states оставить отдельному пакету. HTTP success-проверки в R5 относятся к заведомо успешной fixture.

## 5. Доказательства и итог

Для фактического PASS сохранить commit/build, URL/браузер, headers и asset status/MIME, screenshots или DOM assertions с synthetic payload в каждой группе полей, marker assertion, redacted network методов/путей/offset/status и отсутствие неожиданных запросов. Не сохранять пароль, Authorization, admin_token или настоящие пользовательские записи в HAR/log/screenshots. Проверки helper `htmlEscaping.test.js` отдельно не доказывают безопасность новой admin страницы или CSP.

Статус этого документа: **acceptance plan готов; C1–C4 и R1–R7 NOTRUN**. Изменён только этот audit-документ. H01 можно закрывать после review завершённого diff и browser evidence; текущая запись не заявляет устранение уязвимости.
