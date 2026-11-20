# T-269 и T-270 — вычитка немецкого (de): политика, поддержка, кнопка «удалить импортированное»

## 1. Кто читал

Носитель немецкого, редактор продуктовых и юридических текстов: Datenschutzerklärungen по DSGVO и интерфейсы на «du». Работаю с любительскими театрами, хорами и Tanzgruppen. iPhone на немецком.

Прочитано целиком:
- `privacy.html`, блок de (883–1173);
- `support.html`, блок de (265–343);
- для смысла — блок en обеих страниц, diff `621d3a5..25e2d1d` и `audit/evidence/T-269/privacy-policy.md`;
- строки приложения: `calendarSync.ts`, `profile.ts`, `availability.ts`, `calendar.ts`, `notifications.ts`, `onboarding.ts`, `auth.ts`, `projects.ts`;
- экран `CalendarSyncSettingsScreen.tsx`;
- утверждённые слова из T-256, T-261 и T-276 (de).

## 2. Часть A

Тире в столбце «Предлагаю» — уже немецкое «–» (строка 23). Разметку (`<strong>`, ссылки) правки не трогают: меняется только текст внутри.

| # | Где (раздел, начало фразы) | Сейчас | Предлагаю | Почему | Тип |
|---|---|---|---|---|---|
| 1 | Deine Rechte, «Benachrichtigungen abschalten» | Benachrichtigungen abschalten — Profil → Benachrichtigungen oder die Geräteeinstellungen. | Mitteilungen abschalten – Profil → Mitteilungen oder die Geräteeinstellungen. | В профиле нет пункта «Benachrichtigungen». Переключатель называется «Mitteilungen» (`profile.notifications`), так же он назван и на странице поддержки. Человек ищет в профиле то, чего там нет. | ошибка |
| 2 | Таблица, строка «Push-Token…»; список подрядчиков, «Expo Push Service» | Benachrichtigungen zu deinen Proben zustellen · Nur wenn du Benachrichtigungen erlaubst · … und darüber Apples APNs — Zustellung von Benachrichtigungen | Mitteilungen zu deinen Proben zustellen · Nur wenn du Mitteilungen erlaubst · … und darüber Apples APNs – Zustellung von Mitteilungen | В iOS и во всём приложении это «Mitteilungen». Системный запрос так и звучит: «… möchte dir Mitteilungen senden». Сама политика ниже тоже пишет «Mitteilungen» (входящие, имя в уведомлениях). Два слова на одно понятие читаются как две разные вещи. | лучше так |
| 3 | Таблица, строка «Beginn und Ende deiner Kalendereinträge…» | Beginn und Ende deiner Kalendereinträge sowie technische Kennungen des Eintrags und des Kalenders — niemals deren Titel | Beginn und Ende deiner Kalendertermine sowie technische Kennungen jedes Termins und seines Kalenders – niemals ihre Titel | Сейчас после «Kalendereinträge» (мн. ч.) идёт «des Eintrags» (ед. ч.). «deren» грамматически цепляется к ближайшему «Kennungen». Событие календаря в этом тексте и в приложении — «Termin» (так в абзаце ниже). `<strong>` остаётся вокруг «niemals ihre Titel». | лучше так |
| 4 | Та же строка, столбец «Wozu» | Sie automatisch in belegte Zeiten umwandeln | Automatisch als belegte Zeiten eintragen | В тексте на «du» «Sie» с заглавной в начале ячейки читается как вежливое «Вы». Та же ловушка была в T-256 (строка 11). | лучше так |
| 5 | Таблица, строка «Einmalcodes per E-Mail» | gespeichert wird nur ein mit Schlüssel gebildeter Hash des Codes und die Adresse, an die er ging | gespeichert werden nur ein mit einem geheimen Schlüssel gebildeter Hash des Codes und die Adresse, an die er ging | Два подлежащих — глагол во множественном числе. «mit Schlüssel» без артикля звучит как перевод «keyed». «geheim» объясняет обычному читателю, зачем нужен ключ, и смысла не меняет: ключ — секрет сервера. Если «geheim» не нужно, то хотя бы «mit einem Schlüssel». | лучше так |
| 6 | Таблица, строка «Ein mit Schlüssel gebildeter Hash deiner IP-Adresse…» | Ein mit Schlüssel gebildeter Hash deiner IP-Adresse mit einem Anfragezähler — nie die Adresse selbst. Er zählt Anfragen eine Minute lang und ist nicht mit deinem Konto verknüpft; alte Einträge werden durch neue Anfragen ersetzt oder entfernt | Ein mit einem geheimen Schlüssel gebildeter Hash deiner IP-Adresse samt Anfragezähler – nie die Adresse selbst. Gezählt wird jeweils eine Minute lang; der Eintrag ist nicht mit deinem Konto verknüpft, und alte Einträge werden ersetzt oder entfernt, sobald neue Anfragen eingehen | Сейчас в одной группе два «mit». «Er zählt» выходит, будто считает хеш. «durch neue Anfragen ersetzt» значит, что записи заменяются запросами, а в en — «as new requests arrive». | лучше так |
| 7 | Таблица, строка «Welche Proben du als gesehen markiert hast» | Denen, die das Projekt leiten, zeigen, wer eine Probe gesehen hat | Den Personen, die das Projekt verwalten, zeigen, wer eine Probe gesehen hat | Во всех остальных местах политики эта группа — «die Personen, die das Projekt verwalten». «leiten» звучит как «режиссёр, руководитель», а в приложении это роль админа (verwalten). | лучше так |
| 8 | Zum Kalenderimport, абзац 1, «Wenn du die Synchronisation einschaltest» | liest Rehearsly den von dir gewählten Kalender auf deinem Telefon | liest Rehearsly den von dir gewählten Kalender auf deinem iPhone | «Telefon» о смартфоне звучит устаревше, а на iPhone так называется приложение для звонков (глоссарий T-256). Приложение только для iPhone, и рядом в тексте стоит «über iOS». | лучше так |
| 9 | Zum Kalenderimport, абзац 3, «Wenn du Auto-Sync ausschaltest» | stoppt das neue Importe, aber bereits importierte belegte Zeiten werden nicht gelöscht: | kommen keine neuen Zeiten mehr hinzu, die bereits importierten werden aber nicht gelöscht: | «neue Importe» по-немецки — прежде всего ввезённые товары. «stoppt das» — разговорно. Весь абзац с этой правкой — в части C. | лучше так |
| 10 | Zahlungen | Rehearsly ist kostenlos und enthält keine Käufe. | Rehearsly ist kostenlos und enthält keine In-App-Käufe. | Покупку приложение не «содержит». Устоявшийся термин App Store — «In-App-Käufe». Вместе с «kostenlos» сказано всё: денег нет нигде. | лучше так |
| 11 | Was wir von Google erhalten, абзац, «Liegt ein Google-Kalender…» | Liegt ein Google-Kalender auf deinem Telefon und du schaltest die Synchronisation ein, liest die App ihn wie oben beschrieben über iOS und nicht über Google. | Ist auf deinem iPhone ein Google-Kalender eingerichtet und schaltest du die Synchronisation ein, liest die App ihn wie oben beschrieben über iOS und nicht über Google. | Условие начато с глагола, а после «und» сбивается на прямой порядок. Сначала читается «ein Google-Kalender … und du» как одно подлежащее. Так говорят устно, но в письменном тексте лучше без этого. Календарь в iOS «eingerichtet», а не «liegt». И «Telefon» — как в строке 8. | лучше так |
| 12 | Wozu wir sie nutzen, «Gibt es schon ein Konto…» | wird Google damit verknüpft, und das Konto behält seinen Namen. | wird dein Google-Konto damit verknüpft, und dein bisheriger Name bleibt. | Привязывается Google-аккаунт, а не «Google». Так говорит и само приложение: «Dein Google-Konto wurde mit deinem bestehenden Konto verknüpft». После правки «das Konto» стало бы двусмысленным, поэтому говорю об имени прямо. | лучше так |
| 13 | Wie du sie entfernst, «Das beendet die Erlaubnis…» | dafür musst du dein Konto löschen. | dafür musst du dein Rehearsly-Konto löschen. | Фраза стоит сразу после «Einstellungen deines Google-Kontos». «dein Konto» можно понять как Google-аккаунт, а удалять его человеку не нужно. Rehearsly в сложном слове не склоняется, как в «Rehearsly-App». | лучше так |
| 14 | Mit Apple anmelden, абзац 1, «Bei jeder Anmeldung…» | Bei jeder Anmeldung gibt uns Apple deine Kontokennung und, wenn das Anmeldetoken sie enthält, deine E-Mail-Adresse und die Bestätigung, dass sie verifiziert ist. | Bei jeder Anmeldung gibt uns Apple deine Kontokennung. Steht im Anmeldetoken auch deine E-Mail-Adresse, bekommen wir sie ebenfalls, zusammen mit der Bestätigung, dass sie verifiziert ist. | Первое «sie» указывает вперёд, на два слова сразу, и его можно отнести к «Kontokennung». В одной фразе три «sie». Смысл тот же: идентификатор приходит всегда, почта — если она есть в токене. | лучше так |
| 15 | Mit Apple anmelden, абзац 1, «Wählst du „E-Mail-Adresse verbergen“» | erhalten und speichern wir statt deiner echten Adresse eine private auf @privaterelay.appleid.com. | erhalten und speichern wir statt deiner echten Adresse eine private, die auf @privaterelay.appleid.com endet. | «eine private auf @…» — обрывок без глагола: «частную на @…». Адрес по-немецки «endet auf …». | лучше так |
| 16 | Mit Apple anmelden, абзац 2, «Die Anmeldung mit Apple…» | Die Anmeldung mit Apple für Rehearsly kannst du in den Einstellungen deines Apple-Kontos beenden. | Die Verwendung von „Mit Apple anmelden“ für Rehearsly kannst du in den Einstellungen deines Apple Accounts beenden. | Это указание, где искать, поэтому имена — как у Apple. По-немецки у Apple «Apple Account» («Apple Account-Einstellungen», «deines Apple Accounts»), а не «Apple-Konto». Формула Apple: «die Verwendung von „Mit Apple anmelden“ … beenden». Адреса — в вопросе 4. | лучше так |
| 17 | Wie lange wir sie speichern, первая фраза | Deine Daten existieren, solange dein Konto existiert. | Deine Daten speichern wir, solange dein Konto besteht. | «existieren … existiert» — повтор и калька с «lives for as long as». | лучше так |
| 18 | Wie lange wir sie speichern, список удаляемого | Verfügbarkeit, importierte Termine, deine Mitteilungen | Verfügbarkeit, importierte Zeiten, deine Mitteilungen | Вся политика обещает, что события (Termine) к нам не приходят, только время («belegt von 14:00 bis 15:30, nicht „Zahnarzt“»). «importierte Zeiten» — те же слова, что у новой кнопки (часть B). | лучше так |
| 19 | Wie lange wir sie speichern, «Eines bleibt bei anderen Personen» | Wenn du einem Projekt beitrittst, zu seiner Verwaltung ernannt wirst oder eine Probe als gesehen markierst | Wenn du einem Projekt beitrittst, darin Adminrechte bekommst oder eine Probe als gesehen markierst | «zu seiner Verwaltung ernannt» — канцелярит: «Verwaltung» — это управление как учреждение. В приложении это «Adminrechte» («Adminrechte geben»), без рода. Правка нужна при любом решении по D1. | лучше так |
| 20 | Wie lange wir sie speichern, «Zwei Aufzeichnungen…» | gelöschte Daten fallen nach Ablauf dieser Frist heraus. | nach Ablauf dieser Frist verschwinden gelöschte Daten auch daraus. | «herausfallen» — расплывчато и разговорно для юридического текста. | лучше так |
| 21 | Sicherheit, первая фраза | Der gesamte Verkehr läuft über HTTPS. | Der gesamte Datenverkehr läuft über HTTPS. | «Verkehr» без уточнения — уличное движение. | лучше так |
| 22 | Kinder, «Wenn du glaubst…» | schreib uns — wir entfernen es. | schreib uns – wir löschen das Konto. | «es» грамматически может значить и «Konto», и «Kind» (оба среднего рода): «мы удалим ребёнка». | лучше так |
| 23 | Весь блок de политики | «—» (Geviertstrich), 20 раз | «–» (Halbgeviertstrich) с пробелами | В немецком тексте тире — «–». Так в приложении (глоссарий T-256) и на немецкой странице поддержки. Сейчас две немецкие страницы сайта набраны по-разному. | лучше так |
| 24 | support, «Verrät die Kalendersynchronisation…» | Andere in deinen Projekten sehen, dass du belegt bist, nie warum. | Andere in deinen Projekten sehen, dass du beschäftigt bist, nie warum. | «belegt» говорят о времени, месте, линии, а не о человеке: «du bist belegt» — «ты занят, как стул». О человеке — «beschäftigt», как в приложении («wann du beschäftigt bist»). | ошибка |
| 25 | support, тот же ответ | Nein. Dein Telefon verlässt nur der Zeitraum – Beginn und Ende. | Nein. Nur der Zeitraum verlässt dein iPhone – Beginn und Ende. | «Telefon» — как в строке 8. Порядок «дополнение — глагол — подлежащее» верен, но спотыкаешься: «Dein Telefon» сначала читается как подлежащее. | лучше так |
| 26 | support, «Ein Einladungslink funktioniert nicht» | Bitte jemanden mit Admin-Rechten im Projekt um einen neuen | Bitte jemanden mit Adminrechten im Projekt um einen neuen | В приложении слитно: «Adminrechte geben», «Adminrechte entziehen». | лучше так |

### Ответы на вопросы

**1. Звучит ли как написанное по-немецки и понятно ли обычному человеку?**

Да. Это живой немецкий на «du», а не перевод:
- глагол на месте;
- кавычки „…“ везде;
- удачные места: «Auf unserem Server landet „belegt von 14:00 bis 15:30“, nicht „Zahnarzt“», «An niemanden sonst geben wir Daten weiter, und verkauft werden sie nie».

Следы перевода есть в немногих местах, все они в таблице:
- «stoppt das neue Importe»;
- «Deine Daten existieren, solange dein Konto existiert»;
- «Der gesamte Verkehr»;
- «eine private auf @privaterelay…»;
- «enthält keine Käufe»;
- сломанное условие в абзаце о Google-календаре.

Обычному человеку текст понятен. Hash, Token и APNs стоят там, где без них нельзя, и смысл вокруг них ясен. Длинные фразы — в абзаце о Kalenderimport и об Apple, вторую я разбил (строка 14).

**2. Угадывается ли пол читателя?**

Нигде, ни в политике, ни в поддержке.
- «Jeder dieser Dienste … seine Leistung» — о сервисах (der Dienst), не о людях.
- «jemanden mit Admin-Rechten», «die Personen, die … verwalten», «Mitglieder» (das Mitglied), «Teilnehmende» — нейтральны.
- Вопрос в поддержке от первого лица («Ich habe mich … registriert») по-немецки рода не выдаёт.
- «einem unabhängigen Entwickler» — о самом операторе, это верно.
- «Teilnehmende» отличается от «Teilnehmer» в приложении. Для юридического текста это нормально, и тест страницы это закрепляет. Не правлю.
- Rehearsly нигде не склоняется. В моих правках оно стоит только в сложном слове «Rehearsly-Konto».

**3. Точен ли перевод Limited Use?**

Да, точен: «Die Nutzung und Weitergabe von Informationen, die Rehearsly über Google-APIs erhält, entspricht der Richtlinie zu Nutzerdaten der Google-API-Dienste (Google API Services User Data Policy), einschließlich der Anforderungen an die eingeschränkte Nutzung (Limited Use).»
- На месте все части: use = Nutzung, transfer = Weitergabe, received from Google APIs, adheres = entspricht, название политики, including the Limited Use requirements.
- Единственное число «entspricht» при «Nutzung und Weitergabe» допустимо: в юридическом немецком эта пара читается как одно понятие.
- Официального немецкого названия у политики Google нет: страница существует только по-английски (проверил `?hl=de`). Поэтому описательный перевод с английским названием в скобках — правильное решение.
- Английский оригинал на странице не тронут. Правок нет.

**4. Названия функций Apple и Google**

| В тексте | У Apple / Google по-немецки | Вердикт |
|---|---|---|
| „E-Mail-Adresse verbergen“ | „E-Mail-Adresse verbergen“ | верно |
| Mit Apple anmelden (заголовок) | „Mit Apple anmelden“ | верно |
| Einstellungen deines Apple-Kontos | Apple Account, «Apple Account-Einstellungen», «deines Apple Accounts»; «Du kannst auch die Verwendung von „Mit Apple anmelden“ für Apps oder Websites beenden» | правка 16 |
| Google-Konto, «Einstellungen deines Google-Kontos» | Google-Konto | верно. Это описание ссылки, а не название экрана. Сама страница у Google называется «verknüpfte Apps», кнопка — «„Über Google anmelden“ nicht mehr verwenden». Описание «Zugriff entziehen» ей соответствует |
| Google Kalender, Google Kontakte, Gmail | «Google Kalender», «Google Kontakte», Gmail | верно |
| Mitteilungen / Benachrichtigungen | Apple: «Mitteilungen» | правки 1 и 2 |
| Einstellungen → Mitteilungen → Rehearsly (support) | так у Apple | верно |

Сверял по страницам:
- https://support.apple.com/de-de/102609 — «Was ist „Mit Apple anmelden“?»: «E-Mail-Adresse verbergen», «Apple Account», обращение на du.
- https://support.apple.com/de-de/102571 — «Apps über „Mit Apple anmelden“ verwalten»: «Apple Account-Einstellungen», «die Verwendung von „Mit Apple anmelden“ … beenden», «E-Mail-Adresse verbergen».
- https://support.apple.com/de-DE/118283 — «Land oder Region deines Apple Accounts ändern»: склонение «deines Apple Accounts».
- https://support.apple.com/de-de/guide/iphone/iph7c3d96bab/ios — «Mitteilungseinstellungen auf dem iPhone ändern»: термин «Mitteilungen».
- https://support.google.com/accounts/answer/13533235?hl=de — «Google-Konto», «Über Google anmelden», «Zugriff entfernen», «„Über Google anmelden“ nicht mehr verwenden». Google здесь обращается на «Sie», так что формы вежливости с ним сверять нельзя, только названия.
- https://support.google.com/calendar/?hl=de — «Google Kalender-Hilfe»: «Google Kalender».
- https://support.google.com/contacts/?hl=de — «Google Kontakte».
- https://developers.google.com/terms/api-services-user-data-policy?hl=de — есть только по-английски, немецкого названия нет (вопрос 3).

**5. Названия экранов приложения**

| В тексте | В приложении (`src/i18n/translations/`) | Вердикт |
|---|---|---|
| Profil → Kalender-Sync | `profile.title` «Profil», `calendarSync.title` «Kalender-Sync» | верно |
| Auto-Sync | `calendarSync.autoSync` «Auto-Sync» | верно |
| Profil → Konto löschen | `profile.deleteAccount` «Konto löschen» | верно |
| Profil → Profil bearbeiten | `profile.editProfile` «Profil bearbeiten» | верно |
| Profil → Benachrichtigungen (Deine Rechte) | `profile.notifications` «Mitteilungen» | **неверно**, правка 1 |
| support: Profil → Über die App → „Fehler melden“, „Senden“ | `profile.about`, `profile.reportBug`, `profile.reportBugSend` | верно |
| support: Profil → Mitteilungen | `profile.notifications` | верно |
| support: „Passwort vergessen?“ | `auth.forgotPassword` | верно |
| support: „Link teilen“ | `projects.shareLink` | верно |

## 3. Часть B

| Ключ | Строка |
|---|---|
| `clearImported` | Alle importierten Zeiten löschen |
| `clearImportedConfirm` | Alle importierten Zeiten löschen? |
| `clearImportedMessage` | Das betrifft alle belegten Zeiten aus deinen Kalendern – auch die von deinen anderen Geräten. Was du selbst eingetragen hast, bleibt. |
| `autoSyncTurnsOff` | Auto-Sync wird auf diesem Gerät ausgeschaltet, sonst wäre nach der nächsten Synchronisation alles wieder da. |
| `clearImportedSuccess` | Alle importierten Zeiten gelöscht |
| `chooseProviderFirst` | Tippe zuerst auf „Google Calendar“ oder „Apple Calendar“. |

Почему так:
- **Пара кнопок.** Кнопка стоит в паре с «Alle exportierten Proben entfernen» и не путается с ней: Proben/Zeiten, entfernen/löschen.
- **Слова приложения.** «importiert» есть на этом экране («Importiert: 5» в итоге синхронизации), «belegte Zeit», «eintragen», «übernehmen» — тоже слова приложения.
- **Длина.** 32 знака против 34 у `removeAll`, в одну строку.
- **Чего избегаю.** «… aus Kalendern löschen» рядом с глаголом читалось бы как удаление из календаря телефона, как у `removeAll`. Поэтому в тексте окна «aus deinen Kalendern» стоит при «Zeiten», а не при глаголе.

**Как это выглядит в окнах:**
- **Удаление импортированного, Auto-Sync включён.** Заголовок «Alle importierten Zeiten löschen?», текст «Das betrifft alle belegten Zeiten aus deinen Kalendern – auch die von deinen anderen Geräten. Was du selbst eingetragen hast, bleibt. Auto-Sync wird auf diesem Gerät ausgeschaltet, sonst wäre nach der nächsten Synchronisation alles wieder da.», кнопки «Abbrechen» · «Alle importierten Zeiten löschen».
- **Удаление экспортированного, Auto-Sync включён.** Заголовок «Alle Proben aus dem Kalender entfernen?», текст «Auto-Sync wird auf diesem Gerät ausgeschaltet, sonst wäre nach der nächsten Synchronisation alles wieder da.». «alles» подходит к обоим окнам: и к пробам, и к занятости.
- **Итог.** Окно «Alle importierten Zeiten gelöscht», по образцу «Alle Proben aus dem Kalender entfernt».
- **Календарь не выбран.** Заголовок «Kalender auswählen», текст «Tippe zuerst auf „Google Calendar“ oder „Apple Calendar“.». Глагол другой, чтобы не повторять «auswählen» из заголовка. Нажатие на вариант само включает синхронизацию, так что совет точен.

**Вопрос к `chooseProviderFirst`.** На этом экране варианты подписаны по-английски («Google Calendar», «Apple Calendar», вшито в экран), а онбординг на немецком говорит «Google Kalender» и «Apple Kalender» (`onboarding.calendarSync.google/apple`). Если подписи экрана когда-нибудь переведут, строка станет такой: «Tippe zuerst auf „Google Kalender“ oder „Apple Kalender“.».

## 4. Часть C

Абзац целиком. В нём уже есть правка 9 из части A («kommen keine neuen Zeiten mehr hinzu»). Если её не брать, первые две фразы остаются как сейчас.

> Die Synchronisation ist aus, bis du sie einschaltest. Wenn du Auto-Sync ausschaltest (Profil → Kalender-Sync), kommen keine neuen Zeiten mehr hinzu, die bereits importierten werden aber nicht gelöscht: Sie bleiben in deinem Konto, und die Mitglieder deiner Projekte sehen sie weiterhin als belegt. Mit der Schaltfläche „Alle importierten Zeiten löschen“ auf demselben Bildschirm entfernst du sie alle, auch die von deinen anderen Geräten; was du selbst eingetragen hast, bleibt. Auto-Sync wird dabei auf diesem Gerät ausgeschaltet; ein anderes Gerät mit eingeschaltetem Auto-Sync schickt seine belegten Zeiten bei seiner nächsten Synchronisation erneut. Auch das Löschen deines Kontos entfernt all das.

## 5. Часть D

### D1, вариант 1 — удаляем по-настоящему (вместо абзаца «Eines bleibt bei anderen Personen…»)

> Wenn du einem Projekt beitrittst, darin Adminrechte bekommst oder eine Probe als gesehen markierst, erhalten die Personen, die das Projekt verwalten, eine Mitteilung mit deinem Namen. Löschst du dein Konto, entfernen wir diese Mitteilungen auch aus deren Posteingang in der App. Push-Mitteilungen, die auf deren Geräten schon angezeigt wurden, bleiben allerdings dort: Darauf haben wir keinen Zugriff.

**При варианте 1 надо поменять ещё одну фразу.** В «Wie du sie entfernst» сейчас стоит оговорка «außer deinem Namen in bereits versendeten Mitteilungen…», при этом варианте она станет неправдой. Замена:

> Profil → Konto löschen entfernt sie zusammen mit deinem übrigen Konto aus unserer Datenbank; was danach noch bleibt, steht unter „Wie lange wir sie speichern“.

Пункт в «Deine Rechte» («was bleibt, steht unter …») остаётся верным: после удаления остаются показанные пуши, история Neon и журналы Vercel.

### D1, вариант 2 — исключение остаётся

Правка одна — та же, что строка 19 в части A: «zu seiner Verwaltung ernannt wirst» → «darin Adminrechte bekommst». Остальное оставить.

> Eines bleibt bei anderen Personen. Wenn du einem Projekt beitrittst, darin Adminrechte bekommst oder eine Probe als gesehen markierst, erhalten die Personen, die das Projekt verwalten, eine Mitteilung mit deinem Namen. Sie liegt in deren Posteingang, und das Löschen deines Kontos entfernt sie nicht. Eine automatische Frist gibt es nicht: Sie bleibt, bis sie aus dem Posteingang gelöscht oder das Konto gelöscht wird, an das sie ging.

### D2, вариант 1 — по почте

> Eine neue Fassung dieser Erklärung veröffentlichen wir auf dieser Seite und aktualisieren das Datum oben. Über wesentliche Änderungen informieren wir dich per E-Mail an die Adresse deines Kontos, bevor sie in Kraft treten.

### D2, вариант 2 — только дата

> Eine neue Fassung dieser Erklärung veröffentlichen wir auf dieser Seite und aktualisieren das Datum oben.

## Для разработчика и владельца (коротко)

**Тесты.** Эти правки сломают регулярные выражения в `server/__tests__/routes/privacyPage.test.js`, их нужно обновить вместе с текстом:
- `de.ipHash`: `/mit Schlüssel gebildeter Hash deiner IP-Adresse/` → «mit einem geheimen Schlüssel gebildeter Hash deiner IP-Adresse» (правка 6);
- `de.free`: `/kostenlos[^.]*keine Käufe/` → «keine In-App-Käufe» (правка 10);
- `AFTER_DELETION.de.stays[0]`: «zu seiner Verwaltung ernannt wirst» → «darin Adminrechte bekommst» (правка 19);
- при варианте D1-1 тест `removal` («außer deinem Namen…») меняется на обратный.

`keepsImported`, `appleEvery`, `appleOnce`, список `says` и проверки рода с моими правками совпадают.

Ошибку 1 тест не поймал. На странице поддержки он проверяет «Profil → Mitteilungen» (`profile.notifications`), а на странице политики — нет. Стоит добавить такую же проверку и для политики.

**Вне брифа, на том же экране синхронизации.** По-английски вшиты ещё два окна:
- «No rehearsals found to sync. Create some rehearsals first!» — немец его увидит, если в проектах нет репетиций;
- «Please enable sync and select a calendar first» — сейчас, похоже, недостижимо: кнопка видна только при включённой синхронизации.

**Вопрос владельцу о «Deine Rechte».** После T-270 там можно добавить строку «Importierte Zeiten löschen – Profil → Kalender-Sync → „Alle importierten Zeiten löschen“». Сейчас «Kalenderimport beenden» только останавливает импорт, а люди ищут удаление именно в этом списке. Решать сразу для всех языков.

**Вопрос владельцу о DSGVO (смысл не правлю).** Немецкий читатель Datenschutzerklärung по привычке ищет ещё:
- правовые основания обработки (ст. 6);
- право жалобы в надзорный орган (ст. 77);
- основание передачи данных в США: Neon, Vercel, Expo (ст. 44 и далее);
- права на возражение и переносимость (ст. 20, 21);
- почтовый адрес ответственного и, возможно, представителя в ЕС (ст. 27).

App Review и Google этого не требуют. Если владелец решит добавить, то во все языки сразу.

## 6. Итог

правок в A: 26 (ошибок: 2); B, C, D готовы

## 7. Часть E — общие правки смысла

Владелец выбрал D1, вариант 1, и D2, вариант 1. Тексты ниже вставляются как есть. Где пункт заменяет или включает строку из частей A или B, это сказано в той же ячейке. Ссылки и `<strong>` остаются на тех же словах, если не сказано иначе. Тире — немецкое «–», как в строке 23 части A.

| Пункт | Где | Итоговый текст |
|---|---|---|
| E1 | Вступление (`p.lede`), первая фраза | Rehearsly speichert, was für den Betrieb der App und die Probenplanung nötig ist – und nicht mehr. *(Вторая фраза без изменений.)* |
| E2 | Wer sonst deine Daten verarbeitet, последняя фраза | An kein anderes Unternehmen geben wir deine Daten weiter, und verkauft werden sie nie. |
| E3 | Wo sie liegen und wer sie erhält, абзац целиком | Sie liegen in unserer Datenbank bei Neon, zusammen mit deinen übrigen Kontodaten. Deinen Namen sehen die Mitglieder deiner Projekte; darüber hinaus geben wir sie nur an die Dienste weiter, die Rehearsly für uns betreiben: Neon speichert sie, Vercel betreibt unseren Server, Resend erhält deine E-Mail-Adresse, wenn wir dir eine E-Mail senden, und Expo Push Service mit Apples APNs stellt die Mitteilungen mit deinem Namen den Personen zu, die deine Projekte verwalten. Wir verkaufen sie nicht und nutzen sie weder für Werbung noch für das Training von KI- und Machine-Learning-Modellen. *(«wenn wir dir eine E-Mail senden» вместо «einen Code»: по E25 Resend отправляет и письма об изменениях политики. Список сервисов — как был.)* |
| E4 | Sicherheit, абзац целиком | Der gesamte Datenverkehr läuft über HTTPS. Passwörter speichern wir nur als bcrypt-Hashes, deshalb können wir sie weder sehen noch wiederherstellen. Sitzungen lassen sich widerrufen: Abmelden oder ein Passwortwechsel macht alle bestehenden ungültig. Der Zugriff auf Projektdaten wird bei jeder Anfrage serverseitig geprüft. *(Включает строку 21 части A.)* |
| E5 | Kinder, абзац целиком | Rehearsly richtet sich nicht an Kinder unter 13 Jahren, und wir erheben deren Daten nicht wissentlich. Wenn du glaubst, dass ein Kind unter 13 Jahren ein Konto angelegt hat, schreib uns – wir löschen das Konto. *(Заменяет строку 22 части A.)* |
| E6 | Was wir bewusst nicht erheben, пункты 1 и 3 | Пункт 1: Standortdaten deines Geräts · пункт 3: Fotos, Kamera oder Mikrofon – die App hat keinen Zugriff darauf |
| E7 | Таблица, строка «Push-Token…», ячейка «Wozu» | Mitteilungen zu deinen Projekten und Proben zustellen *(Заменяет эту ячейку в строке 2 части A; остальное из строки 2 в силе.)* |
| E8 | Таблица, строка о хеше IP, ячейки «Wozu» и «Wann» | Wozu: Wiederholte Versuche begrenzen – bei der Anmeldung, bei Anfragen zu deinem Konto und bei Einladungslinks · Wann: Bei der Anmeldung und bei anderen Anfragen zu deinem Konto aus der App sowie beim Öffnen eines Einladungslinks *(Ячейка «Daten» — по строке 6 части A.)* |
| E9 | Таблица, новая строка сразу после строки о хеше IP | Daten: Zwei Anfragezähler, die mit deinem Konto verknüpft sind: einer für den Beitritt zu Projekten per Einladungslink, einer für das Laden der Verfügbarkeit der Mitglieder eines Projekts. Beide zählen die Anfragen jeweils innerhalb einer Minute und werden in der nächsten überschrieben; gelöscht werden sie mit deinem Konto · Wozu: Zu häufige Anfragen begrenzen · Wann: Wenn du einem Projekt per Einladungslink beitrittst oder die App die Verfügbarkeit der Mitglieder lädt (im Planner und beim Erstellen oder Bearbeiten einer Probe) *(«Planner», «Probe erstellen», «Probe bearbeiten» — слова приложения.)* |
| E10 | Таблица, строка «Welche Proben du als gesehen markiert hast», ячейка «Wozu» | Allen, die das Projekt verwalten oder für die Probe eingeteilt sind, zeigen, wer sie gesehen hat *(Заменяет строку 7 части A. «eingeteilt» — утверждённое слово для «быть на репетиции» (T-256); без рода.)* |
| E11 | Wer sonst deine Daten verarbeitet, «Wir bestätigen…» | Wir bestätigen: Jeder dieser Dienste, der deine Daten von uns erhält, schützt sie mindestens so gut, wie es diese Erklärung zusagt, und nutzt sie nur, um seine Leistung für uns zu erbringen. |
| E12 | Mit Apple anmelden, абзац 2 целиком | Diese Daten nutzen, speichern und übermitteln wir genau wie oben für Google beschrieben, und Profil → Konto löschen entfernt sie ebenso. Die Verwendung von „Mit Apple anmelden“ für Rehearsly beendest du in den Einstellungen deines Apple Accounts auf dem iPhone: Einstellungen → [dein Name] → „Mit Apple anmelden“, dann Rehearsly auswählen und auf „Löschen“ tippen. Wie bei Google löscht das nicht, was wir bereits gespeichert haben; dafür musst du dein Rehearsly-Konto löschen. *(Заменяет строку 16 части A. Путь и кнопка «Löschen» — дословно из https://support.apple.com/de-de/102571: «Öffne auf deinem iPhone die Einstellungen-App, und tippe dann auf „[dein Name]“. Tippe auf „Mit Apple anmelden“. Wähle die App bzw. den Entwickler aus, und tippe dann auf „Löschen“.»)* |
| E13 | Wie du sie entfernst, абзац целиком (вместе с E17) | Profil → Konto löschen entfernt sie zusammen mit deinem übrigen Konto aus unserer Datenbank; was danach noch bleibt, steht unter „Wie lange wir sie speichern“. In den Einstellungen deines Google-Kontos kannst du bei Rehearsly außerdem „‚Über Google anmelden‘ nicht mehr verwenden“ auswählen. Das beendet die Erlaubnis bei Google, löscht aber nicht, was wir bereits gespeichert haben; dafür musst du dein Rehearsly-Konto löschen. *(Ссылка — на прежних словах «Einstellungen deines Google-Kontos», адрес меняет разработчик. Действие названо как у Google: «„Über Google anmelden“ nicht mehr verwenden» (https://support.google.com/accounts/answer/13533235?hl=de). Внутри наших кавычек — немецкие вложенные ‚…‘. Включает строку 13 части A.)* |
| E14 | Mit Apple anmelden, абзац 1, «Wählst du „E-Mail-Adresse verbergen“…» | Wählst du „E-Mail-Adresse verbergen“, erhalten und speichern wir statt deiner echten Adresse eine private, die auf @privaterelay.appleid.com oder @private.icloud.com endet. *(Заменяет строку 15 части A. Оба домена — https://support.apple.com/de-de/105078: «…mit der Adressdomain @private.icloud.com oder @privaterelay.appleid.com erstellt».)* |
| E15 | Wie lange wir sie speichern, абзац 1, список удаляемого | Löschst du es, verschwindet alles Zugehörige aus unserer Datenbank: Verfügbarkeit, aus Kalendern importierte belegte Zeiten, deine Mitteilungen, Gesehen-Markierungen, Anmeldedaten, Push-Tokens, Einträge zu E-Mail-Codes und Projektmitgliedschaften. *(Заменяет строку 18 части A.)* |
| E16 | Deine Rechte, новый пункт сразу после «Kalenderimport beenden» | **Aus Kalendern importierte Zeiten löschen** – Profil → Kalender-Sync → „Alle importierten Zeiten löschen“. *(Жирным — часть до тире, как у соседних пунктов.)* |
| E17 | Wie lange wir sie speichern, абзац об уведомлениях; Wie du sie entfernst | уже в части D: D1, вариант 1 — абзац и фраза для «Wie du sie entfernst». Абзац «Wie du sie entfernst» целиком, вместе с E13, — в строке E13. |
| E18 | Änderungen | уже в части D: D2, вариант 1. |
| E19 | Eingeschränkte Nutzung (Limited Use), строка со ссылкой | Zur Richtlinie (auf Englisch): Google API Services User Data Policy. *(Ссылка — на названии политики, как сейчас.)* |
| E20 | support, «Verrät die Kalendersynchronisation…», ответ целиком | Nein. Dein iPhone schickt uns von jedem Termin nur Beginn und Ende sowie technische Kennungen, damit die nächste Synchronisation denselben Eintrag aktualisiert. Titel, Notizen und Orte bleiben auf dem Gerät. Andere in deinen Projekten sehen, dass du beschäftigt bist, nie warum. Einzelheiten stehen in der Datenschutzerklärung. *(Ссылка — на «Datenschutzerklärung», как сейчас. Заменяет строки 24 и 25 части A; ошибка «belegt» исправлена здесь же.)* |
| E21 | support, Ein Problem melden, абзац 2 | Per E-Mail sind diese Angaben hilfreich: was du erwartet hast, was stattdessen passiert ist, Gerät und iOS-Version sowie die ungefähre Uhrzeit – damit lässt sich die Ursache meist finden. |
| E22 | support, Ein Problem melden, абзац 1 целиком | Am schnellsten geht es in der App: Profil → Über die App → „Fehler melden“. Beschreib, was passiert ist, und tippe auf „Senden“. Aus dem Bericht sehen wir, von wem er kommt und wann er gesendet wurde; deine E-Mail-Adresse musst du also nicht angeben. Gerät, iOS-Version und der Bildschirm, auf dem das Problem auftrat, sind nicht dabei – nenn sie im Text, wenn sie wichtig sind. *(`<strong>` — на «„Fehler melden“», как сейчас.)* |
| E23 | Deine Rechte, пункт об уведомлениях | уже в части A, строка 1: «Mitteilungen abschalten – Profil → Mitteilungen oder die Geräteeinstellungen.» Сверено с `profile.notifications` = «Mitteilungen». |
| E24 | Строка `chooseProviderFirst` (часть B) | Tippe zuerst auf „Google Kalender“ oder „Apple Kalender“. *(Заменяет строку части B; это моя запасная строка оттуда, совпадает с `onboarding.calendarSync.google` и `.apple`.)* |
| E25 | 1) Wer sonst deine Daten verarbeitet, пункт Resend; 2) Wozu wir sie nutzen, фраза о почте | 1) **Resend** – Versand unserer E-Mails: Codes für Registrierung, Passwort-Zurücksetzen und Adressänderung sowie Hinweise auf wesentliche Änderungen dieser Erklärung; erhält deine E-Mail-Adresse und den Text der Nachricht (EU, Irland) · 2) Deine E-Mail-Adresse ist die Adresse deines Kontos: Dorthin gehen die Codes, die du anforderst, etwa zum Zurücksetzen des Passworts, und unsere Hinweise auf wesentliche Änderungen dieser Erklärung. *(Связано с E3. Первая строка таблицы и первая фраза «Wozu wir sie nutzen» — в E27.)* |
| E26 | support, первый абзац (`p.lede`) | Schreib an support@rehearsly.me, du bekommst innerhalb von zwei Werktagen Antwort – geschrieben von einem Menschen, nicht automatisch. *(Адрес остаётся ссылкой. Фраза «Rehearsly wird von einer Person gebaut» уходит целиком.)* |
| E27 | 1) Таблица, строка «E-Mail-Adresse, Vor- und Nachname», ячейка «Wozu»; 2) Google- und Apple-Daten, «Wozu wir sie nutzen», первая фраза | 1) Konto anlegen, dir E-Mails zu deinem Konto schicken und zeigen, wer an einem Projekt beteiligt ist · 2) Nur um dein Konto anzulegen, dich anzumelden, dir E-Mails zu deinem Konto zu schicken und den Mitgliedern deiner Projekte deinen Namen zu zeigen. *(«E-Mails zu deinem Konto» — это коды и письма о существенных изменениях, как в E25. Абзац «Wozu wir sie nutzen» целиком, с E25 и строкой 12 части A: «Nur um dein Konto anzulegen, dich anzumelden, dir E-Mails zu deinem Konto zu schicken und den Mitgliedern deiner Projekte deinen Namen zu zeigen. Deine E-Mail-Adresse ist die Adresse deines Kontos: Dorthin gehen die Codes, die du anforderst, etwa zum Zurücksetzen des Passworts, und unsere Hinweise auf wesentliche Änderungen dieser Erklärung. Der Name wird einmal übernommen, wenn das Konto angelegt wird; ändern kannst du ihn unter Profil → Profil bearbeiten. Gibt es schon ein Konto mit derselben verifizierten Adresse, wird dein Google-Konto damit verknüpft, und dein bisheriger Name bleibt.» Resend в E3 уже получает адрес, «wenn wir dir eine E-Mail senden», а не только при отправке кода. Экран подбора времени назван «Planner» (E9), «Smart Planner» в моих текстах нет.)* |

**Тесты (для разработчика).** Остальные регулярные выражения de в `privacyPage.test.js` с текстами части E совпадают:
- `says`: «Einstellungen deines Google-Kontos», «bestätig», «Konto löschen», «privaterelay.appleid.com», «E-Mail-Adresse verbergen»;
- `delivery`: «Expo Push Service … APNs … deinem Namen» по-прежнему в одной фразе;
- `processors`: «mindestens so gut».

Меняются вместе с текстом:
- `removal` (E13, E17) и `stays` (D1, вариант 1);
- `ipHash`, `free` и `stays[0]` — уже названы выше, в заметках для разработчика.

Пунктов с новым текстом: 24 (E1–E16, E19–E22, E24–E27); «уже в части A/D» — 3 (E17, E18, E23).
