# T-271 и T-272 — вычитка немецкого (de): выход из проекта и подсказка об аватаре

## 1. Кто читал

Носитель немецкого, редактор продуктовых текстов (интерфейсы на «du», уведомления), работаю с любительскими театрами, хорами и Tanzgruppen; iPhone на немецком.

## 2. Часть A

Что прочитано:
- diff `ef2e4f6..293b222` (de);
- блок de в `pushNotifications.js` целиком;
- блок de в `projects.ts`;
- окно выхода в `ProjectDetailScreen.tsx` (`handleLeaveProject`);
- утверждённые слова из T-256, T-261, T-269 и T-276.

Подстановки я собрал настоящим `quoteName`:
- имена: «Jo», «Anna Schmidt», «Maximilian Müller-Lüdenscheidt»;
- проекты: «Hamlet», «Der Kirschgarten», «Drei Schwestern» и «„Hamlet“», набранный в кавычках.

Падежи верны, кавычки не двоятся.

| Ключ | Сейчас | Вердикт | Предлагаю | Почему | Тип |
|---|---|---|---|---|---|
| `leaveProject` | Projekt verlassen | оставить | — | Так немецкие приложения для групп называют выход: «Gruppe verlassen» в WhatsApp и Signal. Это пара к кнопке владельца «Projekt löschen». | — |
| `leaveProjectConfirm` | Projekt verlassen? | оставить | — | Вопрос-инфинитив, как «Projekt löschen?» и «Mitglied entfernen?» в том же файле. | — |
| `leaveProjectMessage` | `Das Projekt ${quoteName(projectName, 'de')} verschwindet aus deiner Liste, und du bist für seine Proben nicht mehr eingeteilt. Zurück kommst du mit einer Einladung.` | заменить | `Das Projekt ${quoteName(projectName, 'de')} verschwindet aus deiner Liste, und du bist für seine Proben nicht mehr eingeteilt. Mit einer Einladung kannst du wieder beitreten.` | Первое предложение верно и естественно. Во втором частица «zurück» вынесена вперёд. Так говорят, когда противопоставляют путь туда и обратно («Hin fährst du mit dem Zug, zurück …»), или с «nur», как у входа в клуб: «Rein kommst du nur mit Einladung». Здесь нет ни того, ни другого, и фраза звучит как описание маршрута. К тому же на этом экране «Zurück» — надпись кнопки «назад». Вход в проект приложение везде называет «beitreten»: «Beitreten», «Mit einem Code beitreten». Строка стала на 10 знаков длиннее, для текста окна это не важно. | лучше так |
| `leaveProjectError` | Projekt konnte nicht verlassen werden | оставить | — | Та же форма, что «Projekt konnte nicht gelöscht werden» и другие ошибки приложения. Пассив от «verlassen» с неодушевлённым подлежащим по-немецки обычен. В коде это не заголовок: заголовок окна — «Fehler» (`common.error`), а эта строка — текст под ним. Точки нет, как у соседних строк и в en. | — |
| `memberLeft.title` | Mitglied ausgetreten | оставить | — | Существительное без артикля и причастие, как «Projekt gelöscht», «Rolle geändert», «Probe abgesagt». Вместе с «Neues Mitglied» — пара заголовков на одном слове. | — |
| `memberLeft.body` | `${memberName} ist aus dem Projekt ${de(projectName)} ausgetreten` | оставить | — | Зеркальна строке «Neues Mitglied»: «Anna Schmidt ist dem Projekt „Hamlet“ beigetreten» → «Anna Schmidt ist aus dem Projekt „Hamlet“ ausgetreten». Для членства (Mitglied) beitreten и austreten — естественная пара. Падеж несёт «dem Projekt»: «aus dem Projekt „Der Kirschgarten“». Глагол стоит в конце, как у соседей. | — |
| `memberWasRemoved.title` | Mitglied entfernt | оставить | — | Тот же глагол, что в приложении: «Aus dem Projekt entfernen», «Mitglied entfernen?», «Mitglied aus dem Projekt entfernt». | — |
| `memberWasRemoved.body` | `${memberName} wurde aus dem Projekt ${de(projectName)} entfernt` | оставить | — | Построено так же, как «Du wurdest aus dem Projekt „…“ entfernt» (пуш самому удалённому) и «Das Projekt „…“ wurde gelöscht». | — |

**1. Естественно ли.** Да, кроме последней фразы окна (правка выше).
- «Projekt verlassen» — привычное слово приложений для групп.
- «… verlassen?» — привычный заголовок окна в iOS. Кнопка действия повторяет его, как в окне «Projekt löschen?».
- Заголовки пушей короткие, «существительное + причастие», как в iOS и в соседних пушах.
- Тексты пушей звучат как обычные немецкие фразы: «Maximilian Müller-Lüdenscheidt ist aus dem Projekt „Der Kirschgarten“ ausgetreten», «Jo wurde aus dem Projekt „Hamlet“ entfernt».

**2. Пол.** Не угадывается, и в немецком обходить нечего.
- Причастие с родом не согласуется: «ist ausgetreten», «wurde entfernt» одинаково и об Анне, и о Максимилиане.
- «Mitglied» — среднего рода, им называют любого человека. Разработчик не взял «Teilnehmer» (мужской род), и это верно, в том числе по решению 13.11.
- К читателю обращаются на «du»: «deiner Liste», «du bist», «kannst du» — окончаний по роду нет.
- «seine Proben» относится к «das Projekt», а не к человеку.
- Обход в ru и es — не мой язык.

**3. Слова.** Совпадают с утверждёнными:
- Projekt;
- Mitglied — для проекта (решение 13.11), как «Mitglieder» на странице проекта и заголовок «Neues Mitglied»;
- Probe и Einladung;
- «nicht mehr eingeteilt» — слово T-256 для снятия с репетиции, как в пуше «Nicht mehr eingeteilt».

Разные глаголы в кнопке («verlassen») и в пуше («ausgetreten») не мешают:
- пуш читает владелец или админ, а не тот, кто нажимал кнопку;
- «ausgetreten» стоит в паре с «beigetreten» из «Neues Mitglied», и в списке «Mitteilungen» они так и читаются.

«Mitglied» в заголовке верно и тогда, когда уходит админ: Mitglied — любой человек в проекте, как в «Mitgliederliste».

Моя правка вносит только глагол «beitreten», а он уже есть в приложении.

**4. Заголовки.** По виду совпадают с соседями: существительное без артикля и причастие, без точки, как «Projekt gelöscht», «Rolle geändert», «Probe abgesagt», «Adminrechte vergeben». Слово «Mitglied» у трёх заголовков общее: «Neues Mitglied», «Mitglied ausgetreten», «Mitglied entfernt». Длина 20 и 17 знаков, на экране блокировки они помещаются в одну строку.

**Вне вопросов (это не правка текста).** `leaveProjectError` виден, только если сервер не прислал своего текста. На ответы 403 и 404 под «Fehler» встанет английский текст сервера: «Member not found», «Only project admins can remove members». Так устроены все ошибки приложения (`requestErrorMessage`), к немецким строкам это не относится.

## 3. Часть B

`avatarHint: 'Dein Avatar zeigt die Initialen deines Vor- und Nachnamens.'`

Почему такая: она говорит ровно то, что рисует `UserAvatar`, и называет поля «Vorname» и «Nachname», которые стоят прямо под ней; ни фото, ни почты, ни «automatisch erstellt»; 59 знаков, а прежняя строка — 63.

Попутно: в `reh_app-auto` уже лежит незакоммиченный черновик «Der Avatar wird automatisch aus deinen Initialen erstellt.». По-немецки он верен, но не говорит, откуда берутся инициалы. Моя строка проходит новый `avatarHint.test.ts`: в ней есть «Initialen» и нет «E-Mail».

## 4. Итог

правок в A: 1 (ошибок: 0); B готова
