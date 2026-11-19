# T-271 и T-272: вычитка испанского (es): выход из проекта и подсказка об аватаре

## 1. Кто читал

Редактор-носитель испанского: продуктовые тексты на нейтральном испанском для Испании и Латинской Америки, на «tú»; работал с театральными и танцевальными труппами в Мадриде и Мехико.

## 2. Часть A

**Как читал.**
- Пуши собраны настоящим `server/i18n/pushNotifications.js` и `shared/quoteName.cjs` (Node), с короткими и длинными именами и названиями.
- Окно сверено с `ProjectDetailScreen.tsx`: заголовок `leaveProjectConfirm`, текст `leaveProjectMessage`, кнопки «Cancelar» и «Salir del proyecto».
- Кто какой пуш получает, сверено с `routes/native/members.js`. Тот, кто удалил, пуш не получает.

| Ключ | Сейчас | Вердикт | Предлагаю | Почему | Тип |
|---|---|---|---|---|---|
| `leaveProject` | Salir del proyecto | оставить | — | Групповые приложения называют это действие так же («Salir del grupo»). Строится как «Eliminar proyecto» у владельца: глагол и предмет. Одинаково в Испании и Латинской Америке. | — |
| `leaveProjectConfirm` | ¿Salir del proyecto? | оставить | — | Пара к «¿Eliminar proyecto?», знаки ¿ ? на месте. Кнопка в окне повторяет вопрос, как обычно в окнах iOS. | — |
| `leaveProjectMessage` | `` `El proyecto ${quoteName(projectName, 'es')} desaparecerá de tu lista y dejarás de estar en sus ensayos. Podrás volver con una invitación.` `` | оставить | — | Звучит по-испански. После вопроса в заголовке идёт утверждение, второго вопроса нет. «estar en un ensayo» — слово приложения («No estás en este ensayo»), «invitación» утверждено. О читателе только глаголы, прилагательных нет. «sus ensayos» однозначно относится к проекту. Пример: `El proyecto «Bodas de sangre 2026» desaparecerá de tu lista y dejarás de estar en sus ensayos. Podrás volver con una invitación.` | — |
| `leaveProjectError` | No se pudo salir del proyecto | оставить | — | Как «No se pudo eliminar el proyecto». На экране это текст под заголовком «Error», когда сервер не назвал причину. Без точки, как в английском и в соседних строках. | — |
| `memberLeft.title` | Salida del proyecto | оставить | — | Именная фраза того же вида, что «Cambio de rol» и «Nuevo miembro». «su salida del proyecto» — обычные слова об уходе из труппы или команды. Кто ушёл, тут же говорит текст. С человеком ничего не согласуется. | — |
| `memberLeft.body` | `` `${memberName} dejó el proyecto ${es(projectName)}` `` | оставить | — | Так говорят о человеке, ушедшем из постановки, в обоих регионах. Простое прошедшее время, как «se unió al proyecto» в соседнем пуше. «salió del proyecto» повторило бы корень заголовка «Salida». Глагол без причастия, пол не угадывается. | — |
| `memberWasRemoved.title` | Baja en el proyecto | заменить | Miembro eliminado | 1) В приложении это действие — «eliminar»: кнопка «Eliminar del proyecto», окно «¿Eliminar miembro?», «¿Seguro que quieres eliminar a … del proyecto?», сообщение «Miembro eliminado del proyecto». 2) «una baja» на работе в Испании — прежде всего больничный («estar de baja»), в спорте и в труппе — выбывший. А «darse de baja» значит уйти самому. Заголовок не отличает удаление от соседнего «Salida del proyecto», хотя иконка у обоих пушей одна. 3) «Miembro eliminado» — пара к «Nuevo miembro», того же вида, что «Proyecto eliminado». Причастие согласуется со словом «miembro», а не с человеком. Это верно для любого пола, как «Nuevo miembro» (термины T-256). Длина 17 знаков вместо 19. | лучше так |
| `memberWasRemoved.body` | `` `Han quitado a ${memberName} del proyecto ${es(projectName)}` `` | заменить | `` `Han eliminado a ${memberName} del proyecto ${es(projectName)}` `` | Глагол тот же, что на кнопке и в заголовке. «quitar» в приложении — о репетициях («Te han quitado de un ensayo») и о правах («Quitar permisos de administrador»). Участника из проекта «eliminan». Безличное «Han … a» разработчика оставляю: пол оно не угадывает и звучит естественно в обоих регионах. Пример: `Han eliminado a Lucía Martín del proyecto «Hamlet»`. | лучше так |

**1. Естественно ли? Так ли пишут в iOS и в групповых приложениях?**
- Строки экрана — да. Так устроено окно iOS: вопрос в заголовке, последствия в тексте, кнопки «Cancelar» и красная «Salir del proyecto». Так же пишут групповые приложения: «Salir del grupo».
- Пуш об уходе естественен. Пуш об удалении понятен, но «Baja» — слово отдела кадров и больничного, а не приложения (см. таблицу).

**2. Угадывается ли пол?** Нет, ни у читателя, ни у того, о ком пуш.
- **Читатель.** В окне только глаголы второго лица: «dejarás», «Podrás».
- **Человек в пуше.** «dejó» и «Han quitado a …» — без причастий. Обойти «dado de baja» было верно: «X ha sido dado/dada de baja» выдало бы пол. Безличное «Han … a X» — тот же приём, что в утверждённом «Te han quitado de un ensayo». Удачно.
- **Мои правки.** «Han eliminado a X» строится так же. В «Miembro eliminado» причастие согласуется со словом «miembro», как в «Nuevo miembro» и в сообщении приложения «Miembro eliminado del proyecto».

**3. Совпадают ли слова с приложением?**
- «proyecto», «ensayo», «invitación» — как на экранах.
- **«miembro».** В новых пушах этого слова нет. С правкой оно стоит в заголовке об удалении, как в «Nuevo miembro». «participante» здесь не нужно: речь о проекте, а не о репетиции.
- **Глагол удаления.** На экранах — «eliminar». Отсюда две правки.
- **Глагол ухода.** «Salir» на кнопке и «dejar» в пуше значат одно и то же. Оставляю.

**4. Совпадает ли вид заголовков с соседними?**
- Испанские заголовки о других людях — короткие именные фразы с заглавной только в начале и без точки: «Nuevo miembro», «Permisos de administrador», «Cambio de rol», «Proyecto eliminado».
- «Salida del proyecto» — того же вида.
- «Baja en el proyecto» по виду тоже подходит, но слово не то.
- «Miembro eliminado» построен как «Proyecto eliminado» и стоит в паре с «Nuevo miembro».

**Вне вычитки, касается всех языков.** Допустим, участника уже удалили, а у него ещё открыта страница проекта, и он нажимает «Salir del proyecto». Сервер ответит 403 «Only project admins can remove members». Приложение покажет этот текст как есть под «Error» — по-английски и не о том, что случилось. `leaveProjectError` в этом случае не появится.

## 3. Часть B

`avatarHint: 'Tu avatar muestra las iniciales de tu nombre y apellido.'`

Почему так: «muestra» — о том, что видно прямо над подсказкой, а «nombre y apellido» повторяют подписи полей под ней («Nombre», «Apellido»), так что ясно, откуда буквы; нет ни «automáticamente», ни фото, ни почты; на «tú», с точкой, 56 знаков (есть «iniciales», нет «correo» — проходит `avatarHint.test.ts`).

Пока я читал, в `auto/main` появился коммит `b799aee` (T-272) с испанской строкой «El avatar se crea automáticamente a partir de tus iniciales.». Она не говорит, из чего эти инициалы. Строка выше её заменяет.

## 4. Итог

правок в A: 2 (ошибок: 0); B готова
