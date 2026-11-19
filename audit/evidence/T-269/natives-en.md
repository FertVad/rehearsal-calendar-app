# T-269 и T-270: вычитка английского (en) — политика, поддержка, строки новой кнопки

Правка `25e2d1d`. Прочитаны целиком: en-блок `privacy.html` (строки 25–306), en-блок `support.html` (25–100), дифф `621d3a5..25e2d1d`, evidence T-269, строки en в `calendarSync.ts`, `profile.ts`, `availability.ts`, `calendar.ts`, экран `CalendarSyncSettingsScreen.tsx`. Сверены отчёты en T-256, T-261, T-276 и тесты `privacyPage`, `privacyProcessors`, `supportPage`: они держат часть английских фраз.

## 1. Кто читал

Редактор, носитель американского английского. Правлю privacy policies, App Store copy и интерфейсы для США. Знаю, как такие тексты читают App Review и проверка бренда Google. Работаю с американским любительским и профессиональным театром (stage management).

## 2. Часть A

Английский крепкий: короткие фразы, «you/we», без юридических штампов. Ошибок две, обе — американские нормы. Остальное — «лучше так». Пометка **важно** стоит там, где текст обещает шире фактов или его можно понять двояко.

### privacy.html (en)

| Где (раздел, начало фразы) | Сейчас | Предлагаю | Почему | Тип |
|---|---|---|---|---|
| Под заголовком, «Last updated» | `Last updated: 18 November 2026` | `Last updated: November 18, 2026` | В США дата пишется «месяц, день, год». «18 November» читается как британская или военная запись, а это первая строка страницы. Следующие даты — в том же порядке. Тест `privacyProcessors.test.js:52` ждёт «18 November»: менять вместе. | лучше так |
| Лид, «Rehearsly stores what it needs…» | `Rehearsly stores what it needs to schedule rehearsals and nothing more.` | `Rehearsly keeps only what it needs to run the app and schedule rehearsals.` | **Важно:** обещание шире фактов. В таблице ниже есть данные не для расписания: время входов («to see which accounts are still in use»), хеш IP против перебора, журналы Vercel. Строгий читатель найдёт расхождение уже с первой фразой. | лучше так |
| Таблица, «Password…», колонка When | `Only if you register with email or set a password` | `Only if you sign up with email or set a password` | В приложении кнопка «Sign Up», на странице поддержки «signed up», строкой выше «On sign-up». | лучше так |
| Таблица, «One-time email codes…», колонки Data и Why | `…we keep only a keyed hash of the code and the address it went to; a code works for 15 minutes` / `To confirm your address, reset your password or change your email` | `…we keep only a keyed hash of each code (never the code itself), plus the email address it was sent to; a code works for 15 minutes` / `To confirm your email address, reset your password or change your email` | «a keyed hash of the code and the address» можно прочитать как «хеш кода и адреса», то есть будто адрес тоже хешируется; «plus» разводит одно и другое. Голое «address» по-английски — прежде всего почтовый адрес (термины T-256). «15» в таблице остаётся (тест). | лучше так |
| Таблица, «Google or Apple account identifier…», колонки Data и When | `Google or Apple account identifier and email` / `Only if you use Sign in with Google or Apple` | `Google Account or Apple Account identifier and email address` / `Only if you sign in with Google or Apple` | «Google Account» и «Apple Account» — названия продуктов, пишутся с заглавной (так и в приложении после T-256). «Sign in with Google or Apple» с заглавной S выглядит испорченным названием функции: у Apple она называется «Sign in with Apple». Глагольная форма проще и совпадает с началом раздела о входе. | лучше так |
| Таблица, «Time zone, language, week start day» | `Time zone, language, week start day` | `Time zone, language, first day of the week` | Так говорит приложение (онбординг, ошибка профиля). «week start day» — неуклюжая цепочка существительных. | лучше так |
| Таблица, «Projects, rehearsals…» | `Projects, rehearsals, participants, notes, venue` | `Projects, rehearsals, participants, notes and venues` | Одно слово в единственном числе в конце списка множественных выглядит опиской. | лучше так |
| Таблица, «Push token…», колонка Why | `To deliver notifications about your rehearsals` | `To deliver notifications about your projects and rehearsals` | Точнее: пуши приходят и о проекте (New Member, Role Changed, Removed from Project, Project Deleted). | лучше так |
| Таблица, хеш IP, колонка Why | `To limit how often sign-in and invite links can be tried` | `To limit repeated attempts to sign in or open invite links` | «sign-in … can be tried» — неестественное сочетание. О том, при каких запросах пишется хеш, — вопрос В1 ниже. | лучше так |
| Таблица, журналы Vercel, колонка Why | `To run the server and investigate faults` | `To run the server and troubleshoot problems` | «investigate faults» — инженерный, британский оборот. По-американски — «troubleshoot problems». | лучше так |
| About calendar import, абзац 1, «What reaches our server…» | `What reaches our server is “busy from 14:00 to 15:30”, not “Dentist”.` | `What reaches our server is “busy from 2:00 to 3:30 PM,” not “Dentist.”` | 24-часовое время американец читает как «военное» и пересчитывает в уме. На американском iPhone само приложение показывает 12 часов. По американскому правилу запятая и точка стоят внутри закрывающих кавычек. | ошибка |
| About calendar import, абзац 2 | `…that you are unavailable in that period, with no further detail.` | `…that you are busy at that time, with no further detail.` | В приложении пара «busy / free», «unavailable» не используем (термины T-256). «in that period» звучит книжно. | лучше так |
| About calendar import, абзац 3, «…still see them as busy» | `…and the members of your projects still see them as busy.` | `…and other members of your projects still see you as busy at those times.` | «Видят занятость занятой» — тавтология: занятым видят человека. Правка вошла в абзац части C. | лучше так |
| What we deliberately do not collect, пункты 1 и 3 | `No location data` / `No photos, camera or microphone` | `No location data from your phone` / `No access to your photos, camera or microphone` | Место репетиции (venue) мы храним, и голое «No location data» строгий читатель сочтёт противоречием. «Не собираем камеру» не сочетается: нужно «access». | лучше так |
| Who else processes your data, вводная фраза | `We rely on a small number of providers, each only for what it does:` | `We rely on a few service providers, each for one specific job:` | «each only for what it does» по-английски не говорят. | лучше так |
| Тот же список, Resend | `…your codes for sign-up, password reset and a change of address;` | `…your codes for signing up, resetting your password and changing your email address;` | «a change of address» — устойчивое выражение о переезде, то есть о почтовом адресе. «Ireland» в пункте остаётся (тест). | лучше так |
| Тот же список, Expo | `Apple's APNs` | `Apple’s APNs` | Везде на странице типографский апостроф (Vercel’s, Google’s), здесь прямой. Цитату Limited Use не трогать. | лучше так |
| Под списком, «We do not share…» | `We do not share your data with anyone else, and we never sell it.` | `We do not share your data with any other company, and we never sell it.` | **Важно:** участники проектов по замыслу видят имя и занятость, так что «anyone else» шире фактов. | лучше так |
| What we receive from Google, пункт 3 | `Your Google account identifier` | `Your Google Account identifier` | Название продукта Google, с заглавной, как в приложении. Тест (`/account identifier/i`) не задет. | лучше так |
| Why we use it, «Your email address is…» | `Your email address is your account’s address, so the codes you ask for, such as a password reset, are sent to it.` | `Your account uses this email address, so the codes you ask for, such as a password reset code, are sent to it.` | Сброс пароля — не код. «email address is your account’s address» — тавтология с голым «address». | лучше так |
| Why we use it, «Your name is taken once…» | `Your name is taken once, when the account is created, and you can change it in Profile → Edit Profile.` | `We copy your name from Google once, when the account is created; you can change it in Profile → Edit Profile.` | «is taken» звучит как «отнимают» или «занято». «copy» прямо говорит, что дальше имя живёт отдельно от Google. | лучше так |
| Why we use it, «If an account with the same verified address…» | `If an account with the same verified address already exists, Google is linked to it and the account keeps its name.` | `If an account with the same verified email address already exists, your Google Account is linked to it, and the name on that account does not change.` | Привязывается не «Google», а аккаунт Google — так и в приложении: «Your Google Account has been linked to your existing account». В «the account keeps its name» рядом стоят «it» и «its» с разными референтами. | лучше так |
| Where it is kept and who receives it | `We do not sell it, and we pass it to no one except the providers that run Rehearsly for us:` | `We do not sell it. Apart from showing your name to the members of your projects, we pass it only to the providers that run Rehearsly for us:` | **Важно:** абзацем выше сказано, что имя видят участники проектов, а «no one except the providers» с этим расходится. Проверяющий Google сверяет именно раздел «кому передаётся». Тесты `/do not sell/` и `Expo…APNs…show your name` не задеты. | лучше так |
| How to remove it, конец первой фразы | `…as described under “How long we keep it”.` | `…as described under “How long we keep it.”` | Американское правило: точка внутри кавычек. Названия кнопок в кавычках («tap “Send”.» на странице поддержки) — буквальные надписи, там точку за кавычками оставляю, как принято в технических текстах. | ошибка |
| How to remove it, о Google | `You can also remove Rehearsly’s access in your Google Account settings. That ends the permission at Google but does not delete what we already hold; deleting your account does.` | `You can also stop using Sign in with Google for Rehearsly in your Google Account settings. That ends the link on Google’s side but does not delete what we already hold; deleting your Rehearsly account does.` | **Важно:** «deleting your account» в абзаце о настройках Google читается как удаление аккаунта Google. Для входа кнопка в аккаунте Google называется «Stop using Sign in with Google». «Remove access» там у приложений с доступом к данным (support.google.com/accounts/answer/13533235). Текст ссылки «Google Account settings» не меняется (тест). | лучше так |
| How long we keep it, абзац 1, «Delete the account and…» | `Delete the account and everything tied to it — availability, … project memberships — is removed from our database along with it.` | `When you delete your account, everything tied to it — availability, … project memberships — is removed from our database along with it.` | **Важно:** «Delete the account and everything tied to it» сначала читается как «удалите аккаунт и всё, что с ним связано», и после длинной вставки «is removed» повисает. Список внутри тире не меняется. | лучше так |
| Там же, последняя фраза | `Rehearsals you created in projects that remain stay there, without your name.` | `Rehearsals you created in the remaining projects stay there, without your name.` | «remain stay» — два глагола подряд, читатель спотыкается. | лучше так |
| How long we keep it, абзац 3 | `Two records outlast that for a short time.` | `Two other records outlast your account for a short time.` | После абзаца об уведомлениях непонятно, к чему относится «that». Новая фраза подходит к обоим вариантам D1. | лучше так |
| Your rights, «Stop notifications» | `Profile → Notifications, or your device settings.` | `Profile → Notifications, or Settings → Notifications → Rehearsly on your iPhone.` | Путь как на странице поддержки (сверен в T-268). «Settings» — так называется приложение iOS. | лучше так |
| Security, вторая фраза | `Passwords are stored as bcrypt hashes and are never recoverable, by us or anyone else.` | `Passwords are stored only as bcrypt hashes, so we cannot see or recover them.` | **Важно:** «never recoverable … by anyone else» шире фактов: слабый пароль из утёкшего хеша подбирают перебором. Обещать можно только за себя. | лучше так |
| Children | `If you believe a child has created an account, write to us and we will remove it.` | `If you believe a child under 13 has created an account, write to us and we will remove it.` | В США «child» — любой несовершеннолетний, а политика исключает только детей младше 13 (COPPA). | лучше так |

### support.html (en)

| Где (раздел, начало фразы) | Сейчас | Предлагаю | Почему | Тип |
|---|---|---|---|---|
| Reporting a problem, абзац 1, конец | `Your device, iOS version and the screen you were on are not included — mention them if they matter.` | `Your device, iOS version and the screen where the problem happened are not included — mention them if they matter.` | Политика пишет, что с отчётом сохраняется «the screen you sent them from» (это всегда Profile). «the screen you were on» читается как то же самое, и две страницы противоречат друг другу. | лучше так |
| Reporting a problem, абзац 2 | `…and the approximate time — that is usually enough to find the request in the logs.` | `…and the approximate time — that is usually enough to track down the problem.` | **Важно:** по политике журналы Vercel хранятся около часа. Письмо, пришедшее на следующий день, «в журналах» уже не найти. | лучше так |
| Does calendar sync expose…? | `No. Only the time span leaves your phone — start and end. Titles, notes and locations stay on the device.` | `No. Only the start and end times leave your phone, along with technical identifiers that let the next sync update the same entry. Titles, notes and locations stay on the device.` | **Важно:** после T-269 политика говорит, что вместе со временем уходят технические идентификаторы события и календаря. «Only the time span leaves your phone» теперь обещает меньше, чем уходит на самом деле. | лучше так |
| I signed up with Google or Apple… | `…we email a code to the account’s address, and you choose a password.` | `…we email a code to your account’s email address, and you choose a password.` | Голое «address» (термины T-256). | лучше так |

Абзацы поддержки об удалении аккаунта и об инвайт-ссылке оставить как есть. Они точные, звучат по-американски, и названия в них совпадают с приложением: «Delete Account», «Share Link», «only admin».

### Ответы на вопросы 1–5

**1. Звучит ли как написанное по-английски, понятно ли обычному человеку.**
- Да. Это обычный американский plain English: «Your data lives for as long as your account does», «not “Dentist”». Технические слова (keyed hash, bcrypt) объяснены рядом.
- Не по-американски три вещи. 24-часовое время в примере заметит каждый (ошибка). Дату «18 November» и точку или запятую за кавычками заметит редактор.
- Неуклюже звучат «each only for what it does», «Your name is taken once», начало «Delete the account and everything tied to it…» и «Two records outlast that».
- Обещания шире фактов: лид, «anyone else», «no one except the providers», «never recoverable … by anyone else», «find the request in the logs», «Only the time span leaves your phone». Всё это в таблицах.

**2. Пол читателя.** Не угадывается ни на одной из двух страниц. Везде «you», о третьих лицах — «they/their»: «they tap “Share Link”», «their other members». Ни «he», ни «she».

**3. Limited Use.**
- В en это оригинал, не перевод. Фраза грамотная, звучит естественно, я её не трогал.
- Для сведения: это не дословный образец Google, а равнозначный вариант. Образец в справке Google: «{App’s} use of information received from Google APIs will adhere to Google API Services User Data Policy, including the Limited Use requirements.» (https://support.google.com/cloud/answer/13463817). Справка подаёт его как пример.
- Наша фраза говорит то же самое, а «use and transfer» даже полнее. Если владелец хочет образец буква в букву, менять вместе с `LIMITED_USE` в `privacyPage.test.js`.

**4. Названия функций Apple и Google.**
- Совпадают: Hide My Email, Sign in with Apple, Apple Account (не Apple ID), Sign in with Google, Google Account, Gmail, Google Calendar, Google Contacts.
- Расходится одно — глагол у Google. Для входа кнопка в аккаунте Google называется «Stop using Sign in with Google», а «Remove access» относится к приложениям с доступом к данным. Это строка в таблице.
- Справка Google теперь ведёт на другой адрес ссылки — вопрос В5.
- У Apple путь на iPhone такой: Settings → [your name] → Sign in with Apple → приложение → Delete. Нынешнее «in your Apple Account settings» верно; путь можно дать вместе с фразой из вопроса В4.
- Сверял по страницам:
  - https://support.apple.com/en-us/102571 — «Manage your apps with Sign in with Apple»: Hide My Email, Apple Account, путь и кнопка Delete;
  - https://support.apple.com/en-us/102609 — «What is Sign in with Apple?»: Hide My Email;
  - https://support.google.com/accounts/answer/13533235 — «Manage links between your Google Account & apps from other developers»: Sign in with Google, Google Account, «Stop using Sign in with Google», «doesn’t delete your data on the app»;
  - https://support.google.com/accounts/answer/16363505 — «Manage your linked apps»: адрес `myaccount.google.com/linkedapps`.

**5. Названия экранов.**
- Совпадают со строками en:
  - Profile → Calendar Sync (`profile.title` и `calendarSync.title`; тем же словом подписана строка в профиле);
  - Auto Sync (`calendarSync.autoSync`);
  - Profile → Edit Profile, Profile → Delete Account, Profile → Notifications;
  - на странице поддержки: Profile → About → Report a Bug, “Send”, “Forgot Password?”, “Share Link”.
- Расхождений нет.

### Вопросы владельцу о фактах (не правки)

- **В1. Когда пишется хеш IP.**
  - Таблица говорит «When you sign in or open an invite link». Но `app.js:119` ставит `limitOperationIp('auth')` на весь `/api/auth`: регистрация, вход, Google и Apple, `/refresh`, `GET/PUT/DELETE /me`, выход, коды, сброс пароля, смена адреса.
  - Кроме того, есть счётчик приглашений на аккаунт: `native_invite_account_rate_limits` (id пользователя, минута, число попыток, удаляется с аккаунтом). Он связан с аккаунтом, и в таблице его нет.
  - Если подтвердится, текст: Why `To limit repeated sign-in, account and invite attempts`, When `On sign-in and other account requests from the app, and when you open an invite link`.
- **В2. Кто видит «просмотрено».**
  - В листе репетиции у каждого участника стоит глаз «видел / не видел» (`RehearsalDetailsScreen.tsx:214–235`). Этот список видит каждый, кто есть в репетиции: `GET …/responses` отдаёт его любому, кто видит репетицию (`rehearsals.js:345`). Только счётчик «3/10» видят одни администраторы.
  - Таблица говорит «To show the people running the project…». Если подтвердится: `To show who has seen a rehearsal to the people running the project and to others on the same rehearsal`.
- **В3. Подрядчики.**
  - «each of these providers … uses it only to provide its service to us» распространяется и на Google и Apple в роли входа. А они работают с данными человека по своим политикам, так что за них это обещание шире, чем мы можем дать.
  - Вариант, который сохраняет нужную Apple формулу (5.1.1(i)) и тест: `We confirm that each of these providers that receives your data from us gives it the same or equal protection as stated in this policy, and uses it only to provide its service to us.`
- **В4. Отказ от Sign in with Apple.**
  - О Google сказано, что отзыв доступа данные не удаляет, об Apple — нет. В коде сервера уведомлений Apple об отзыве нет (`consent-revoked`, `account-delete` не найдены), значит, у Apple так же.
  - Если подтвердится, конец абзаца об Apple: `You can stop using Sign in with Apple for Rehearsly on your iPhone in Settings → [your name] → Sign in with Apple. As with Google, this does not delete what we already hold; deleting your Rehearsly account does.`
- **В5. Ссылка на аккаунт Google.**
  - Ссылка ведёт на `https://myaccount.google.com/connections`, а справка Google теперь ведёт на `https://myaccount.google.com/linkedapps` («linked apps page»).
  - Перенаправляет ли старый адрес, я не проверял: myaccount без входа не открыть.
  - Предлагаю сменить только href, текст ссылки оставить (во всех четырёх языках он ведёт туда же).
- **В6. Фото Google.** «Google’s sign-in token may also carry your profile photo … we do not use or keep them» станет правдой только после шага данных 014 (в evidence он открыт).

### Что из предложенного задевает тесты (для разработчика)

- `privacyProcessors.test.js:52` — дата «18 November».
- `privacyPage.test.js`, `AFTER_DELETION.en.stays`: `/become its administrator/`, `/no automatic time limit/`, `/deleted from the inbox or the account it was sent to is deleted/` — при любом варианте D1 в моём тексте. `removal` (`/except your name in notifications already sent/`) — при D1, вариант 1.
- `oldButton: 'Clear imported'` сравнивает с учётом регистра, поэтому «Remove Imported Busy Times» его не задевает.
- Остальные en-шаблоны мои правки сохраняют: processors, ipHash, hostingLogs, restoreHistory, keepsImported, free, `SIGN_IN.says`, appleEvery, appleOnce, delivery, tokenExtras, `Profile → Calendar Sync`, `Auto Sync`.

## 3. Часть B

| Ключ | Строка |
|---|---|
| `clearImported` | Remove Imported Busy Times |
| `clearImportedConfirm` | Remove All Imported Busy Times? |
| `clearImportedMessage` | Busy times imported from calendars on all your devices will be removed from Rehearsly. Anything you marked yourself will stay. |
| `autoSyncTurnsOff` | Auto Sync will also be turned off — otherwise the next sync would bring it all back. |
| `clearImportedSuccess` | All imported busy times removed |
| `chooseProviderFirst` | To turn on Auto Sync, select Google Calendar or Apple Calendar below. |

Почему так:
- Кнопка — пара к кнопке над ней: Remove Exported Rehearsals → Remove Imported Busy Times, та же длина (26 знаков).
- Глагол тот же — Remove, а не Delete. Занятость убирается из Rehearsly, а события в календарях остаются; Delete в iOS значит «уничтожить».
- Слова — с экранов: Imported, busy, Mark → marked, Auto Sync, Select Calendar.
- `autoSyncTurnsOff` не ссылается на соседнее предложение. Поэтому он одинаково читается под обоими заголовками и как единственный текст окна «удалить экспортированные», где поясняющего текста нет.

Как это читается на экране:
- Окно новой кнопки, автосинхронизация включена: **Remove All Imported Busy Times?** — «Busy times imported from calendars on all your devices will be removed from Rehearsly. Anything you marked yourself will stay. Auto Sync will also be turned off — otherwise the next sync would bring it all back.» Кнопки: Cancel / Remove Imported Busy Times.
- Окно старой кнопки, автосинхронизация включена: **Remove All Rehearsals from the Calendar?** — «Auto Sync will also be turned off — otherwise the next sync would bring it all back.»
- Включение без календаря: **Select Calendar** — «To turn on Auto Sync, select Google Calendar or Apple Calendar below.» Варианты действительно ниже переключателя, и выбор календаря сам включает синхронизацию (`handleSelectProvider`).

## 4. Часть C

Sync is off until you turn it on. Turning off Auto Sync in Profile → Calendar Sync stops new imports but does not remove the busy periods already imported: they stay on your account, and other members of your projects still see you as busy at those times. To clear them, tap “Remove Imported Busy Times” on the same screen. It removes the busy periods imported from calendars on all your devices; anything you marked yourself stays. It also turns off Auto Sync on the device where you tap it. Another device that still has Auto Sync on will send its busy periods again the next time it syncs. Deleting your account also removes everything imported this way.

Тест `keepsImported` (`Turning off Auto Sync … does not remove` в одной фразе) не задет. По желанию в «Your rights» можно добавить пункт: «Remove imported busy times — Profile → Calendar Sync → “Remove Imported Busy Times”».

## 5. Часть D

**D1, вариант 1 — удаляем по-настоящему** (вместо абзаца «One thing stays with other people…»):

Deleting your account also removes the notifications with your name — the ones sent when you joined a project, became an admin or marked a rehearsal as seen — from the in-app inboxes of the people who run those projects. A push notification already shown on someone else’s phone stays on that phone; we have no way to reach it.

При этом варианте поменяется и первая фраза в «How to remove it», иначе она обещает исключение, которого больше нет:

Profile → Delete Account removes it from our database along with the rest of your account; “How long we keep it” says what outlasts the deletion.

**D1, вариант 2 — исключение остаётся** (правки нужны, все «лучше так»):

One thing stays with other people. When you join a project, become one of its admins or mark a rehearsal as seen, the people who run that project get a notification with your name. It goes to their in-app inboxes, and deleting your account does not remove it. It does not expire on its own: it stays until they delete it or delete their own account.

- `become its administrator` → `become one of its admins`. «its administrator» значит «единственный администратор», а их бывает несколько. В том же разделе уже стоит «admin».
- `It sits in their inboxes` → `It goes to their in-app inboxes`. Важно: без «in-app» читатель думает о почтовом ящике.
- `There is no automatic time limit: it stays until it is deleted from the inbox or the account it was sent to is deleted.` → `It does not expire on its own: it stays until they delete it or delete their own account.` Действительный залог: сразу ясно, кто удаляет. «their own» отделяет аккаунт получателя от «your account».

**D2, вариант 1 — по почте:**

If we change this policy, we will post the new version on this page and update the date at the top. Before a material change takes effect, we will also email you about it at your account’s email address.

**D2, вариант 2 — только дата:**

If we change this policy, we will post the new version on this page and update the date at the top.

## 6. Итог

правок в A: 35 (ошибок: 2); B, C, D готовы

## 7. Часть E — общие правки смысла

Решения владельца учтены: D1 — вариант 1 (удаляем по-настоящему), D2 — вариант 1 (по почте). Сверил:
- новые для меня пункты: E9 — по схеме (`native_member_availability_rate_limits`, `native_invite_account_rate_limits`: id пользователя, минута, счётчик, `ON DELETE CASCADE`); E14 — по https://support.apple.com/en-us/105078 (опубликовано 26.10.2026: «@private.icloud.com or @privaterelay.appleid.com»);
- E24 — по `onboarding.ts`: в en варианты подписаны «Google Calendar» / «Apple Calendar».

Если пункт заменяет строку части A, это сказано в колонке «Где».

| Пункт | Где | Итоговый текст |
|---|---|---|
| E1 | Лид | уже в части A, строка «Лид»: `Rehearsly keeps only what it needs to run the app and schedule rehearsals.` |
| E2 | Who else processes your data, фраза под списком | уже в части A, строка «Под списком, «We do not share…»»: `We do not share your data with any other company, and we never sell it.` |
| E3 | Google and Apple sign-in data → Where it is kept and who receives it, абзац целиком. Заменяет строку части A «Where it is kept…». Новое против части A — «when we email you» вместо «when we send you a code»: по E18 и E25 Resend шлёт и письма об изменениях политики. | `It is kept in our database, hosted by Neon, with the rest of your account data. We do not sell it. Apart from showing your name to the members of your projects, we pass it only to the providers that run Rehearsly for us: Neon stores it, Vercel runs our server, Resend receives your email address when we email you, and Expo Push Service with Apple’s APNs delivers the notifications that show your name to the people who run your projects. We do not use it for advertising or to train AI or machine-learning models.` |
| E4 | Security, вторая фраза | уже в части A, строка «Security»: `Passwords are stored only as bcrypt hashes, so we cannot see or recover them.` |
| E5 | Children, вторая фраза. Заменяет строку части A «Children»: вместо «we will remove it» — «we will delete the account», чтобы «it» нельзя было отнести к ребёнку. | `If you believe a child under 13 has created an account, write to us and we will delete the account.` |
| E6 | What we deliberately do not collect, пункты 1 и 3 | уже в части A: `No location data from your phone` / `No access to your photos, camera or microphone` |
| E7 | Таблица, push-токен, колонка Why | уже в части A, строка «Push token»: `To deliver notifications about your projects and rehearsals` |
| E8 | Таблица, хеш IP, колонки Why и When; колонка Data не меняется. Заменяет строку части A «хеш IP, колонка Why». | Why: `To limit repeated attempts to sign in, make account requests or open invite links` · When: `On sign-in and other account requests from the app, and when you open an invite link` |
| E9 | Таблица, новая строка сразу после строки о хеше IP | Data: `Two request counters linked to your account: one for joining projects through invite links, the other for loading project members’ availability. Each counts requests for one minute, then starts over; both are deleted with your account` · Why: `To limit how often these requests can be made` · When: `When you join a project through an invite link, or when the app loads members’ availability — in the Smart Planner or while you add or edit a rehearsal` |
| E10 | Таблица, «Which rehearsals you have marked as seen», колонка Why | `To show the people running the project, and others on the same rehearsal, who has seen it` |
| E11 | Who else processes your data, подтверждение под списком | `We confirm that each of these providers that receives your data from us gives it the same or equal protection as stated in this policy, and uses it only to provide its service to us.` |
| E12 | Sign in with Apple, второй абзац целиком. Путь — по справке Apple 102571: Settings → [your name] → Sign in with Apple. | `We use, keep and pass on this data exactly as described above for Google, and Profile → Delete Account removes it in the same way. You can stop using Sign in with Apple for Rehearsly in your Apple Account settings on your iPhone: Settings → [your name] → Sign in with Apple. As with Google, this does not delete what we already hold; deleting your Rehearsly account does.` |
| E13 | How to remove it, о Google. Адрес ссылки меняет разработчик (`/linkedapps`), текст ссылки «Google Account settings» остаётся. | уже в части A, строка «How to remove it, о Google»: `You can also stop using Sign in with Google for Rehearsly in your Google Account settings. That ends the link on Google’s side but does not delete what we already hold; deleting your Rehearsly account does.` |
| E14 | Sign in with Apple, первый абзац, третья фраза | `If you choose Hide My Email, we receive and keep a private address ending in @privaterelay.appleid.com or @private.icloud.com instead of your real one.` |
| E15 | How long we keep it, абзац 1, вторая фраза. Заменяет строку части A «Delete the account and…» и включает её правку. | `When you delete your account, everything tied to it — your availability (including busy times imported from your calendars), your notifications, seen marks, sign-in records, push tokens, email code records, project memberships — is removed from our database along with it.` |
| E16 | Your rights, новый пункт после «Stop calendar import». Часть до тире — в strong, как у соседних пунктов. | уже в части C (там предложен по желанию, теперь окончательно): `Remove imported busy times — Profile → Calendar Sync → “Remove Imported Busy Times”.` |
| E17 | How long we keep it, абзац 2, и первая фраза в How to remove it | уже в части D (D1, вариант 1). Как оба раздела выглядят целиком, со всеми правками, — ниже таблицы. |
| E18 | Changes | уже в части D (D2, вариант 1): `If we change this policy, we will post the new version on this page and update the date at the top. Before a material change takes effect, we will also email you about it at your account’s email address.` |
| E19 | Limited Use, ссылка на политику Google | не нужно: страница Google на английском, как и сам блок. |
| E20 | support, «Does calendar sync expose…?» | уже в части A: `No. Only the start and end times leave your phone, along with technical identifiers that let the next sync update the same entry. Titles, notes and locations stay on the device.` |
| E21 | support, Reporting a problem, абзац 2 | уже в части A: `…and the approximate time — that is usually enough to track down the problem.` |
| E22 | support, Reporting a problem, абзац 1, конец | уже в части A: `Your device, iOS version and the screen where the problem happened are not included — mention them if they matter.` |
| E23 | Your rights, названия экранов | не нужно: в en названия совпадают с приложением — Profile → Notifications (`profile.notifications` = Notifications), Profile → Delete Account, Profile → Edit Profile, Profile → Calendar Sync. Путь iOS добавлен в части A, строка «Your rights, «Stop notifications»». |
| E24 | `calendarSync.chooseProviderFirst` | уже в части B, без изменений: в en онбординг называет варианты так же (`onboarding.calendarSync.google` = Google Calendar, `.apple` = Apple Calendar). `To turn on Auto Sync, select Google Calendar or Apple Calendar below.` |
| E25 | (1) Who else processes your data, пункт Resend; «Resend» остаётся в strong. Заменяет строку части A о Resend. (2) Why we use it, фраза об адресе почты. Заменяет строку части A «Your email address is…». Третье место с той же целью — «when we email you» — вошло в E3. | (1) `Resend — sends our emails: your codes for signing up, resetting your password and changing your email address, and notices of material changes to this policy; it receives your email address and the message (EU, Ireland)` (2) `Your account uses this email address: the codes you ask for, such as a password reset code, are sent to it, and so are our notices of material changes to this policy.` |
| E26 | support, первый абзац. Адрес остаётся ссылкой mailto. | `Write to support@rehearsly.me and you will get a reply within two business days. Answers come from a real person, not an auto-reply.` |

### Сводно: два раздела, где сходятся несколько правок

**How to remove it** — D1, вариант 1, и E13. Ссылка — на «Google Account settings».

Profile → Delete Account removes it from our database along with the rest of your account; “How long we keep it” says what outlasts the deletion. You can also stop using Sign in with Google for Rehearsly in your Google Account settings. That ends the link on Google’s side but does not delete what we already hold; deleting your Rehearsly account does.

**How long we keep it** — E15, D1 вариант 1 и строки части A:

Your data lives for as long as your account does. When you delete your account, everything tied to it — your availability (including busy times imported from your calendars), your notifications, seen marks, sign-in records, push tokens, email code records, project memberships — is removed from our database along with it. The projects you own go too, with all their rehearsals, and so do projects where you were the only admin; their other members lose them. The app warns you about the projects you own before it proceeds and tells you afterwards how many were deleted. Rehearsals you created in the remaining projects stay there, without your name.

Deleting your account also removes the notifications with your name — the ones sent when you joined a project, became an admin or marked a rehearsal as seen — from the in-app inboxes of the people who run those projects. A push notification already shown on someone else’s phone stays on that phone; we have no way to reach it.

Two other records outlast your account for a short time. Neon keeps a history of database changes for up to 7 days so that the database can be restored after a failure, and deleted data leaves it when that period ends. Vercel’s hosting logs are kept for about an hour.

### Вопрос владельцу (следствие E25, не правка)

Почта теперь нужна ещё и для писем об изменениях политики. Но два места перечисляют цели как полный список, и письма в них не названы:
- **Раздел о Google, первая фраза.** Сейчас: «Only to create your account, sign you in and show your name to the members of your projects.» Если закрывать: `Only to create your account, sign you in, send you account emails and show your name to the members of your projects.`
- **Таблица, строка «Email address, first and last name», колонка Why.** Сейчас: «To create your account and show who is in a project». Если закрывать: `To create your account, email you about it and show who is in a project`.
