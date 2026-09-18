# Участок H — общие client components, preferences и i18n

Начат статический проход 2026-09-10. Только чтение/поиск; исходники не меняются, приложение/тесты/скрипты не запускаются. Пути относительно `rehearsal-calendar-native/`.

## Карта покрытия до чтения H

Выполнен перечень shared components/utils/types, contexts/hooks/i18n и сверка предыдущих notes. Не перечитываются полностью уже закрытые:

- A: `src/shared/utils/storage.ts`, `logger.ts`.
- C/D: `src/shared/utils/time.ts`, `availability.ts`, `conflictDetection.ts`, `src/shared/types/index.ts`; все smart-planner utilities.
- E: `calendarMappings.ts`, `calendarStorage.ts`, `formatLastSync.ts`, `src/shared/types/calendar.ts`; calendar services и sync hooks.
- G: `src/i18n/translations/notifications.ts`, UnreadContext, notifications hook/сервисы.

К чтению H: I18nContext/useWeekStart, `dataChanged`, `haptics`, `locale`; общие components (CreateActionSheet, DateRangePicker, PickerModal, UserAvatar, BetaBanner, buttons/loaders/barrels); i18n aggregation и ещё не прочитанные тесты этих утилит/компонентов. Большие feature translations будут проверяться через структуру/поиск ключей; это частичное покрытие, не обещание полного linguistic review примерно3000 строк переводов.

Production styles внутри component-файлов читаются вместе с ними; выделенные стили и assets runtime не проверяются. Конфиги/dependency audit I этим проходом не затрагиваются.

## Выполненное чтение H (сохранено 2026-09-11)

Полностью прочитаны production: `src/contexts/I18nContext.tsx` (74), `src/hooks/useWeekStart.ts` (71), `src/shared/utils/{dataChanged.ts (37),haptics.ts (29),locale.ts (16)}`, `src/i18n/translations.ts` (95), `src/shared/components/{CreateActionSheet.tsx (182),DateRangePicker.tsx (316),PickerModal.tsx (158),UserAvatar.tsx (74),BetaBanner.tsx (193)}`, `src/shared/components/buttons/{GlassButton.tsx (115),GoogleSignInButton.tsx (103)}`, `src/shared/components/loaders/SkeletonLoader.tsx` (94), все barrel index.ts в shared/components, buttons, loaders и пустой animations/index.ts. Inline styles прочитаны вместе с компонентами.

Полностью прочитаны tests: `src/shared/components/__tests__/DateRangePicker.test.tsx` (341), `src/shared/utils/__tests__/dataChanged.test.ts` (61), `src/shared/utils/__tests__/time.timezone.test.ts` (190), `src/i18n/__tests__/plurals.test.ts` (56). Тесты не запускались. Таким образом новый полный read охватывает все перечисленные общие production components/утилиты/тесты; типы и time/storage/logger reuse предыдущих участков описаны выше и не выдаются за повторную проверку здесь.

Поиском проверены все употребления `LocaleConfig`, `PickerModal`, `DateRangePicker`, `setLanguage`, `userLanguage`, `useWeekStart` в src (без tests). Добавлена адресная сверка callers и структуры/наличия i18n ключей, описанная в заключительном coverage ниже.

## HC01 — Low — язык аккаунта записывается в cache, но не обновляет уже работающий I18nContext

Места: `src/contexts/I18nContext.tsx:23–39,41–53`; `src/shared/utils/storage.ts:16–28`; `src/contexts/AuthContext.tsx:104–107,208–212`; `App.tsx:32–42`.

```tsx
const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
if (saved && saved in translations) setLanguageState(saved as Language);
useEffect(() => { loadLanguage(); }, [loadLanguage]);
// Only this context method updates state after mount
await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
setLanguageState(lang);
```

Сценарий: I18nProvider загрузил прежний device language en; пользователь входит в аккаунт, где server locale=ru. `syncUserPreferences` сохраняет userLanguage=ru в AsyncStorage, но provider не слушает user/cache изменения, loadLanguage вызывается только при mount. UI остаётся en до нового запуска/ручного выбора языка. Аналогично смена аккаунтов сохраняет язык предыдущего человека на экране, хотя cache уже новый. Это не утечка содержимого аккаунта, а рассинхронизация настройки.

Проверка profile-агентом: `ProfileScreen.tsx:74–87` при ручной смене вызывает setLanguage, поэтому ручной выбор работает; этот сценарий не смешивается с auth synchronization. Дополнительно адресно подтверждено: App.tsx:32 оборачивает AuthProvider в I18nProvider, оба не зависят от user/session; AuthContext.tsx:210 после login вызывает syncUserPreferences, а storage.ts:28 пишет только AsyncStorage.multiSet. Таким образом новый auth user не перемонтирует provider и не обновляет context language. Это подтверждённая находка, а не оставленный предположительный стык.

Дополнительный стык от profile-аудитора в тот же preference-consistency пункт: `ProfileScreen.tsx:80–85` сначала сохраняет local/context язык, затем updateUser locale. Если серверный save отказал, local остаётся новым; повторный выбор того же языка упирается в early return :77 (`newLanguage === language`) и не повторяет server save. Не отдельный count; правильное решение должно различать UI выбранный и подтверждённый server preference и разрешать retry.

Минимум (1–2 ч): при успешной загрузке/смене user синхронизировать language state через единый preference setter/provider API. Плюс: небольшая правка; минус: аккуратно разрешить порядок server preference против ещё не сохранённого пользовательского выбора.

Правильно (0.5–1 день): один user-scoped preferences store с hydration/version и явным обновлением UI+cache+server, I18nProvider получает language из него. Плюс: единый источник правды, работает при account switch; минус: затрагивает Auth/Profile/I18n.

## HC02 — Medium — iOS PickerModal сохраняет изменения при нажатии «Отмена»

Места: `src/shared/components/PickerModal.tsx:35–41,79–98`; прямой caller `src/features/calendar/screens/AddRehearsalScreen.tsx:283–313`; `src/features/calendar/hooks/useAddRehearsalForm.ts:207–228`.

```tsx
// Every spinner change goes directly to the owner
const handleChange = (event: any, selectedValue?: Date) => {
  if (Platform.OS === 'android') { onChange(event, selectedValue); onClose(); }
  else { onChange(event, selectedValue); }
};
// Cancel and Done use the identical callback
<TouchableOpacity onPress={onClose}><Text>{t.common.cancel}</Text></TouchableOpacity>
<TouchableOpacity onPress={onClose}><Text>{t.common.done}</Text></TouchableOpacity>
```

Адресная сверка подтвердила caller: AddRehearsalScreen:285/:296/:307 закрывает только show*Picker flag, onChange передаётся непосредственно в form.handleDateChange/handleStartTimeChange/handleEndTimeChange. В useAddRehearsalForm:209/:215/:227 они сразу вызывают setDate/setStartTime/setEndTime. Выбрать другое время на spinner и нажать «Отмена» оставляет новое значение. Более того, изменение start на время позже текущего end автоматически переносит end на+2ч (:217–220); отмена start picker сохраняет и это побочное изменение. Компонент не хранит draft/исходное value и не отправляет отмену/rollback, поэтому Cancel семантически равен Done. Проявление: пользователь сохраняет репетицию на отменённое время/дату. Сценарий подтверждён чтением всей цепочки, runtime не запускался.

Минимум (1–2 ч): локальный draft и onChange наружу только по Done для iOS, cancel/outside close отбрасывают draft; Android native set/dismiss оставить соответствующими платформенному событию. Плюс: локальная исправляемая ошибка; минус: надо заново инициализировать draft при каждом открытии/value смене.

Правильно (0.5 дня): явные onConfirm/onCancel contracts, единый pattern modal draft во всех editor pickers, проверки Cancel после изменения и повторного открытия. Плюс: понятные переходы состояния; минус: смена props/callers и интеграционный тест.

## Уже известное проявление CC01 — date-only header DateRangePicker

`src/shared/components/DateRangePicker.tsx:141–145` использует `new Date(dateStr).toLocaleDateString(...)`; при dateStr=2026-09-10 и device America/New_York label показывает9сентября, в то время как confirm :129 применяет правильный `parseDateString` и возвращает10сентября. Это тот же системный date-only display bug CC01/DP03; отдельный ID/count не начислять. Минимум parseDateString в formatDate (15мин), правильный shared calendar-date formatter (1–2ч). Тесты :255–268 «format dates correctly» проверяют лишь подписи «От/До», а не дату; :170–191 проверяет roundtrip Date, не header.

## Условные/manual наблюдения (не самостоятельные confirmed findings)

- `DateRangePicker.tsx:19–33` регистрирует LocaleConfig только ru/en, :46 выбирает language из четырёх ru/en/es/de. Сквозной поиск src не нашёл других registrations. При es/de locale entry не задан: фактическое поведение react-native-calendars (fallback English или ошибка) требует native/library contract проверки. Не утверждаем crash без неё и не читаем исключённые node_modules. Безопасная минимальная правка — зарегистрировать es/de с полными month/day names, либо явно выбирать поддерживаемый fallback. Также Calendar не получает firstDay/useWeekStart, что требует сверки UI ожидаемой единой настройки недели.
- `useWeekStart.ts:15–35` не отменяет AsyncStorage fallback. Если старый async getItem начался при отсутствующем user.weekStartDay, поздний ответ способен заменить более новую DB preference, установленную следующим effect :18–20. Однако app auth gate может исключить обычный начальный mount с user отсутствующим; нужна достижимая последовательность из callers до назначения finding. При неверном/null cached value hook оставляет прежний state, не сбрасывает monday, хотя comment обещает default.
- `DateRangePicker.tsx:153` native onRequestClose вызывает onClose напрямую, в отличие от cancel/outside handleCancel:134–138, и не сбрасывает незавершённый draft. При Android Back и reopening draft остаётся. minDate не проверяется повторно в handleConfirm; initial dates за прошлый день после полуночи могут ещё быть подтверждены. Достижимость/продуктовое ожидание нужно проверять на устройстве; planner отдельно фильтрует прошедшее время.
- `CreateActionSheet.tsx:30` сразу вызывает onClose до показа iOS ActionSheet; следующий render visible=false сбрасывает isShowingRef :55–56, хотя native sheet ещё открыт. Возможность реально открыть второй sheet повторным нажатием зависит от native modal blocking, не считать гонку доказанной без UI. Android concern снят: navigation-аудитор подтвердил `src/navigation/index.tsx:144–147,153–160`, все три handlers вызывают setShowActionSheet(false) перед navigate.
- `BetaBanner.tsx:41–44`: закрытие/повторное открытие формы и редактирование message во время in-flight submit может привести к тому, что late success очистит новый draft и закроет новое окно. TextInput не disabled при sending, close доступен. Незначительная потеря нового текста; пока не выделено отдельной Medium finding без ограничения scope UX. :46 показывает untranslated English error — локализационная неполнота, не security defect.
- `haptics.ts:12,20,28` не обрабатывает returned promise; эффект ошибки native haptics не проверялся. `dataChanged.ts:30–35` ловит synchronous throw listener, но не rejected promise callback; реальные async listeners обычно обрабатывают загрузочные ошибки сами, этот контракт не доказывает отдельного сбоя.

## Проверенные свойства и тестовые ограничения

- GlassButton/GoogleSignInButton блокируют onPress при loading/disabled; spinner вместо label. SkeletonLoader хранит Animated.Value через useRef и останавливает loop в cleanup :45. UserAvatar рассчитан на string имена, безопасно fallback initials для пустых значений; некорректный backend type относится A03.
- locale.ts явно маппит ru/en/es/de и fallbacken-US. I18n translations.ts создаёт все четыре typed Translations из всех девяти feature modules; missing/overridden вложенные ключи требуют completeness review, TypeScript/typecheck здесь не запускался.
- DateRangePicker comparison Date-only values :114–117 использует одинаковую UTC шкалу для двух дат, порядок от этого не меняется; confirm local parse сохраняет календарную дату. Ручная маркировка range и same-day styling не проверены визуально.
- dataChanged тесты не очищают все listeners между tests; case «nobody listening» :58–60 фактически выполняется после зарегистрированных listeners. Он не доказывает отсутствие слушателей, но production Set/unsubscribe механизм прочитан и отдельного функционального дефекта не выявлено.
- DateRangePicker tests на selection/reset часто проверяют label/onClose, не изменение выделения; локаль всегда ru, Android back и iOS PickerModal Cancel вообще не покрыты. time.timezone тест «DST transitions» :169–174 проверяет лишь notThrow для Europe/Moscow и не неоднозначный результат реального перехода; не выводить из него полную гарантию DST. Tests/plurals проверяют правильные формы счетчика слотов, другие feature keys не покрыты.

## Завершение H и i18n completeness

Новый полный read H: 18 production файлов, включая 4 barrel/пустой index, **1576 строк**; 4 test-файла, **648 строк**, всего **22 файла / 2224 строки**. App.tsx45 и storage.ts30 дополнительно адресно сверены (оба уже полностью покрыты A/B/G), AuthContext и AddRehearsal callers сверены только указанными выше диапазонами; их полное покрытие принадлежит другим notes. Выделенные styles/assets, types и прежние calendar/plannerutils повторно не читались, reuse coverage явно указан.

`src/i18n/translations.ts` прочитан полностью. В feature modules `auth.ts`, `availability.ts`, `calendar.ts`, `calendarSync.ts`, `common.ts`, `onboarding.ts`, `profile.ts`, `projects.ts` выполнен **структурный поисковый просмотр, не полное чтение строк перевода**; `notifications.ts` уже полностью G. Проверены exports ru/en/es/de, наборы top-level разделов, частоты меток property на соответствующей глубине, declarations interfaces и отсутствие cast-any/satisfies, маскирующих completeness. Все четыре exports присутствуют в каждом модуле; пропуск locale или явная асимметрия набора найденных property labels не обнаружены. Начальный широкий вывод ключей/значений был усечён и не выдаётся за прочитанный целиком: он заменён ограниченными rg -o ключами + sort/uniq и отдельным чтением найденных исключений глубины.

Особенности проверки: в common weekday labels имеют5 вхождений из-за интерфейса; вложенный onboarding имеет одинаковые ключи нескольких sections, частоты12/16 — нормальные4locale×3/4section. Такая lexical проверка не заменяет parser/typecheck и не исключает ошибку значения или перестановку ключа между одинаковыми вложенными объектами. Полностью прочитаны четыре month arrays common.ts:131–134,200–203,269–272,338–341: в каждом12 месяцев в календарном порядке. Прочитана реализация ru slotsCount availability.ts:142–149, соответствующая прочитанным plural tests; остальные slot-count locale definitions найдены поиском.

По итогам H common: **2 новые подтверждённые находки HC01 Low, HC02 Medium**; DateRangePicker date-only display добавлен к CC01 без нового count; es/de LocaleConfig и прочие условия оставлены manual hypotheses. Полный лингвистический audit всех переводов, native rendering/layout и dependency contract es/de locale не выполнены и явно остаются непроверенными. Сборки, typecheck, тесты, чтение node_modules и конфиги I не запускались/не выполнялись.
