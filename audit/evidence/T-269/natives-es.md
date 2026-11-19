# T-269 и T-270: вычитка испанского (es) — политика, поддержка, кнопка «удалить импортированное»

## 1. Кто читал

Редактор-носитель испанского: правлю продуктовые и юридические тексты на нейтральном испанском для Испании и Латинской Америки, на «tú»; работал с театральными и танцевальными труппами в Мадриде и Мехико.

**Как читал.**
- Испанский блок `privacy.html` (строки 591–881) прочитан целиком. Испанская страница `support.html` (184–262) тоже прочитана целиком. Правка `25e2d1d`.
- Сверено с английским блоком, с диффом `621d3a5..25e2d1d`, со строками приложения в `src/i18n/translations/` (`calendarSync`, `profile`, `availability`, `calendar`, `auth`, `projects`, `notifications`) и с отчётами T-256, T-261, T-276.
- Названия Apple и Google сверены по справкам Apple и Google для Испании и для Латинской Америки (адреса в вопросе 4).
- Настройка автосинхронизации хранится на устройстве (`calendarStorage.ts`, AsyncStorage). Отсюда «en este dispositivo» в частях B и C.

## 2. Часть A

Номера строк — по правке `25e2d1d`. Разметку, ссылки и `lang` не трогаю.

| Где (раздел, начало фразы) | Сейчас | Предлагаю | Почему | Тип |
|---|---|---|---|---|
| Политика · вступление «Rehearsly guarda…» (стр. 598) и список «Lo que deliberadamente no recopilamos» (стр. 722) | …y la aplicación no contiene analítica ni rastreadores. · Identificadores publicitarios, analítica ni rastreadores | …y la aplicación no incluye herramientas de análisis ni de rastreo. · Identificadores publicitarios ni datos de análisis o de rastreo | «analítica» как существительное — жаргон Испании. Там же «una analítica» — это анализ крови. В Латинской Америке так не говорят. «análisis» и «rastreo» понятны везде. | лучше так |
| Политика · «Quién es responsable», «Rehearsly está desarrollada por…» (стр. 603) | Rehearsly está desarrollada por Vadim Fertik, desarrollador independiente residente en Israel. | Rehearsly la gestiona Vadim Fertik, desarrollador independiente residente en Israel. | В английском «operated by». В разделе об ответственном важно, кто ведёт сервис и отвечает за данные, а не кто писал код. «desarrollada por» — как раз фраза об авторе, которой тексты избегают (см. вопрос 2 ниже). | лучше так |
| Политика · таблица, «Contraseña…», колонка «Cuándo» (стр. 624) | Solo si te registras con correo o defines una contraseña | Solo si te registras con correo o creas una contraseña | «definir una contraseña» — калька с «set a password». Пароль «se crea». Так же пишет письмо приложения («para crear una contraseña nueva»). | лучше так |
| Политика · таблица, «Códigos de un solo uso…» (стр. 627) | …cada código vale 15 minutos | …cada código sirve durante 15 minutos | «vale 15 minutos» сначала читается как «стоит 15 минут». «sirve durante» — как на странице поддержки о ссылке-приглашении («sirve durante una semana»). | лучше так |
| Политика · таблица, «Identificador y correo…», колонка «Cuándo» (стр. 634) | Solo si usas ese acceso | Solo si inicias sesión con Google o Apple | «ese acceso» расплывчато. Описание действия совпадает с кнопкой приложения «Iniciar sesión con Google» и не спорит с Google для Латинской Америки, где кнопка называется «Acceder con Google». | лучше так |
| Политика · таблица, «Proyectos, ensayos…», колонка «Cuándo» (стр. 644) | Según los creas | A medida que los creas | «según los creas» можно прочесть и как «по мере того как создаёшь», и как «в зависимости от того, как создаёшь». «a medida que» однозначно везде. | лучше так |
| Политика · таблица, «Tu disponibilidad…» (стр. 647, 649) | Tu disponibilidad — periodos libres y ocupados · (Cuándo) Según los indicas | Tu disponibilidad — horas libres y ocupadas · (Cuándo) A medida que las marcas | Слова занятости — как на экранах: «Marcar horas ocupadas», «Horas ocupadas», «Marca las horas en que no puedes». Глагол приложения — «marcar» (в английском «As you mark them»). Слова «periodo» на экранах нет. | лучше так |
| Политика · таблица, «Hora de inicio y fin…», колонка «Para qué» (стр. 653) | Convertirlos en periodos ocupados automáticamente | Convertirlos automáticamente en horas ocupadas | То же слово экранов. Наречие ближе к глаголу. | лучше так |
| Политика · таблица, «Token de notificaciones…», колонка «Para qué» (стр. 658) | Enviarte avisos sobre tus ensayos | Enviarte notificaciones sobre tus ensayos | Одно понятие — одно слово (T-261). В той же строке «permites las notificaciones», в приложении экран «Notificaciones». | лучше так |
| Политика · четыре места: таблица «Los ensayos que has marcado…» (стр. 678); «Dónde se guardan…» (стр. 779); «Cómo eliminarlos» (стр. 787); абзац «Una cosa permanece…» (стр. 834, он в D1) | quienes llevan el proyecto · a quienes gestionan tus proyectos · a quienes gestionan tus proyectos · quienes gestionan ese proyecto | quienes administran el proyecto · a quienes administran tus proyectos · a quienes administran tus proyectos · quienes administran ese proyecto | В английском везде одно «run», в испанском два разных глагола. «administrar» — глагол приложения («Hacer admin», «ahora administra», «que solo administrabas tú»). Он точно покрывает тех, кому приходит уведомление: «Admin principal» и администраторов. Рода не угадывает. | лучше так |
| Политика · таблица, «Un hash con clave…», вторая фраза (стр. 682) | Cuenta las peticiones durante un minuto y no está vinculado a tu cuenta; … | Cada registro abarca las peticiones de un minuto y no está vinculado a tu cuenta; … | Фраза начинается с «Cuenta», и сначала это читается как существительное «аккаунт». Через пять слов «tu cuenta» стоит уже в этом значении. Подлежащего нет: что считает — хеш или счётчик? «Cada registro» связывает фразу с «los registros antiguos» после неё. | лучше так |
| Политика · «Sobre la importación de calendario», последний абзац (стр. 709–714) | Desactivar la Sincronización automática … no elimina los periodos ocupados ya importados: siguen en tu cuenta y los miembros de tus proyectos los siguen viendo como ocupados. … | Абзац целиком — в части C | Заглавная «S» посреди фразы — английская манера; функцию по-испански пишут строчными. «periodos» → «horas», как на экранах. «siguen… siguen» подряд. | лучше так |
| Политика · «Lo que deliberadamente no recopilamos» (стр. 720) | Contactos ni agenda | Contactos | В Латинской Америке «agenda» — ежедневник и расписание («agendar» — назначить встречу), а не адресная книга. Мексиканец прочтёт «не собираем ваше расписание», и это сразу после раздела о том, как мы читаем календарь. Адресная книга в iOS и так называется «Contactos». | ошибка |
| Политика · «Pagos» (стр. 728) | Rehearsly es gratuita y la aplicación no contiene compras. | Rehearsly es gratuita y no ofrece compras dentro de la aplicación. | «contener compras» — калька с «contains no purchases». В App Store это называется «compras dentro de la app». «Rehearsly… la aplicación» в одной фразе — повтор. | лучше так |
| Политика · «Quién más procesa tus datos», пункт Resend (стр. 736) | …recibe tu correo y el texto del mensaje (UE, Irlanda) | …recibe tu dirección de correo y el texto del mensaje (UE, Irlanda) | Рядом с «el texto del mensaje» «tu correo» читается как «твоё письмо». В разделе о Google уже стоит «Resend recibe tu dirección de correo». | лучше так |
| Политика · там же, пункт Google и Apple (стр. 738) | …solo si eliges su acceso | …solo si inicias sesión con ellos | «su acceso» неясно: чей доступ и к чему. | лучше так |
| Политика · «Qué recibimos de Google», «No pedimos acceso…» (стр. 756) | No pedimos acceso a tu Gmail, Google Calendar ni Google Contacts. | No pedimos acceso a tu Gmail, Google Calendar ni Contactos de Google. | Google по-испански называет сервис «Contactos de Google» и для Испании, и для Латинской Америки. «Google Calendar» оставить: так подписан вариант на экране «Sincronización», и так пишет Google для Испании (для Латинской Америки — «Calendario de Google»). | ошибка |
| Политика · «Para qué los usamos», последняя фраза (стр. 768–769) | Si ya existe una cuenta con la misma dirección verificada, Google se vincula a ella y la cuenta conserva su nombre. | Si ya existe una cuenta con la misma dirección verificada, el inicio de sesión con Google se vincula a esa cuenta, que conserva su nombre. | «Google se vincula» читается так, будто к аккаунту привязывается сама компания. Привязывается способ входа. | лучше так |
| Политика · «Cómo eliminarlos», ссылка (стр. 789–790) | También puedes retirar el acceso de Rehearsly en los ajustes de tu cuenta de Google. | También puedes retirar el acceso de Rehearsly en la configuración de tu cuenta de Google. (Текст ссылки — «configuración de tu cuenta de Google». Артикль перед ссылкой «los» → «la».) | Google в обоих вариантах испанского пишет «configuración» («Actualizar tu configuración… desde tu cuenta de Google»). «ajustes» — слово iOS Испании. Совпадает с решением T-256 «la configuración del teléfono». | лучше так |
| Политика · «Cómo eliminarlos», конец (стр. 791–792) | …pero no borra lo que ya tenemos; para ello hay que eliminar la cuenta. | …pero no borra lo que ya tenemos; para eso tienes que eliminar tu cuenta de Rehearsly. | Последняя упомянутая «cuenta» — «tu cuenta de Google». Фраза читается как «чтобы стереть данные, удалите аккаунт Google». Это неверно и пугает. | ошибка |
| Политика · «Uso limitado (Limited Use)», строка со ссылкой (стр. 803) | Texto de la política: Google API Services User Data Policy. | Texto de la política (en inglés): Google API Services User Data Policy. | Страница Google есть только по-английски (проверил с `hl=es`). Читатель должен знать, куда его ведут. | лучше так |
| Политика · «Iniciar sesión con Apple», первая фраза (стр. 807–809) | …y, si el token de inicio de sesión los incluye, tu dirección de correo y la confirmación de que está verificada. | …y, si el token de inicio de sesión las incluye, tu dirección de correo y la confirmación de que está verificada. | Местоимение заменяет «dirección» и «confirmación». Оба слова женского рода, поэтому «las». | ошибка |
| Политика · там же, «Tu nombre llega una sola vez…» (стр. 809) | Tu nombre llega una sola vez, la primera vez que inicias sesión, y solo si lo permites. | Tu nombre solo llega la primera vez que inicias sesión, y únicamente si lo permites. | «una sola vez, la primera vez» — «vez» дважды подряд. | лучше так |
| Политика · там же, «Si eliges Ocultar mi correo…» (стр. 809) | Si eliges Ocultar mi correo, recibimos… | Si eliges «Ocultar mi correo», recibimos… | Без кавычек «mi» в тексте на «tú» читается как «мою почту», то есть почту автора. Кавычки отмечают название варианта, как приложение пишет названия кнопок. Название сверено (вопрос 4). | лучше так |
| Политика · там же, последняя фраза (стр. 816–817) | Puedes dejar de usar el inicio de sesión con Apple para Rehearsly en los ajustes de tu cuenta de Apple. | Puedes dejar de usar Iniciar sesión con Apple en Rehearsly desde la configuración de tu cuenta de Apple. | Название функции — как на iPhone в обоих регионах: «Iniciar sesión con Apple». Это тот пункт, который человек ищет в настройках. Apple для Латинской Америки пишет «configuración de la cuenta de Apple», для Испании — «ajustes». Беру «configuración», как решено в T-256. | лучше так |
| Политика · заголовок «Cuánto tiempo los conservamos» (стр. 820) и две ссылки на него в «» (стр. 788 и 847) | Cuánto tiempo los conservamos | Cuánto tiempo conservamos tus datos | «los» в заголовке не к чему отнести: это калька с «How long we keep it». На заголовок ссылаются в кавычках из двух мест, и там он стоит совсем без опоры. | лучше так |
| Политика · «Cuánto tiempo…», первый абзац, список (стр. 823) | …disponibilidad, eventos importados, tus notificaciones… | …disponibilidad, horas importadas de tus calendarios, tus notificaciones… | Мы импортируем не события, а их часы: раздел об импорте говорит это прямо. Кнопка будет называться «Eliminar horas importadas». | лучше так |
| Политика · «Cuánto tiempo…», «Dos registros duran algo más» (стр. 839–841) | …durante hasta 7 días… y los datos eliminados salen de él al acabar ese plazo. | …durante un máximo de 7 días… y los datos eliminados desaparecen de él al acabar ese plazo. | Два предлога подряд «durante hasta» звучат неуклюже. «salir de un historial» так не говорят. | лучше так |
| Политика · «Tus derechos», «Desactivar las notificaciones» (стр. 850) | …o los ajustes del dispositivo. | …o la configuración del teléfono. | Решение T-256: системные настройки называем описательно, как в приложении («Permite las notificaciones de Rehearsly en la configuración del teléfono»). | лучше так |
| Политика · «Menores» (стр. 865–866) | …y no recopilamos sus datos conscientemente. | …y no recopilamos sus datos a sabiendas. | «a sabiendas» — устойчивое юридическое «knowingly», так пишут в политиках. «conscientemente» понятно, но звучит не по-юридически. | лучше так |
| Поддержка · первый абзац (стр. 189) | …en un plazo de dos días laborables. | …en un plazo de dos días hábiles. | «días hábiles» — общее слово для сроков по обе стороны океана, в Испании тоже официальное. «laborables» звучит по-испански из Испании. | лучше так |
| Поддержка · там же (стр. 189–190) | Rehearsly la hace una sola persona, así que responde alguien de carne y hueso, no una cola. | Rehearsly la hace una sola persona, así que te responde alguien de carne y hueso, no un sistema automático. | «Отвечает не очередь» — английская метафора, по-испански «cola» отвечать не может. В Аргентине, Уругвае и Чили «cola» в разговоре ещё и «ягодицы». | лучше так |
| Поддержка · «¿La sincronización revela…?» (стр. 222–223) | Los demás participantes ven que no estás disponible, nunca por qué. | Los demás miembros de tus proyectos ven que no estás disponible, nunca por qué. | Термины T-256: «miembro» — участник проекта, «participante» — участник репетиции. Здесь речь о проекте, как и в политике («Los demás miembros de tus proyectos»). | лучше так |
| Поддержка · «No llegan las notificaciones» (стр. 229–230) | …y que iOS las permite en Ajustes → Notificaciones → Rehearsly. | …y que iOS las permite en la configuración del teléfono: Notificaciones → Rehearsly. | Приложение настроек в iOS Испании называется «Ajustes», в Латинской Америке — «Configuración» (справка Apple es-la). Решение T-256 — называть описательно. Путь внутри настроек одинаковый. | лучше так |

**support.html: абзацы об удалении аккаунта и об инвайт-ссылке — оставить.**
- Удаление: смысл совпадает с английским и с политикой, «Perfil → Eliminar cuenta» — как в приложении. «los que solo administrabas tú» — нейтрально, «solo» здесь наречие.
- Инвайт: «quien administre el proyecto» не угадывает пол, ««Compartir el enlace»» — строка `projects.shareLink`.

### Ответы на вопросы

**1. Звучит ли по-испански? Понятно ли обычному человеку?**
- В целом да: текст написан по-испански, а не переведён. Фразы короткие, обращение на «tú», примеры живые («no disponible de 14:00 a 15:30», no «Dentista»).
- Следы перевода — в таблице: заголовок с местоимением без опоры, «contiene compras», «Google se vincula», «durante hasta», «Cuenta las peticiones…», заглавная в «Sincronización automática».
- Слова, которые в Латинской Америке читаются иначе: «agenda», «analítica», «días laborables», «Ajustes». Это единственная настоящая ошибка смысла: «agenda».
- В «Cambios» стоит «la fecha superior» — неуклюже. Оба варианта D2 это убирают.
- Обычному человеку текст понятен. «hash con clave», «token», «bcrypt» — неизбежные технические слова, и что они значат, ясно из фразы.

**2. Пол читателя.** Не угадывается ни на одной из двух страниц.
- Прилагательные на -o/-a относятся к вещам: «ocupados» — к периодам, «visto» — к «ensayo», «listo» — к «teléfono», «inmediato e irreversible» — к удалению.
- О людях пишется нейтрально: «quien administre el proyecto», «una persona menor de esa edad», «no estás disponible».
- Мои правки рода не добавляют: «las que marcaste tú», «las siguen viendo como ocupadas» (о часах).
- «desarrollador independiente» — о владельце сервиса, не о читателе.
- «todos» в «horarios que convengan a todos» — обычное обобщение о группе, так же пишет приложение («las horas en que todos pueden»).

**3. Limited Use.** Перевод точный, править нечего.
- «use and transfer» → «El uso y la transferencia».
- «information received from Google APIs» → «la información recibida de las API de Google». Множественное «las API» без -s — норма RAE.
- «adheres to» → «cumplen».
- «including the Limited Use requirements» → «incluidos los requisitos de uso limitado».
- Английское название политики в скобках нужно: у Google эта страница есть только по-английски.
- Единственная правка — «(en inglés)» у ссылки (в таблице). Английская фраза стоит дословно.

**4. Названия функций Apple и Google.** Испания и Латинская Америка пишут их по-разному, поэтому сверял обе версии справок.

| В тексте | Испания | Латинская Америка | Вывод |
|---|---|---|---|
| Iniciar sesión con Apple | Iniciar sesión con Apple | Iniciar sesión con Apple | верно |
| Ocultar mi correo | Ocultar mi correo electrónico | Ocultar mi correo | оставить короткое, в кавычках: оба узнают |
| cuenta de Apple | cuenta de Apple (одна справка пишет «Cuenta de Apple») | cuenta de Apple | верно, строчными по RAE |
| ajustes de tu cuenta de Apple | ajustes de la cuenta de Apple; кнопка «Eliminar» | configuración de la cuenta de Apple; «Deja de usar Iniciar sesión con Apple con una app» | «configuración» |
| (кнопка Google в тексте не названа) | Iniciar sesión con Google | Acceder con Google | описание «inicias sesión con Google» верно для обоих и совпадает с кнопкой приложения |
| cuenta de Google | cuenta de Google | Cuenta de Google | верно, строчными |
| ajustes de tu cuenta de Google | «configuración»; страница «aplicaciones vinculadas», кнопка «Dejar de usar Iniciar sesión con Google» | «configuración»; «apps vinculadas», «Dejar de usar Acceder con Google», «Quitar acceso» | «configuración» |
| Google Calendar | Google Calendar | Calendario de Google | оставить, как на экране приложения |
| Google Contacts | Contactos de Google | Contactos de Google | ошибка → «Contactos de Google» |
| Gmail | Gmail | Gmail | верно |

Адреса, по которым сверял:
- https://support.apple.com/es-es/105078 — «Ocultar mi correo electrónico», «Iniciar sesión con Apple», «Ajustes».
- https://support.apple.com/es-la/105078 — «Ocultar mi correo», «Configuración».
- https://support.apple.com/en-us/105078 — домены адреса (опубликовано 26.10.2026), см. вопрос 1 ниже.
- https://support.apple.com/es-es/102571 — «ajustes de la cuenta de Apple», кнопка «Eliminar».
- https://support.apple.com/es-lamr/102571 — «configuración de la cuenta de Apple», «Deja de usar Iniciar sesión con Apple con una app».
- https://support.apple.com/es-es/102379 — «Compartir mi correo electrónico», «Ocultar mi correo electrónico», «Cuenta de Apple».
- https://support.google.com/accounts/answer/13533235?hl=es — «Iniciar sesión con Google», «cuenta de Google», «página de aplicaciones vinculadas», «Dejar de usar Iniciar sesión con Google».
- https://support.google.com/accounts/answer/13533235?hl=es-419 — «Acceder con Google», «Cuenta de Google», «Dejar de usar Acceder con Google», «Quitar acceso».
- https://support.google.com/contacts/?hl=es и ?hl=es-419 — «Contactos de Google».
- https://support.google.com/calendar/?hl=es — «Google Calendar»; ?hl=es-419 — «Calendario de Google».
- https://developers.google.com/terms/api-services-user-data-policy?hl=es — только по-английски (вопрос 3).

**5. Названия экранов** совпадают с приложением:
- политика: «Perfil → Sincronización» (`calendarSync.title`), «Sincronización automática» (`autoSync`; в тексте — строчными, см. C), «Perfil → Editar perfil», «Perfil → Eliminar cuenta», «Perfil → Notificaciones», «Marcar como visto» → «marcas un ensayo como visto»;
- поддержка: «Perfil → Acerca de → «Reportar un error»», «Enviar», «¿Olvidaste tu contraseña?», «Compartir el enlace».

«bandeja de entrada» в политике — описание, а не название экрана. В приложении это экран «Notificaciones» под колокольчиком. Понятно и так, не правлю.

### Вопросы о фактах (не правки)

1. **Домен адреса Apple.**
   - Справка Apple теперь говорит, что адрес «Ocultar mi correo» при входе через Apple оканчивается на @private.icloud.com или на @privaterelay.appleid.com (en-us/105078, es-es/105078, es-la/105078).
   - Политика называет только второй домен.
   - Если подтвердится, испанская фраза: «…recibimos y guardamos una dirección privada de Apple (terminada en @privaterelay.appleid.com o en @private.icloud.com) en lugar de la real.»
2. **«Об авторе нигде не пишем» и раздел «Quién es responsable».**
   - Раздел называет владельца сервиса по имени.
   - Считаю, что правило не касается юридического оператора: GDPR требует назвать ответственного. Поэтому я только убрал «desarrollada por» (таблица).
   - Если имя убирать совсем — это решение владельца для всех языков.
3. **«Tus derechos» после выхода T-270.**
   - Строку о календаре можно дополнить: «Detener la importación de calendario y borrar lo importado — Perfil → Sincronización.»
   - Это смысл, решает владелец.

## 3. Часть B

| Ключ | Строка |
|---|---|
| `clearImported` | Eliminar horas importadas |
| `clearImportedConfirm` | ¿Eliminar todas las horas importadas? |
| `clearImportedMessage` | Se eliminarán de Rehearsly las horas ocupadas que llegaron de los calendarios de todos tus dispositivos. Las que marcaste tú se mantienen. |
| `autoSyncTurnsOff` | La sincronización automática se desactivará en este dispositivo; si no, la próxima sincronización volvería a añadirlo todo. |
| `clearImportedSuccess` | Se eliminaron todas las horas importadas |
| `chooseProviderFirst` | Elige primero Google Calendar o Apple Calendar. |

**Почему так:** «horas» — слово экранов для занятости («Marcar horas ocupadas»), и оно отличает кнопку от соседней «Eliminar todo lo exportado» не двумя буквами ex-/im- (симметричное «Eliminar todo lo importado» легко перепутать), при длине 25 знаков против 26; «de Rehearsly» в окне снимает страх, что удалятся события календаря; «en este dispositivo» — потому что настройка хранится на устройстве, а рядом сказано «de todos tus dispositivos»; в `autoSyncTurnsOff` нет местоимения, зависящего от «ensayos» или «horas», и нет «Además» в начале, поэтому она подходит к обоим окнам и стоит одна в окне `removeAll`, где текста сейчас нет; `clearImportedSuccess` построен как `removeAllSuccess`; в `chooseProviderFirst` названия — как подписи на экране.

Как читаются окна при включённой автосинхронизации (текст окна + пробел + `autoSyncTurnsOff`):
- **`removeAll`:** «¿Eliminar todos los ensayos del calendario?» — «La sincronización automática se desactivará en este dispositivo; si no, la próxima sincronización volvería a añadirlo todo.» — [Cancelar] [Eliminar todo lo exportado]
- **`clearImported`:** «¿Eliminar todas las horas importadas?» — «Se eliminarán de Rehearsly las horas ocupadas que llegaron de los calendarios de todos tus dispositivos. Las que marcaste tú se mantienen. La sincronización automática se desactivará en este dispositivo; si no, la próxima sincronización volvería a añadirlo todo.» — [Cancelar] [Eliminar horas importadas]

## 4. Часть C

Последний абзац «Sobre la importación de calendario» целиком. Он заменяет стр. 709–714 и включает правки этого абзаца из части A.

> La sincronización está desactivada hasta que la actives. Si desactivas la sincronización automática en Perfil → Sincronización, dejan de llegar horas nuevas, pero las que ya se importaron no se borran: permanecen en tu cuenta y los miembros de tus proyectos las siguen viendo como ocupadas. En esa misma pantalla, el botón «Eliminar horas importadas» borra de Rehearsly las horas ocupadas que llegaron de los calendarios de todos tus dispositivos; las que marcaste tú se mantienen. Al hacerlo, la sincronización automática se desactiva en el dispositivo que estás usando; si otro dispositivo tuyo la tiene activada, en su próxima sincronización volverá a enviar las horas ocupadas de sus calendarios. Eliminar tu cuenta también borra todo esto.

## 5. Часть D

### D1, вариант 1 — удаляем по-настоящему

Вместо абзаца «Una cosa permanece en manos de otras personas…» (стр. 832–837):

> Cuando te unes a un proyecto, te hacen admin o marcas un ensayo como visto, quienes administran ese proyecto reciben una notificación con tu nombre. Al eliminar tu cuenta, también borramos esas notificaciones de su bandeja de entrada en la aplicación. Lo único que no podemos borrar es una notificación push que ya llegó al teléfono de otra persona: permanece en ese teléfono, fuera de nuestro alcance.

При этом варианте нужно поменять и фразу в «Cómo eliminarlos» (стр. 786–788). Иначе она обещает, что имя в уведомлениях остаётся:

> Perfil → Eliminar cuenta los borra de nuestra base de datos junto con el resto de tu cuenta. Solo quedan fuera de nuestro alcance las notificaciones push que ya llegaron a los teléfonos de otras personas, como se explica en «Cuánto tiempo conservamos tus datos».

### D1, вариант 2 — исключение остаётся

Три правки:
1. «gestionan» → «administran» (как в части A).
2. «pasas a administrarlo» → «te hacen admin»: после первой правки в одной фразе было бы два «administrar». «Hacer admin» — кнопка приложения.
3. «No hay un plazo automático: se conserva hasta que se borra…» → «No caduca: se conserva hasta que se borre…». «No hay un plazo» — калька, а о будущем после «hasta que» естественнее сослагательное наклонение.

> Una cosa permanece en manos de otras personas. Cuando te unes a un proyecto, te hacen admin o marcas un ensayo como visto, quienes administran ese proyecto reciben una notificación con tu nombre. Queda en su bandeja de entrada, y eliminar tu cuenta no la borra. No caduca: se conserva hasta que se borre de la bandeja o se elimine la cuenta que la recibió.

### D2, вариант 1 — по почте

> Cuando esta política cambie, publicaremos la nueva versión en esta página y actualizaremos la fecha que aparece arriba. Si los cambios son sustanciales, te avisaremos además por correo, a la dirección de tu cuenta, antes de que entren en vigor.

### D2, вариант 2 — только дата

> Cuando esta política cambie, publicaremos la nueva versión en esta página y actualizaremos la fecha que aparece arriba.

## 6. Итог

правок в A: 34 (ошибок: 4); B, C, D готовы

## 7. Часть E — общие правки смысла

Номера строк — по правке `25e2d1d`. Ссылки и разметка (`<a>`, `<strong>`) остаются, где были; в тексте ниже их нет. Где итоговый текст включает мои правки из части A, это сказано в колонке «Где».

| Пункт | Где | Итоговый текст |
|---|---|---|
| E1 | Политика · вступление (стр. 595–599), абзац целиком; включает правку части A (вторая фраза) | Rehearsly guarda lo que necesita para funcionar y para planificar ensayos, y nada más. No vendemos tus datos, no los usamos con fines publicitarios y la aplicación no incluye herramientas de análisis ni de rastreo. |
| E2 | Политика · «Quién más procesa tus datos», последний абзац (стр. 741) | No compartimos tus datos con ninguna otra empresa y nunca los vendemos. |
| E3 | Политика · «Dónde se guardan y quién los recibe» (стр. 773–782), абзац целиком; «administran» — из части A | Se guardan en nuestra base de datos, alojada en Neon, junto con el resto de los datos de tu cuenta. Los miembros de tus proyectos ven tu nombre. Aparte de eso, solo compartimos estos datos con los servicios que hacen funcionar Rehearsly: Neon los almacena, Vercel ejecuta nuestro servidor, Resend recibe tu dirección de correo cuando te escribimos, y Expo Push Service y APNs de Apple entregan las notificaciones que muestran tu nombre a quienes administran tus proyectos. No los vendemos ni los usamos para publicidad ni para entrenar modelos de inteligencia artificial o aprendizaje automático. |
| E4 | Политика · «Seguridad» (стр. 855–861), абзац целиком | Todo el tráfico usa HTTPS. Las contraseñas se guardan solo como hashes bcrypt, así que no podemos verlas ni recuperarlas. Las sesiones pueden revocarse: cerrar sesión o cambiar la contraseña invalida todas las existentes. El acceso a los datos de cada proyecto se comprueba en el servidor en cada petición. |
| E5 | Политика · «Menores» (стр. 864–868), абзац целиком; заменяет строку части A «Menores» («a sabiendas» вошло сюда) | Rehearsly no está dirigida a menores de 13 años y no recopilamos sus datos a sabiendas. Si crees que una persona menor de esa edad ha creado una cuenta, escríbenos y eliminaremos esa cuenta. |
| E6 | Политика · «Lo que deliberadamente no recopilamos» (стр. 718–724), список целиком; включает две правки части A («Contactos», анализ и отслеживание) | 1) Datos de ubicación de tu teléfono · 2) Contactos · 3) Fotos, cámara ni micrófono: la aplicación no tiene acceso a ellos · 4) Identificadores publicitarios ni datos de análisis o de rastreo · 5) Datos de pago: la aplicación es gratuita, véase más abajo |
| E7 | Политика · таблица, «Token de notificaciones…», колонка «Para qué» (стр. 658); заменяет строку части A («avisos» → «notificaciones») | Enviarte notificaciones sobre tus proyectos y ensayos |
| E8 | Политика · таблица, строка «Un hash con clave…» (стр. 681–685); «Datos» — как в части A, «Para qué» и «Cuándo» новые | Datos: Un hash con clave de tu dirección IP y un contador de peticiones — nunca la dirección en sí. Cada registro abarca las peticiones de un minuto y no está vinculado a tu cuenta; los registros antiguos se sustituyen o se borran a medida que llegan peticiones nuevas · Para qué: Limitar los intentos repetidos de iniciar sesión, de hacer otras gestiones de tu cuenta y de abrir enlaces de invitación · Cuándo: Al iniciar sesión o hacer otras gestiones de tu cuenta desde la aplicación, y al abrir un enlace de invitación |
| E9 | Политика · таблица, новая строка сразу после строки о хеше IP | Datos: Dos contadores de peticiones vinculados a tu cuenta: uno para cuando te unes a un proyecto con un enlace y otro para cuando se carga la disponibilidad de los miembros de un proyecto. Cada uno registra las peticiones de un minuto y vuelve a empezar en el siguiente. Se borran junto con tu cuenta · Para qué: Limitar las peticiones demasiado frecuentes · Cuándo: Cuando te unes a un proyecto con un enlace o la aplicación carga la disponibilidad de los miembros (en Planner y al añadir o editar un ensayo) |
| E10 | Политика · таблица, «Los ensayos que has marcado como vistos», колонка «Para qué» (стр. 678); заменяет эту ячейку в строке части A про «administran» | Mostrar a quienes administran el proyecto y a los demás participantes del ensayo quién lo ha visto |
| E11 | Политика · «Quién más procesa tus datos», абзац «Confirmamos…» (стр. 740) | Confirmamos que cada proveedor al que enviamos tus datos les da una protección igual o equivalente a la que se describe en esta política, y solo los usa para prestarnos su servicio. |
| E12 | Политика · «Iniciar sesión con Apple», второй абзац (стр. 814–818), целиком; заменяет строку части A «Puedes dejar de usar…» | Usamos, guardamos y transmitimos estos datos tal como se describe arriba para Google, y Perfil → Eliminar cuenta los borra del mismo modo. Puedes dejar de usar Iniciar sesión con Apple en Rehearsly desde la configuración del iPhone: tu nombre → Iniciar sesión con Apple → Rehearsly → Eliminar. Igual que con Google, eso no borra lo que ya tenemos; para eso tienes que eliminar tu cuenta de Rehearsly. |
| E13 | Политика · «Cómo eliminarlos» (стр. 785–793), абзац целиком, вместе с решением D1 (вариант 1). Ссылка ведёт на myaccount.google.com/linkedapps, её текст — «configuración de tu cuenta de Google». Заменяет две строки части A об этом абзаце | Perfil → Eliminar cuenta los borra de nuestra base de datos junto con el resto de tu cuenta. Solo quedan fuera de nuestro alcance las notificaciones push que ya llegaron a los teléfonos de otras personas, como se explica en «Cuánto tiempo conservamos tus datos». También puedes dejar de usar tu cuenta de Google en Rehearsly desde la configuración de tu cuenta de Google: elige Rehearsly y luego «Dejar de usar Iniciar sesión con Google» (o «Dejar de usar Acceder con Google»). Eso retira el permiso en Google, pero no borra lo que ya tenemos; para eso tienes que eliminar tu cuenta de Rehearsly. |
| E14 | Политика · «Iniciar sesión con Apple», первый абзац (стр. 806–813), целиком; включает три правки части A («las incluye», «solo llega», кавычки) | Cada vez que inicias sesión, Apple nos da el identificador de tu cuenta y, si el token de inicio de sesión las incluye, tu dirección de correo y la confirmación de que está verificada. Tu nombre solo llega la primera vez que inicias sesión, y únicamente si lo permites. Si eliges «Ocultar mi correo», recibimos y guardamos una dirección privada terminada en @privaterelay.appleid.com o en @private.icloud.com en lugar de la real. Si no compartes un nombre, la cuenta se llama «User» hasta que lo cambies en Perfil → Editar perfil. |
| E15 | Политика · «Cuánto tiempo…», первый абзац, список (стр. 823) | уже в части A, строка «Cuánto tiempo…», первый абзац, список: «…disponibilidad, horas importadas de tus calendarios, tus notificaciones…» |
| E16 | Политика · «Tus derechos», новый пункт сразу после «Detener la importación de calendario» (стр. 849); снимает мой вопрос 3 из части A | **Eliminar las horas importadas de tus calendarios** — Perfil → Sincronización → «Eliminar horas importadas». |
| E17 | Политика · «Cuánto tiempo…», абзац «Una cosa permanece…», и «Cómo eliminarlos» | уже в части D: D1, вариант 1 — абзац и фраза для «Cómo eliminarlos». «Cómo eliminarlos» целиком — в строке E13 |
| E18 | Политика · «Cambios» (стр. 871–874) | уже в части D: D2, вариант 1 |
| E19 | Политика · «Uso limitado (Limited Use)», строка со ссылкой (стр. 803) | уже в части A: «Texto de la política (en inglés): Google API Services User Data Policy.» |
| E20 | Поддержка · «¿La sincronización revela de qué tratan mis eventos?» (стр. 220–225), абзац целиком; «Los demás miembros…» — из части A; «política de privacidad» остаётся ссылкой | No. De tu teléfono solo salen el inicio y el fin de cada evento, con identificadores técnicos para que la siguiente sincronización actualice la misma entrada. Los títulos, las notas y los lugares se quedan en el dispositivo. Los demás miembros de tus proyectos ven que no estás disponible, nunca por qué. Los detalles están en la política de privacidad. |
| E21 | Поддержка · «Informar de un problema», второй абзац (стр. 203–205), целиком | Si prefieres el correo, conviene indicar: qué esperabas, qué ocurrió en su lugar, tu dispositivo y versión de iOS, y la hora aproximada. Suele bastar para encontrar la causa. |
| E22 | Поддержка · «Informar de un problema», первый абзац (стр. 195–200), целиком; «Reportar un error» остаётся в `<strong>` | La vía más rápida está en la aplicación: Perfil → Acerca de → «Reportar un error». Describe el problema y toca «Enviar». El informe ya nos dice quién lo envía y cuándo, así que no hace falta indicar tu correo. No incluye tu dispositivo, la versión de iOS ni la pantalla donde ocurrió el fallo; si son importantes, menciónalos en el texto. |
| E23 | Политика · «Tus derechos», «Desactivar las notificaciones» (стр. 850) | не нужно: «Perfil → Notificaciones» совпадает с `profile.notifications` («Notificaciones»); «Eliminar cuenta», «Editar perfil», «Sincronización» тоже как в приложении. Остаётся правка части A «o la configuración del teléfono» |
| E24 | Часть B, `chooseProviderFirst` | уже в части B: «Elige primero Google Calendar o Apple Calendar.» Подписи совпадают с `onboarding.calendarSync.google` и `.apple` («Google Calendar», «Apple Calendar») |
| E25 | Политика · (1) «Quién más procesa tus datos», пункт Resend (стр. 736); (2) «Para qué los usamos» (стр. 763–770), абзац целиком, первая фраза уже по E27. Оба включают правки части A | (1) Resend — envío de los correos con códigos para el registro, el restablecimiento de la contraseña y el cambio de dirección, y de los avisos de cambios sustanciales en esta política; recibe tu dirección de correo y el texto del mensaje (UE, Irlanda) · (2) Solo para crear tu cuenta, iniciar tu sesión, enviarte correos sobre la cuenta y mostrar tu nombre a los miembros de tus proyectos. Tu dirección de correo es la de tu cuenta, así que a ella se envían los códigos que pidas, por ejemplo para restablecer la contraseña, y los avisos de cambios sustanciales en esta política. El nombre se toma una sola vez, al crear la cuenta, y puedes cambiarlo en Perfil → Editar perfil. Si ya existe una cuenta con la misma dirección verificada, el inicio de sesión con Google se vincula a esa cuenta, que conserva su nombre. |
| E26 | Поддержка · первый абзац (стр. 187–191), целиком; заменяет две строки части A («días hábiles», «no una cola»); адрес остаётся ссылкой | Escribe a support@rehearsly.me y recibirás respuesta en un plazo de dos días hábiles. Te contestará una persona de carne y hueso, no un sistema automático. |
| E27 | Политика · (1) «Para qué los usamos», первая фраза (стр. 764–765) — абзац целиком уже обновлён в E25 (2); (2) таблица, строка «Correo electrónico, nombre y apellido», колонка «Para qué» (стр. 618); (3) E3 и E9 в этой таблице уже исправлены: Resend получает адрес «cuando te escribimos», вкладка называется «Planner» (`nav.planner`) | (1) Solo para crear tu cuenta, iniciar tu sesión, enviarte correos sobre la cuenta y mostrar tu nombre a los miembros de tus proyectos. · (2) Crear tu cuenta, enviarte correos sobre ella y mostrar quién participa en un proyecto |

**Пояснения к отдельным пунктам.**
- **E5.** «la eliminaremos» заменено на «eliminaremos esa cuenta». По-испански «la» может относиться и к «una persona», и к «una cuenta»: оба слова женского рода.
- **E9.** Вкладка подбора времени — «Planner» (`nav.planner`, по E27). Форма репетиции — экраны «Añadir ensayo» и «Editar ensayo».
- **E12.** Путь — по справке Apple 102571: «toca tu nombre», «Iniciar sesión con Apple», кнопка «Eliminar». Само приложение настроек называется в Испании «Ajustes», а в Латинской Америке «Configuración», поэтому оно названо описательно: «la configuración del iPhone», как решено в T-256.
- **E13.** Google называет кнопку по-разному. Для Испании — «Dejar de usar Iniciar sesión con Google», для Латинской Америки — «Dejar de usar Acceder con Google» (support.google.com/accounts/answer/13533235, `hl=es` и `hl=es-419`). Поэтому даны обе, вторая в скобках.

- **E27.** «sobre la cuenta», а не «sobre ella»: в этой фразе ближайшее слово женского рода — «tu sesión», и «ella» отнеслось бы к нему. В ячейке таблицы перед «ella» стоит только «tu cuenta», там местоимение однозначно. «Resend recibe tu dirección de correo cuando te escribimos» — без повтора «correo… un correo».
