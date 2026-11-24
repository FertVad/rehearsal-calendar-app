# T-288 — вычитка немецкого (de-DE): главные слова, хук, финал, строка о входе

## 1. Кто читал

Носитель немецкого, редактор App Store-текстов и интерфейсов iOS на «du» для Германии, Австрии и Швейцарии; знаю репетиционную среду: театр, танец, хор. Сверял с `captions.json`, `T-285-natives-de.md`, `de-DE.md`, `de.editor.md`, `brief-v2.md`, блоком `de` в `translations/*.ts` и тремя картинками раскадровки; все длины посчитаны `len()` в Python.

## 2. Главные слова

Принцип: курсив стоит там, где немец сам поставил бы ударение, прочитав подпись вслух. Предлоги и артикли перед ним остаются прямыми, как «во» в русском хуке. Слова подписей не менял: без скобок каждая строка совпадает с `captions.json` (проверено кодом).

| Поле | Подпись (перенос — /) | Главное слово | Почему |
|---|---|---|---|
| hook | Wer kann / am Dienstag? | `Dienstag?` | Вопрос из группового чата, и ударение в нём падает на день. «am» прямым. «?» стоит сразу за словом, поэтому идёт в курсиве. |
| video[0] | Der Planner zeigt / die Zeitfenster | `Zeitfenster` | Planner заполняется окнами, и это ответ на вопрос хука. «Der Planner zeigt» — завязка, «die» прямым. |
| video[1] | Trag deine Woche / einmal ein | `einmal` | Отдача — «один раз». Курсив ставит ударение на «éinmal», и строку уже не прочесть как смягчающее «ну-ка, внеси». «ein» — часть глагола «eintragen», поэтому остаётся прямым после курсива. По-немецки так и читается. |
| video[2] | … oder aus dem / iPhone-Kalender | `iPhone-Kalender` | Кадр показывает, откуда берутся занятые часы. Слово через дефис не рвать. «… oder aus dem» прямым. |
| video[3] | Nur drei nötig? / Hak sie an | `Hak sie an` | Здесь немецкий расходится с русским. Слова «троих» нет, есть только местоимение «sie», и курсив на нём звучал бы как «именно их». Отдача — само действие, вся вторая строка. Ремарки в пьесе набирают курсивом, и «Hak sie an» читается как ремарка. |
| video[4] | Überschneidungen / direkt im Formular | `direkt` | Кадр доказывает, что накладку видно сразу, там же, где ставишь время. «direkt» значит и «прямо здесь», и «сразу», как русское «сразу». Курсив на «Formular» выделил бы место, а не скорость. |
| video[5] | Alle haben’s gesehen: / 12 von 12 | `12 von 12` | Доказательство — число, и оно совпадает со счётчиком. Двоеточие стоит после «gesehen», а не после главного слова, поэтому остаётся прямым. |
| screenshots[0] | Ein Termin, / der allen passt | `allen` | На обложке Planner — окно, где свободны все. Ударение «der állen passt». Одно слово выделяет острее, чем «allen passt». |
| screenshots[1] | Alle tragen ein, / wann sie keine Zeit haben | `keine Zeit` | Это то, что вносят: занятость, как в приложении («Als beschäftigt markieren»). Ударение на «keine», а «keine Zeit haben» — одно целое. |
| screenshots[2] | Überschneidungen / direkt im Formular | `direkt` | Как в video[4]: подпись та же, разметка та же. |
| screenshots[3] | iPhone-Kalender: / Sync in beide Richtungen | `beide Richtungen` | Отдача — «в обе стороны»: занятость приходит, репетиции уходят. Одно «beide» звучало бы как спор («а не в одну!»), пара слов читается как суть. «in» прямым. |
| screenshots[4] | Wer es gesehen hat: / 5 von 8 | `5 von 8` | Как в video[5]: в деталях на экране то же «5/8». |
| screenshots[5] | Alle Proben / an einem Ort | `einem Ort` | Ударение «an éinem Ort». Курсив делает «einem» числительным «в одном», а не простым артиклем. |
| screenshots[6] | Alle per Link / ins Projekt einladen | `Link` | Кадр показывает ссылку-приглашение, это и есть способ. Ударение «per Línk». Это единственная подпись, где главное слово в первой строке: во второй выделять нечего, «einladen» — общее слово. |
| screenshots[7] | Vier Sprachen, / deine Ortszeit | `Ortszeit` | Отдача — вторая половина: время показывается в твоём поясе. «Vier Sprachen» — перечень, его и так видно на экране профиля. «deine» прямым, как «deine Woche» в ролике. |

## 3. Хук

Перенос: `Wer kann` / `am Dienstag?` — 8 / 12.

- Первая строка кончается модальным глаголом.
- «Wer kann am / Dienstag?» оставляет предлог в конце строки — нельзя.
- «Wer / kann am Dienstag?» отрывает подлежащее от глагола, и строки выходят неровные.
- Пауза после «Wer kann» естественна и вслух («Wer kann … am Dienstag?»). При наборе по букве это выглядит как сообщение, которое кто-то печатает в чат.

**По дням недели** (дополнение 20.11). Перенос и главное слово те же; в курсиве день вместе с «?».

| День | Хук (перенос — /) | Длина строк |
|---|---|---|
| mon | Wer kann / am Montag? | 8 / 10 |
| tue | Wer kann / am Dienstag? | 8 / 12 |
| wed | Wer kann / am Mittwoch? | 8 / 12 |
| thu | Wer kann / am Donnerstag? | 8 / 14 |
| fri | Wer kann / am Freitag? | 8 / 11 |
| sat | Wer kann / am Samstag? | 8 / 11 |
| sun | Wer kann / am Sonntag? | 8 / 11 |

**Предлог и форма.** Все дни недели мужского рода. Для конкретного дня — «am» (= an dem) + день, и форма от дня к дню не меняется: в дательном мужского рода окончания нет. Так в DE, AT и CH. Не «montags»: это «каждый понедельник».

**Samstag, а не Sonnabend.** «Sonnabend» говорят только на севере и востоке Германии. iOS, приложение («Sa»), Австрия и Швейцария говорят «Samstag».

## 4. Финал

| | (a) строка | (b) зачёркнуто | (c) сверху | (d) читается |
|---|---|---|---|---|
| **1 — рекомендую** | `Eine Ewigkeit im Chat` — 21 | `Ewigkeit im Chat` — 16 | `Minute` — 6 | `Eine Minute` — 11 |
| 2 | `Nach einem Abend im Chat` — 24 | `einem Abend im Chat` — 19 | `einer Minute` — 12 | `Nach einer Minute` — 17 |

**Почему вариант 1:**
- **«Abend» с одним словом не выходит.** «Ein Abend im Chat» с «Minute» сверху даёт «Ein Minute»: Abend мужского рода, Minute женского, и артикль не сходится. Значит, либо артикль зачёркивается вместе со словом (вариант 2: длинная черта и два слова сверху, 12 знаков — на пределе), либо старый способ называется словом женского рода, как «Minute». Самое естественное такое слово — «Ewigkeit»: «eine Ewigkeit im Gruppenchat» говорят про любую переписку, которая тянется.
- **Устроен как русский.** Короткое слово остаётся прямым, черта короткая, сверху одно слово. Читается за секунду.
- **После зачёркивания — утверждённые слова.** «Eine Minute» — ровно начало утверждённого слогана «Eine Minute – kein Abend im Chat». «Minute» и «im Chat» стоят и в промо-тексте.
- **Смысл тот же:** минута против долгой переписки в чате. «Ewigkeit» преувеличивает старый способ и ничего не обещает о приложении.
- **Итог, а не отметка времени.** Финал идёт сразу после «12 von 12». «Eine Minute» читается как длительность всего, что показал ролик. «Nach einer Minute» звучит как отметка времени и цепляется к последнему кадру: «через минуту все 12 увидели». Этого приложение не обещает.

**Вариант 2** — если важнее сохранить «Abend». Он дословно повторяет «nach einem Abend im Chat» из промо-текста.
- Черта должна начинаться с артикля «einem». Если зачеркнуть только «Abend im Chat», выйдет «Nach einem Minute».
- Обе строки по отдельности повисают: «Nach … — und dann?».

**Рассматривал и отказался:**
- `Dauer: ein Abend im Chat` → `Dauer: eine Minute` (24 / 11): точно, но звучит как табличка, а не как реплика;
- `Eine Nacht im Chat`: по-немецки это скорее ночь в чат-руме, чем планирование;
- `Eine Stunde im Chat`: слишком мало, в описании через час ответили только трое.

## 5. Строка о входе

**Вердикт: перенос после двоеточия.** `Anmeldung nötig:` / `Apple, Google oder E-Mail` — 16 / 25, всего 42. Слова утверждённые, не меняются.

Почему не короче:
- Без потери смысла до 38 доходит только вариант без «oder»: `Anmeldung nötig: Apple, Google, E-Mail` (38). Это ровно на пределе, и без «oder» строка слабее: «oder» говорит, что хватит одного способа.
- «Login» в приложении нет.
- `Mit Apple, Google oder E-Mail anmelden` (38) звучит как предложение, а не как условие.

В две строки первая называет условие, вторая — три способа словами приложения. Если всё же нужна одна строка, запасной вариант — `Anmeldung nötig: Apple, Google, E-Mail` (38).

## 6. Готовый блок для captions.json

```json
"hook": "Wer kann\nam [Dienstag?]",
"hookByDay": {
  "mon": "Wer kann\nam [Montag?]",
  "tue": "Wer kann\nam [Dienstag?]",
  "wed": "Wer kann\nam [Mittwoch?]",
  "thu": "Wer kann\nam [Donnerstag?]",
  "fri": "Wer kann\nam [Freitag?]",
  "sat": "Wer kann\nam [Samstag?]",
  "sun": "Wer kann\nam [Sonntag?]"
},
"video": [
  "Der Planner zeigt\ndie [Zeitfenster]",
  "Trag deine Woche\n[einmal] ein",
  "… oder aus dem\n[iPhone-Kalender]",
  "Nur drei nötig?\n[Hak sie an]",
  "Überschneidungen\n[direkt] im Formular",
  "Alle haben’s gesehen:\n[12 von 12]"
],
"finale": { "line": "Eine Ewigkeit im Chat", "struck": "Ewigkeit im Chat", "insert": "Minute" },
"screenshots": [
  "Ein Termin,\nder [allen] passt",
  "Alle tragen ein,\nwann sie [keine Zeit] haben",
  "Überschneidungen\n[direkt] im Formular",
  "iPhone-Kalender:\nSync in [beide Richtungen]",
  "Wer es gesehen hat:\n[5 von 8]",
  "Alle Proben\nan [einem Ort]",
  "Alle per [Link]\nins Projekt einladen",
  "Vier Sprachen,\ndeine [Ortszeit]"
],
"signIn": "Anmeldung nötig:\nApple, Google oder E-Mail"
```

Блок проверен кодом:
- в фигурных скобках он разбирается как JSON;
- в каждой подписи одно выделение от 1 до 3 слов, внутри одной строки;
- «…» (U+2026) и «’» (U+2019) — как в `captions.json`.

## 7. Замечания

1. **Дни недели.** Хуже остальных не звучит ни один день. «Wer kann am …?» одинаково естественно с любым днём, а репетиции бывают и в выходные.
   - Разница только в ширине. «am Donnerstag?» на два знака длиннее вторника (14 против 12), это самая широкая строка хука.
   - Если кегль хука подобран по вторнику, четверг надо проверить на экране. Надёжнее подбирать кегль по четвергу для всех дней.
2. **Описание.** В описании вопрос остаётся «wer Dienstag kann». Если в ролике другой день, хук и описание перекликаются слабее, но не спорят: вопрос тот же. Менять не надо.

## 8. Итог

правок: 0

Слова утверждённых подписей и строки о входе не менял. По брифу сделано:
- разметка 15 подписей;
- перенос хука и `hookByDay`;
- финал: вариант 1 рекомендован, вариант 2 — запасной;
- перенос строки о входе после двоеточия.
