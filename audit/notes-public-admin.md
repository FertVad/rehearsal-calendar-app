# H — публичные страницы, admin и обращения

Статический аудит 2026-09-10, HEAD 8de99ab. Исходники не изменяются, браузер/приложение/HTTP/тесты не запускались. Пути ниже относительно rehearsal-calendar-native.

## H01 — High — сохранённая XSS из обращения/профиля выполняется в admin origin

`server/routes/admin/dashboardPage.js:430-438` формирует `body.innerHTML = d.reports.map(...)` и вставляет `'<td class="msg-cell">' + r.message + '</td>'`, `r.name`, `r.screen` без экранирования. Второй источник `:368-375`: firstName/lastName/email в users table тем же способом. `server/routes/native/bugReports.js:13-20` принимает любую непустую строку и сохраняет message.trim(); `/auth/register:17-20,34-37` сохраняет имена без ограничения HTML. Это допустимые текстовые данные: защита нужна в HTML sink. `server/server.js:203-220` явно разрешает `scriptSrcAttr: ["'unsafe-inline'"]` для admin. Токен администратора хранится в localStorage (`dashboardPage.js:253-259`).

Сценарий: обычный зарегистрированный пользователь записывает в message (либо имя) HTML с обработчиком ошибки изображения. Когда администратор открывает dashboard, innerHTML создаёт элемент, его handler выполняется в origin административной страницы. Может читать admin_token, запрашивать `/admin/api/users`/обращения с этим токеном, менять статусы обращений. CSP connect-src self ограничивает некоторые каналы вывода, но не запрещает чтение токена, same-origin API или навигацию; это не достаточная защита. Не заявляется shell/DB admin takeover: доступ ограничен реально имеющимися административными API. Опасный payload не записывался и не выполнялся.

Минимум: textContent для каждой пользовательской ячейки либо единый проверенный HTML-escaping перед интерполяцией всех указанных полей (2–5 часов; + закрывает известные sinks, − ручная интерполяция легко оставит следующий пробел). Правильно: DOM/textContent rendering, event listeners вместо inline handlers, строгий nonce/external-script CSP, сокращение/отзыв admin sessions (1–2 дня; + защита данных и второй барьер, − переработка небольшой dashboard). Переход на httpOnly cookie сам по себе не защищает API от уже выполняющейся XSS. Ручная проверка после fix: harmless HTML marker/handler в изолированной тестовой БД, просмотр users и reports, CSP violation; никаких действий в production.

## H02 — Medium — резервная кнопка открытия приглашения блокируется CSP

`server/server.js:317` генерирует `<a href="#" onclick="openApp(); return false;" ...>`. Основной inline script имеет nonce (:320), но onclick nonce не имеет и к nonce script не относится. Глобальный CSP `:83-101` разрешает script по nonce, не разрешает script-src-attr; Helmet default блокирует inline attributes (это прямо учтено для admin в комментариях :207-210). Invite route :255-358 не использует relaxedCsp. `window.onload` вызывает openApp (:351); через2сек показывает manual (:342-345), однако её onclick блокируется.

Сценарий: браузер не запускает custom scheme без жеста пользователя либо пользователь отклонил первоначальную попытку. После появления Open App нажимает кнопку, но она только меняет fragment на # и не вызывает openApp. Устройство с уже установленным приложением остаётся на странице. Дополнительно inline style block :267 и style attribute :315 не разрешены global style-src (:90), поэтому fallback теряет оформление/начальную скрытость. Не заявляется, что universal links никогда не работают: проблема именно browser fallback.

Минимум: назначить click через addEventListener внутри разрешённого nonce script, вынести CSS в public file (1–3 часа; + сохраняет строгую policy, − остаётся browser-dependent auto launch). Правильно: fallback с настоящим href custom scheme, progressive enhancement и явными действиями install/open, внешний JS/CSS или nonce policy без unsafe-inline (0.5–1 день; + ручное открытие работает без inline handler, − нужен QA Safari/Chrome/встроенных браузеров). Проверить реальные CSP headers и отказ автооткрытия; runtime не запускался.

## H03 — Low — метрика неактивности принимает давний login за отсутствие использования

`server/routes/admin.js:35-39` считает inactive через `last_login_at < monthAgo`, отображение `dashboardPage.js:341-343` называет это `User Churn (30 days)`/Inactive users. Поиск записей last_login_at по server first-party JS нашёл register/password/Google/Apple login; refresh и обычные authenticated действия дату не обновляют. При непрерывной refresh-сессии человек ежедневно пользуется приложением более30дней и учитывается ушедшим. Обратное: NULL last_login_at полностью исключён, legacy никогда не входившие не попадают в inactive numerator. Это аналитическая ошибка, не потеря доступа пользователя.

Минимум: назвать метрику «не входили заново >30дней», убрать churn вывод (30–60мин; + честно описывает имеющиеся данные, − не измеряет использование). Правильно: last_active_at с редким coalesced обновлением при реальных действиях и документированное окно retention/churn (0.5–1 день; + годится для решений о продукте, − дополнительная запись/определение активности).

## H04 — Low — admin скрывает ошибки загрузки/смены статуса

`dashboardPage.js:261-268` api() проверяет только401, любой500 возвращает JSON как обычный результат. loadStats/users/bugReports :356/:377/:440 глушат catch с комментарием handled by api(), но api() не показывает network/5xx ошибки. Первоначальный spinner остаётся Loading без retry-пояснения либо старая таблица выглядит актуальной. `setBugStatus:412-418` не проверяет fetch.ok/status, после failed PATCH просто перезагружает список без сообщения: администратор не знает, что изменение не записалось.

Минимум: общий res.ok guard и видимый error/retry для каждой секции; PATCH проверять до refresh (2–3 часа; + понятный сбой, − нужна ручная повторная попытка). Правильно: явные loading/stale/error/mutation states и согласованный API helper с session invalidation (0.5–1 день; + правдивая обратная связь, − больше UI state). Отрицательные limit/offset admin-only также возвращают500; не отдельная security finding.

## Покрытие на момент сохранения

Полностью прочитаны routes/admin.js174, routes/admin/dashboardPage.js459, routes/native/bugReports.js30, public/i18n.js173, public/legal.js51, public/index.html399, public/support.html312, public/privacy.html682 (все4языка, без юридической оценки), utils/htmlEscape.js54, server/server.js381 (порциями с контекстом для CSP/mounts/invite; config/security добор I), middleware/adminAuth.js45 (A повтор contract). Поиск tests по admin/bug reports не нашёл самостоятельной suite. Public assets/styles не проверяются визуально; runtime CSP/рендеринг не запускались. Добор завершён 2026-09-11 на HEAD25475e8; эти source files с8de99ab не менялись. Уточнение H03: WHERE last_login_at находится в admin.js:40, вся выборка :37-41.

## Стыки / без отдельного счёта

- Public privacy144-148/support50-53 обещают удаление проектов sole admin, а auth delete удаляет каждый owned project. Client deletion warning проверяет H profile; privacy текст объединить с его находкой/declared-vs-actual, не считать дважды.
- Добор H profile: actual warning `src/i18n/translations/profile.ts:64/114/164/214` и ProfileScreen525 прямо объясняет удаление всех owned projects и потерю доступа остальными. Destructive UI defect не подтверждён. Остаётся расхождение старых public docs с актуальным правилом; указать в declared-vs-actual без ещё одной code finding.
- JSON invite code/expoHost использует jsonForScript, а не raw interpolation; по этому sink старый XSS устранён, не дублируется с H01.
- Android assetlinks server247 содержит placeholder fingerprint; native manifest/подпись и public contract добор I.
- Bug report message без max длины/quota и лимитера: общий express JSON body cap существует. Возможность database spam от зарегистрированного пользователя передана I общему rate/validation sweep, не считать отдельно здесь до полного budget review.
- Платежей в admin API нет; statusBadge со старыми payment status — неиспользуемая вспомогательная функция, не платёжная реализация.

Дополнительно полностью прочитан `server/__tests__/routes/htmlEscaping.test.js`: тестирует htmlEscape/jsonForScript helpers, не реальную admin innerHTML rendering или заголовки CSP на /invite. H01/H02 этими тестами не покрыты; выполнения не было.
