# T-412: строки и набор онбординга — от владельца и носителей

25.11.2026.
- **Русские тексты двух описаний** выбрал владелец.
- **en, es и de** написали редакторы-носители, бриф `T-412-natives-r3-brief.md`.
- **Разбивку на строки по смыслу** сделали те же носители: каждый для своего языка.
- **Точка в конце приветствия** — решение монитора. Остальные описания кончаются точкой, приветствие — такое же полное предложение, а `sentenceEnd` требует одинакового конца во всех языках.

Всё ниже вставлять дословно. `\n` — перенос строки, `⍽` — неразрывный пробел (U+00A0).

## 1. Описания шагов

### ru

| Ключ | Строка |
|---|---|
| `onboarding.welcome.description` | `Планируйте репетиции,\nуправляйте расписанием\nи синхронизируйте календари\nв одном месте.` |
| `onboarding.weekends.description` | `Тогда при подборе времени\nваши выходные будут считаться занятыми.\nЛюбой выходной можно отметить иначе\nв «Занятости».` |
| `onboarding.calendarSync.description` | `Репетиции сами попадут в ваш календарь,\nа занятые часы из него — в Rehearsly.\nКоманда видит только эти часы,\nно не ваши дела.` |
| `onboarding.notifications.description` | `Новая репетиция, отменили или перенесли —\nвы узнаете сразу.` |

### en

| Ключ | Строка |
|---|---|
| `onboarding.welcome.description` | `Plan rehearsals, manage schedules,\nand sync calendars in one place.` |
| `onboarding.weekends.description` | `When someone looks for a rehearsal time,\nthey will see you as busy on those days.\nYou can still change any individual day\nin Availability.` |
| `onboarding.calendarSync.description` | `Rehearsals appear in your calendar automatically,\nand Rehearsly picks up your busy hours from⍽it.\nYour team sees only those hours,\nnot what you’re doing.` |
| `onboarding.notifications.description` | `A new rehearsal, a new time, or a cancellation —\nyou’ll know right away.` |

### es

| Ключ | Строка |
|---|---|
| `onboarding.welcome.description` | `Planifica ensayos, gestiona horarios\ny sincroniza calendarios en un solo lugar.` |
| `onboarding.weekends.description` | `Así, cuando alguien busque un horario,\ntus fines de semana contarán como ocupados.\nPuedes cambiar cualquier día\npor separado en Disponibilidad.` |
| `onboarding.calendarSync.description` | `Los ensayos aparecerán solos en tu calendario,\ny de él llegarán a Rehearsly tus horas ocupadas.\nEl equipo ve solo esas horas, no tus planes.` |
| `onboarding.notifications.description` | `Ensayo nuevo, cancelado o reprogramado:\nte enterarás al instante.` |

### de

| Ключ | Строка |
|---|---|
| `onboarding.welcome.description` | `Plane Proben, verwalte Termine\nund synchronisiere Kalender an einem Ort.` |
| `onboarding.weekends.description` | `Dann gelten deine Wochenenden\nbei der Terminsuche als belegt.\nEinzelne Tage kannst du\nunter Verfügbarkeit ändern.` |
| `onboarding.calendarSync.description` | `Proben landen von selbst in deinem Kalender,\nbelegte Zeiten von dort in Rehearsly.\nDie anderen im Projekt sehen nur diese Zeiten,\naber nicht, was du vorhast.` |
| `onboarding.notifications.description` | `Neue Probe, Absage oder Verschiebung⍽–\ndu erfährst es sofort.` |

**Ширина.** Носители замерили каждую строку шрифтом SF Pro Text 14 pt. Все строки не шире 327 pt, так что разбивка держится и на iPhone SE и 13 mini. Самые длинные:
- ru — 311 pt;
- en — 319 pt;
- es — 311 pt;
- de — 301 pt.

## 2. Короткие слова и знаки — правило набора по языкам

Нужно, когда текст переносится сам: крупный шрифт в настройках iPhone, сноски, строки «Что где».

| Язык | Неразрывный пробел **после** слова | Неразрывный пробел **перед** |
|---|---|---|
| ru | предлоги: в, к, о, с, у, во, ко, об, со, до, за, из, на, от, по; союзы: а, и, да, но, то; частицы: не, ни, ну, уж, аж — в любом регистре | «—», «→», «…»; частицы ли, же, ж, бы, б |
| en | a, A, I | «—», «→», «…» |
| es | a, y, e, o, u (и с заглавной) | «—», «→», «…» |
| de | — (короткие предлоги и союзы по немецким правилам могут стоять в конце строки) | «–», «—», «→», «…»; между числом и словом; внутри сокращений вида «z.⍽B.» |

Строка может **кончаться** тире или «→», но не **начинаться** с них.

## 3. Что держит старые тексты и меняется вместе с ними (по отчётам носителей)

- **`src/i18n/__tests__/weekendsNatives.test.ts`:**
  - строки 44 (ru), 53 (en), 62 (es) и 71 (de) держат описание выходных одной строкой;
  - тест «no weekends text has a line break of its own» (строки 121–127) должен пропускать `\n` в `weekends.question` и `weekends.description`.
- **`src/i18n/__tests__/proofreadingEdits.test.ts`:**
  - ru — описание уведомлений (строка 85);
  - en — описания календаря и уведомлений;
  - de — строка 329 (`calendarSync`).
- **Немецкий тест второго чтения (`secondReading`)** — строка 81.
- **`sentenceEnd.test.ts`:** у `welcome.description` теперь точка во всех четырёх языках.
- **e2e:**
  - `09-onboarding.yaml:71` — en, описание выходных;
  - `60-onboarding-russian.yaml` — строка 83 (выходные) и строки 138–142 (уведомления);
  - испанская проверка около строки 213 (`notVisible`) и немецкая около строки 339.
- **`CalendarSyncScreen.tsx:185`.** Путь в сноске под «Настроить позже» собран обычными пробелами (`${t.nav.profile} → ${t.calendarSync.title}`), поэтому строка может начаться с «→». Собирать через `settingPath`, как в `WeekendsScreen`.

Ниже — отчёты редакторов целиком. Их и эту заметку положить в `audit/evidence/T-412/natives.md`.

---

# T-412, третий круг: русский

Читала `auto/main` (d82db11). Код не меняла, ничего не коммитила.

Ширины замерены через CoreText шрифтом SF UI из iOS 26.5 (`SFUI.ttf`, Regular, opsz 14, то есть SF Pro Text) при 14 pt. Системный SF на macOS даёт те же числа.

## 1. Тексты владельца

| ключ | текст | строк при 14 pt | почему так |
|---|---|---|---|
| `onboarding.calendarSync.description` | Репетиции сами попадут в ваш календарь, а занятые часы из него — в Rehearsly. Команда видит только эти часы, но не ваши дела. | без `\n` — 3 (при ширине 327–354 pt); по смыслу — 4 (таблица 2) | Перед «а» запятая: это граница частей сложного предложения. Тире стоит на месте пропущенного «попадут». Перед «но не» запятая: противопоставление. «Из него» согласовано с «календарь», «сами» — с «репетиции». «Ваши дела» в винительном падеже: «не» отрицает дополнение, а не глагол. |
| `onboarding.notifications.description` | Новая репетиция, отменили или перенесли — вы узнаете сразу. | 2 | Бессоюзное предложение: первая часть называет случаи, вторая — следствие, поэтому тире. Перед одиночным «или» запятая не нужна. «Узнаете» — будущее время от «узнать», пишется без «ё». |

**ru: ошибок нет.** Правок не нужно.

Обе строки кончаются точкой (тест `sentenceEnd`). Слов на «напомин…» нет (тест `noReminderPromise`). «Rehearsly» набрано латиницей, тире длинное (U+2014).

## 2. Строки по смыслу

`\n` стоит на месте пробела. Слова владельца не тронуты.

| ключ | текст со `\n` | самая длинная строка |
|---|---|---|
| `onboarding.welcome.description` | `Планируйте репетиции,\nуправляйте расписанием\nи синхронизируйте календари\nв одном месте` | 207,3 pt (строки: 161,5 / 172,3 / 207,3 / 99,0) |
| `onboarding.weekends.description` | `Тогда при подборе времени\nваши выходные будут считаться занятыми.\nЛюбой выходной можно отметить иначе\nв «Занятости».` | 292,8 pt (строки: 191,4 / 292,8 / 274,2 / 102,8) |
| `onboarding.calendarSync.description` | `Репетиции сами попадут в ваш календарь,\nа занятые часы из него — в Rehearsly.\nКоманда видит только эти часы,\nно не ваши дела.` | 289,6 pt (строки: 289,6 / 255,0 / 219,1 / 114,8) |
| `onboarding.notifications.description` | `Новая репетиция, отменили или перенесли —\nвы узнаете сразу.` | 311,0 pt (строки: 311,0 / 119,6) |

Все строки входят и в 342 pt, и в 327 pt (SE, mini).

Почему так:
- **welcome.** Одно действие — одна строка. «В одном месте» относится ко всем трём действиям, поэтому стоит отдельно. Без `\n` первая строка занимает 337,6 pt, и при ширине 327 pt разрывается «управляйте / расписанием».
- **weekends.** Первая фраза делится на обстоятельство и главную часть. Во второй фразе «в «Занятости»» говорит, где это сделать, как путь, поэтому идёт отдельной строкой. «Можно отметить иначе» не разрывается.
- **calendarSync.** «Из него — в Rehearsly» стоит на одной строке. «Но не ваши дела» — противопоставление, ему отдана своя строка. Вся вторая фраза в одну строку — это 337,7 pt: при ширине 342 pt она входит впритык, при 327 pt не входит.
- **notifications.** Сначала случаи, потом тире, потом что будет. Тире может стоять в конце строки, но не в её начале.

## 3. Короткие слова

**Не остаются в конце строки.** После этих слов ставится неразрывный пробел, в любом регистре («А» и «В» в начале фразы тоже):
- предлоги: в, к, о, с, у, во, ко, об, со, до, за, из, на, от, по;
- союзы: а, и, да, но, то («то… то», «если…, то»);
- частицы: не, ни, ну, уж, аж.

**Не начинают строку:** ли, же, ж, бы, б. Эти частицы держатся за предыдущее слово («можно ли», «тот же», «если бы»), поэтому неразрывный пробел ставится перед ними.

**Тире и «→».** Перед ними — неразрывный пробел, после них — обычный. Строка может кончаться тире или стрелкой, но не может с них начинаться. Согласна.

В этих четырёх текстах правило касается слов «в», «и», «а», «из», «но», «не» и тире в calendarSync и notifications. Проверила при самом крупном обычном размере текста (×1,35): ни одна строка не начинается с тире и не кончается словом из списка.

## Для разработчика

- Старый вид строк закреплён в тестах и сценарии e2e:
  - `src/i18n/__tests__/weekendsNatives.test.ts:44` — описание выходных дословно; там же, в строках 121–127, — запрет `\n` в текстах о выходных;
  - `src/i18n/__tests__/proofreadingEdits.test.ts:85` — описание уведомлений;
  - `e2e/flows/60-onboarding-russian.yaml:83` — описание выходных, строки 138–142 — описание уведомлений.
- В `welcome.description` точки нет, как и в en, es и de, поэтому `sentenceEnd` проходит. Если в en точка появится, тест потребует её и здесь: «…\nв одном месте.».

---

# T-412, третий круг: английский (один текст на en-GB и en-US)

25.11.2026. Основа — auto/main d82db11. Код не менял, ничего не коммитил.

## 1. Две строки

| Ключ | Текст | Строк при 14 pt | Почему так |
|---|---|---|---|
| `onboarding.calendarSync.description` | Rehearsals appear in your calendar automatically, and Rehearsly picks up your busy hours from it. Your team sees only those hours, not what you’re doing. | 4, по смыслу (раздел 2) | Смысл русского текста по частям, см. ниже. |
| `onboarding.notifications.description` | A new rehearsal, a new time, or a cancellation — you’ll know right away. | 2 | Строение как у русского: перечень — тире — обещание. |

**Календарь**
- «appear … automatically» — это «сами попадут». «Automatically» — слово, которым Apple описывает то, что происходит без участия человека.
- Русский пропуск глагола («а занятые часы из него — в Rehearsly») в английском интерфейсе звучит книжно. Поэтому у второй половины свой глагол: «Rehearsly picks up your busy hours from it». «From it» сохраняет источник: часы берутся из того же календаря.
- «Your team sees only those hours, not what you’re doing.» Здесь «what you’re doing» — живой аналог «ваших дел», а не технические «event details». «Those hours» отсылает к «busy hours».
- «Hours» и «team» — как в нынешнем онбординге и в «Availability» («Everyone else sees these hours…»).
- Отвергнутый вариант: «not your plans» укладывает текст в 3 строки, но в приложении с вкладкой Planner «plans» двусмысленно.

**Уведомления**
- В русском перечень смешанный: существительное и глаголы. По-английски естественнее три существительных: «a new rehearsal, a new time, or a cancellation».
- Порядок другой ради ритма: «новое» дважды подряд, отмена в конце. Смысл тот же.
- «A new time» — это «перенесли» (дата или время). Совпадает с примером под текстом «Rehearsal Time Changed».
- «Cancellation» пишется одинаково в en-GB и en-US. «Canceled/cancelled» раскололо бы один текст на два.
- «Right away» — «сразу».

**Общее**
- Сокращения «you’re» и «you’ll» — голос iOS. Приложение уже так пишет: «You’ll stay signed in.»
- Апостроф ’ (U+2019), тире « — » (U+2014 с пробелами), серийная запятая перед «or» — всё как в остальном английском тексте.
- Оба текста кончаются точкой.
- Нет слов «remind…», «free», Android и упоминания автора.

**Сверка с фактами (auto/main)**
- `CalendarSyncScreen.handleSelectCalendar`: выбранный календарь включает обе стороны — `exportEnabled` и `importEnabled` с `importCalendarIds: [calendarId]`.
- `importScope.js`: строки импорта — `'busy'` с названием `IMPORTED_TITLE` («Calendar Event»). Видно только время.
- `pushNotificationService.js`, три уведомления:
  - «a new rehearsal» — `notifyRehearsalCreated` и `notifyAddedToRehearsal`;
  - «a new time» — `notifyRehearsalUpdated` (`datetime`);
  - «a cancellation» — `notifyRehearsalDeleted`.
  
  Об изменении места текст не говорит, так что обещает меньше, чем есть, а не больше.

## 2. Строки по смыслу

Ширина — SF Pro Text Regular 14 pt.

| Ключ | Текст со `\n` | Строки, pt | Самая длинная |
|---|---|---|---|
| `onboarding.welcome.description` | `Plan rehearsals, manage schedules,\nand sync calendars in one place` | 231 / 210 | 231 |
| `onboarding.weekends.description` | `When someone looks for a rehearsal time,\nthey will see you as busy on those days.\nYou can still change any individual day\nin Availability.` | 270 / 258 / 247 / 86 | 270 |
| `onboarding.calendarSync.description` | `Rehearsals appear in your calendar automatically,\nand Rehearsly picks up your busy hours from it.\nYour team sees only those hours,\nnot what you’re doing.` | 319 / 306 / 214 / 144 | 319 |
| `onboarding.notifications.description` | `A new rehearsal, a new time, or a cancellation —\nyou’ll know right away.` | 310 / 145 | 310 |

Все строки не шире 327 pt, поэтому разбивка держится и на SE / 13 mini, а не только в 342.

Готово для кода, с неразрывными пробелами из раздела 3:

```ts
description: 'Plan rehearsals, manage schedules,\nand sync calendars in one place',
description: 'When someone looks for a rehearsal time,\nthey will see you as busy on those days.\nYou can still change any individual day\nin Availability.',
description: 'Rehearsals appear in your calendar automatically,\nand Rehearsly picks up your busy hours from it.\nYour team sees only those hours,\nnot what you’re doing.',
description: 'A new rehearsal, a new time, or a cancellation —\nyou’ll know right away.',
```

Замечания:
- **Календарь без `\n`** при 342 pt тоже ложится в 3 строки, но рвёт «Your / team». При 327 pt получается 4 строки, и «doing.» стоит одно. У русского та же граница: «Команда видит только эти часы, но не ваши дела.» — 338 pt, в 342 входит впритык, в 327 не входит.
- **Уведомления.** При 342 и 327 pt естественный перенос совпадает с разбивкой по смыслу.
- **Выходные, 3 строки.** Вариант «…day in Availability.» (337 pt) входит в 342, но на SE переносит «Availability.» и оставляет «in» в конце строки. Поэтому 4 строки. Слова прежние, вычитанные в T-406.
- **Приветствие: нет точки** — ни сейчас в en, ни в ru, es, de. По правилу брифа «каждое предложение — с точкой» её не хватает, рекомендую поставить. Но `sentenceEnd` требует от ru, es и de точку там, где она стоит в en. Значит, ставить во всех четырёх языках или ни в одном. Разбивка от точки не меняется.

## 3. Короткие слова (en)

- **Однобуквенные: «a», «A», «I».** Привязывать неразрывным пробелом к следующему слову: `a rehearsal`. В четырёх текстах:
  - выходные: «a rehearsal»;
  - уведомления: «A new», «a new», «a cancellation»;
  - в календаре и приветствии таких слов нет, «I» не встречается.
- **Перед «—» и «→» — неразрывный пробел**, после них обычный. В этих четырёх текстах одно тире: `cancellation —`. Стрелка — в путях вроде «Profile → Calendar Sync» (`laterWhere`, `weekends.note`). Там правило то же: `Profile → Calendar Sync`.
- **Сверх списка, только en:** `from it.` в календаре. При шрифте на одну-две ступени крупнее (16–17 pt) иначе «it.» уходит на строку одно. С пробелом переносится «from it.».

## 4. Что держит прежний текст и меняется вместе с ним

- `src/i18n/__tests__/proofreadingEdits.test.ts` — строки en `onboarding.notifications.description` и `onboarding.calendarSync.description`.
- `src/i18n/__tests__/weekendsNatives.test.ts`:
  - строка 53 держит `weekends.description` одной строкой;
  - тест «no weekends text has a line break of its own» должен разрешить `\n` и в `weekends.description`, а не только в `question`.
- `e2e/flows/09-onboarding.yaml:71` — английский текст выходных одной строкой с «\\. ». С `\n` выражение нужно поправить.

## 5. Как мерил

CoreText, системный шрифт 14 pt, ширина строки без хвостового пробела.

Сверено со снимком `audit/evidence/T-408/green/09-onboarding-calendar.png` (iPhone, 393 pt) — прежний английский текст. Ширина по краям глифов:

| Строка | Симулятор | Расчёт |
|---|---|---|
| 1 | 323,0 pt | 322,7 pt |
| 2 | 327,3 pt | 327,3 pt |
| 3 | 284,3 pt | 284,4 pt |

Переносы тоже совпали. В таблицах — ширина набора: она на 1–2 pt больше ширины по краям глифов.

---

# T-412, третий круг — испанский (es)

25.11.2026. Носитель es.

**Что прочитал:**
- бриф с дополнением о наборе по смыслу;
- `onboarding.ts` на auto/main и соседние строки es: `calendarSync.explanation`, `welcome.feature1`, `calendarSync.clearImportedMessage`, пуши сервера `Nuevo ensayo` и `Ensayo cancelado`;
- `OnboardingStep.tsx`: описание 14 pt, по центру, поля по 24 pt.

**Как мерил.** CoreText, системный шрифт (SF Pro Text Regular) 14 pt, на этом Mac. В T-406 такой замер сверили со скриншотом: 331,7 pt на Mac против 329,7 pt на экране. Значит, на телефоне строки примерно на 0,6 % уже, и цифры ниже — с запасом.

## 1. Новые описания

| Ключ | Текст | Строк при 14 pt | Почему так |
|---|---|---|---|
| `onboarding.calendarSync.description` | `Los ensayos aparecerán solos en tu calendario, y de él llegarán a Rehearsly tus horas ocupadas. El equipo ve solo esas horas, no tus planes.` | 3 | См. ниже |
| `onboarding.notifications.description` | `Ensayo nuevo, cancelado o reprogramado: te enterarás al instante.` | 2 | См. ниже |

**Календарь:**
- «aparecerán solos» — это «сами попадут». «solos» после глагола значит «сами по себе», как в прежнем «llegarán solas».
- «y de él llegarán a Rehearsly tus horas ocupadas» — это «а занятые часы из него — в Rehearsly».
  - Слова те же, что в профиле: `calendarSync.explanation` говорит «de él solo llegan las horas que tienes ocupadas».
  - «de él … a Rehearsly» стоят в одной строке.
  - «tus horas ocupadas» стоят в конце, поэтому «esas horas» в следующей фразе указывает прямо на них.
- «horas ocupadas» — слово приложения. Слов «ocupado / ocupada» о человеке нет, поэтому нет и рода.
- «no tus planes» — это «но не ваши дела». Так по-испански обычно говорят о том, что у человека в календаре: коротко и по-человечески.
  - «tus asuntos» хуже: «Asunto» — это ещё и тема письма или события.
  - «lo que haces» слишком общее.
- Больше фактов текст не обещает. Есть обе стороны синхронизации, переходят только часы, команда видит только их.

**Уведомления:**
- «Ensayo nuevo, cancelado o reprogramado» — одно существительное и три состояния. Так пишут испанские приложения: «Vuelo retrasado o cancelado: …».
  - Прилагательное «nuevo» стоит после существительного. Иначе оно не встанет в один ряд с «cancelado o reprogramado».
  - «cancelado» — слово пуша «Ensayo cancelado».
- «reprogramado» — это «перенесли»: и дата, и время. Сочетание «cambio de hora» не годится: по-испански это ещё и перевод часов.
- Двоеточие вместо русского тире: для связки «что случилось: что будет» в испанском естественно двоеточие. После него строчная буква.
- «te enterarás al instante» — это «вы узнаете сразу».
- Чего в тексте нет:
  - слова «recordatorio»;
  - слов «cada ensayo»: они пообещали бы новости и о репетициях, где человека нет.

## 2. Строки по смыслу

`\n` ставится вместо пробела, без пробелов вокруг. Иначе центровка съедет.

| Ключ | Текст со `\n` | Ширина строк, pt | Самая длинная, pt |
|---|---|---|---|
| `onboarding.welcome.description` | `Planifica ensayos, gestiona horarios\ny sincroniza calendarios en un solo lugar` | 230,8 / 261,3 | 261,3 |
| `onboarding.weekends.description` | `Así, cuando alguien busque un horario,\ntus fines de semana contarán como ocupados.\nPuedes cambiar cualquier día\npor separado en Disponibilidad.` | 250,4 / 301,3 / 190,0 / 204,5 | 301,3 |
| `onboarding.calendarSync.description` | `Los ensayos aparecerán solos en tu calendario,\ny de él llegarán a Rehearsly tus horas ocupadas.\nEl equipo ve solo esas horas, no tus planes.` | 304,8 / 310,7 / 280,4 | 310,7 |
| `onboarding.notifications.description` | `Ensayo nuevo, cancelado o reprogramado:\nte enterarás al instante.` | 274,1 / 151,9 | 274,1 |

Все строки не шире 311 pt. Они входят в 342 pt и в 327 pt (SE, 13 mini).

Почему так:
- **Приветствие.** Слова прежние. Строка рвётся перед последним пунктом перечня, и «y» открывает вторую строку.
  - Сейчас текст переносится сам: «…y sincroniza / calendarios…», то есть глагол отрывается от дополнения.
  - Вариант в три строки, с «en un solo lugar» отдельно (231 / 155 / 103), не взял. Он прибавляет строку на шаге, где ниже аватар и три пункта, а на SE там тесно.
- **Выходные.** Слова прежние. Каждая фраза занимает две строки.
  - Вторая фраза целиком — 398 pt, в строку не входит.
  - Вариант «…por separado / en Disponibilidad.» оставляет хвост в 115 pt, поэтому выбран разрыв «cualquier día / por separado».
- **Календарь.** Три строки почти равны:
  - что попадает в календарь;
  - что приходит из него;
  - что видит команда.
- **Уведомления.** Что случилось — и что будет.

## 3. Короткие слова (es)

Однобуквенные слова не должны оставаться в конце строки. После них ставится неразрывный пробел, и слово уходит на новую строку вместе со следующим:
- **a** — предлог: «a Rehearsly»;
- **y** — «и»;
- **e** — «и» перед i- / hi-: «e ideas»;
- **o** — «или»;
- **u** — «или» перед o- / ho-: «siete u ocho».

В четырёх текстах выше неразрывный пробел нужен в таких местах:
- приветствие: «y sincroniza»;
- календарь: «y de» и «a Rehearsly»;
- уведомления: «o reprogramado»;
- в тексте о выходных таких слов нет.

Проверил крупный шрифт, 16–21 pt. Например, при 19 pt первая строка уведомлений переносится так: «Ensayo nuevo, cancelado / o reprogramado:».

**Тире и стрелка:**
- **«→»:** неразрывный пробел нужен с обеих сторон, как уже сделано в «Perfil → Fines de semana ocupados».
- **Тире.** В испанских строках приложения длинного тире нет, в этих четырёх текстах тоже.
  - По испанской норме тире вводной части пишется вплотную к слову («—por ejemplo—»), поэтому строка с закрывающего тире начаться не может.
  - Если появится тире с пробелами, как в английском, перед ним нужен неразрывный пробел, как в других языках.
- **«¿ ¡ « »»** пишутся вплотную к слову, им ничего не нужно.

## 4. Для разработчика: что держит испанский текст

- **`weekendsNatives.test.ts`:**
  - строка 62 сверяет `weekends.description` es через `toBe` с текстом в одну строку;
  - правило «no text has a line break of its own» должно пропускать `\n` и в описаниях.
- **e2e flow 60.** `notVisible` с испанским описанием выходных (около строки 213) ищет текст в одну строку. Его нужно поменять на текст с переносами.
- **`sentenceEnd`.** Все четыре строки кончаются так же, как английские: календарь, уведомления и выходные — точкой, приветствие — без знака, как в en.

---

# T-412, третий круг: немецкий (de)

- Код только читала, через `git show auto/main:…`. Ничего не меняла и не коммитила.
- **Как замеряла:** AppKit (TextKit), системный шрифт 14 pt Regular (SF Pro Text), перенос по словам, без дефисов. Сверила со скриншотом `audit/evidence/T-408/green/60-60-onboarding-calendar-de.png`: нынешнее немецкое описание при 345 pt разбивается на те же строки, что на экране. Ширины даны в pt.

## 1. Два новых описания

| Ключ | Текст | Строк при 14 pt | Почему так |
|---|---|---|---|
| `onboarding.calendarSync.description` | Proben landen von selbst in deinem Kalender, belegte Zeiten von dort in Rehearsly. Die anderen im Projekt sehen nur diese Zeiten, aber nicht, was du vorhast. | 4 по смыслу. Без разбивки тоже 4 при любой ширине от 327 до 345, но переносы режут «Die anderen im Projekt» и «was du vorhast». | Первое предложение повторяет русскую конструкцию «а занятые часы из него — в Rehearsly»: глагол во второй части опущен, обе стороны синхронизации названы. Слова те же, что на экране Kalender-Sync и в App Store: «landen», «von selbst», «belegte Zeiten». «Команда» передана так же, как раньше на этом месте: «Die anderen im Projekt». Так решили в T-256, чтобы обойтись без «Ensemble»; слова «Team» в немецком приложении нет. «aber nicht, was du vorhast» — это «но не ваши дела»: передаётся только время, без названий. Запятая перед «was» обязательна. Слов «Telefon» и «Erinnerung» нет. |
| `onboarding.notifications.description` | Neue Probe, Absage oder Verschiebung – du erfährst es sofort. | 2 | Три случая из текста владельца в его порядке. Это существительные: в варианте «Neue Probe, abgesagt oder verlegt» причастия цепляются к «Neue Probe». «Neue Probe» — заголовок самого пуша. «Absage oder Verschiebung» — привычная немецкая пара, а «verschoben» стоит в App Store. «du erfährst es sofort» передаёт «вы узнаете сразу»: пуш уходит, как только организатор сохранил изменение. Напоминаний не обещает. |

- **3 строки у календаря** выходят только с «Dein Team sieht nur diese Zeiten, keine Details.» (305 pt). Но «keine Details» теряет «ваши дела», а «Team» в немецком приложении — новое слово. Поэтому 4.
- **ru**, читала ради смысла: ошибок нет.

## 2. Строки по смыслу

Слова приветствия и выходных не трогала, только разбила на строки.

| Ключ | Текст со `\n` | Ширина строк, pt | Самая длинная |
|---|---|---|---|
| `onboarding.welcome.description` | `Plane Proben, verwalte Termine\nund synchronisiere Kalender an einem Ort` | 203 · 270 | 270 |
| `onboarding.weekends.description` | `Dann gelten deine Wochenenden\nbei der Terminsuche als belegt.\nEinzelne Tage kannst du\nunter Verfügbarkeit ändern.` | 213 · 202 · 156 · 179 | 213 |
| `onboarding.calendarSync.description` | `Proben landen von selbst in deinem Kalender,\nbelegte Zeiten von dort in Rehearsly.\nDie anderen im Projekt sehen nur diese Zeiten,\naber nicht, was du vorhast.` | 294 · 236 · 301 · 174 | 301 |
| `onboarding.notifications.description` | `Neue Probe, Absage oder Verschiebung –\ndu erfährst es sofort.` | 270 · 136 | 270 |

- **Все строки уже 327 pt**, а не только 342. Значит, при обычном размере шрифта разбивка держится и на iPhone шириной 375 pt (SE, 13 mini).
- **Приветствие.** «und» открывает вторую строку. «an einem Ort» остаётся с последним пунктом перечня.
- **Выходные: 4 строки, а не 3.** В варианте из трёх строк третья, «Einzelne Tage kannst du unter Verfügbarkeit ändern.», занимает 338 pt. В 342 она входит, но на iPhone шириной 375 pt одно «ändern.» уйдёт на отдельную строку. Предлог «unter» стоит со своим словом.
- **Календарь.** Одна строка — одна часть мысли. «von dort in Rehearsly» не разрывается, так же как «из него — в Rehearsly».
- **Уведомления.** Тире заканчивает первую строку, перед ним неразрывный пробел. В исходнике его можно оставить литералом, как в `settingUp`.
- **Крупный шрифт в настройках iPhone.** Первой при ×1,12 на ширине 327 pt переносится третья строка календаря (331 pt): «Zeiten,» уходит вниз. Остальные строки держатся.

## 3. Короткие слова в конце строки (de)

- **Таких нет.** Однобуквенных слов в немецком нет. Короткие предлоги, союзы и местоимения (in, an, am, im, um, zu, und, oder, du, es) по немецким правилам набора могут стоять в конце строки: Duden и DIN 5008 не требуют их привязывать, и немецкий читатель этого не ждёт.
- **Неразрывный пробел в немецком нужен в других местах:**
  - **перед «–»**, чтобы строка не начиналась с тире. Здесь это только «Verschiebung –»;
  - **перед «→».** В путях это уже сделано: `settingPath` склеивает весь путь, flow 60 проверяет «Profil → Wochenenden belegt»;
  - **перед «…»** — уже так: «wird eingerichtet …»;
  - **между числом и словом и внутри сокращений** — «1 Probe», «19:00 Uhr», «z. B.». В этих четырёх описаниях таких мест нет.

## Для разработчика: старый текст держат

- `src/i18n/__tests__/secondReading.test.ts:81` — нынешнее de `notifications.description`.
- `src/i18n/__tests__/proofreadingEdits.test.ts:329` — нынешнее de `calendarSync.description` в колонке «после».
- `src/i18n/__tests__/weekendsNatives.test.ts:71` — de `weekends.description` одной строкой. Тест «no weekends text has a line break of its own» тоже придётся поменять: с этой разбивкой `\n` появится в описании, а не только в вопросе.
- `e2e/flows/60-onboarding-russian.yaml:339` — `notVisible` ищет немецкое описание выходных одной строкой. С `\n` текст не найдётся, и сценарий запишет ошибку «de: the weekends description».
- `src/features/onboarding/screens/CalendarSyncScreen.tsx:185` — сноска под «Später einrichten» собирает путь сама (`${t.nav.profile} → ${t.calendarSync.title}`), с обычными пробелами, а не через `settingPath`. Там строка может начаться с «→».
