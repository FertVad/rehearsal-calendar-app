# T-425: what the monitor should look at with the editor

The strings are copied from `natives-ru.md` (this folder) word for word, ⍽ as U+00A0
(`typeset()` in `dashboard.js`). None was changed. Where the code and a string could part:

1. **The block's footnote leaves out one sentence.** «Шаги организатора после „Создали
   проект“⍽— доля от⍽создавших проект.» is T-427's, as the owner's note says. The rest
   of the footnote is the editor's text unchanged.
2. **"Empty cell" is literally empty** (`''`), as the footnote says, not the page's usual
   «—» for "X of 0". Days 1 and 7 without migration 016 are not empty but say
   «Нет данных: миграция⍽016 не применена» (the page's existing string): there the
   footnote's «срок ещё ни у⍽кого не прошёл» would be false.
3. **Onboarding** is of everyone registered in the column, as of now (the monitor's
   decision); the footnote's «и⍽от⍽всех зарегистрировавшихся» stays.
4. **«В среднем за⍽день»** divides by the number of days chosen, also when the dates
   reach past today: a test still running reads lower until it ends.
5. **The 7 days** are instants: a step counts when reached before registration + 7×24 h,
   and someone counts in «из» once that moment has passed. Days 1 and 7 are the person's
   own dates, as in the retention table (usage.js).
6. **Dates bound every section** (task item 1). Two existing notes read on literally:
   «Проекты»: «…с⍽репетицией, которая начинается не раньше начала периода (в⍽том числе
   в⍽будущем)» — kept as it says, no upper end for rehearsals; a project's creation is
   bounded by «По». Invitation counts: «С начала периода (дни по UTC)» — with dates they
   now stop at «По» as well. If the editor wants the notes to say so for dates, it is
   their wording.
7. **Two refusals have no string of their own** and show the generic «Запрос не выполнен.
   Попробуйте ещё раз.»: `DATES_PERIOD` (dates with another period) and `COHORT_SOURCE`
   (cohort with a source). The page never sends either; only a hand-made URL gets them.
8. **«Выберите даты теста.» vs «Укажите обе даты.»**: the first when the switch is on and
   both fields are empty, the second otherwise when a field is empty. While the dates
   cannot be asked for, nothing is sent and the sections keep the earlier figures under
   «Показаны прежние данные — возможно, они устарели.» (the page's existing string)
9. **No Maestro flow**: the admin is a web page, not the app; the on-screen part is shown by
   the browser test `adminDashboard.browser.test.mjs` («dates and the test cohort…»),
   red on the base (`browser-red-before.txt`).
